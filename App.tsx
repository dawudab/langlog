import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import Header from './components/Header';
import DistractionFreeEditor from './components/DistractionFreeEditor';
import SRSStudyEngine from './components/SRSStudyEngine';
import RootLexiconView from './components/RootLexiconView';
import ArchiveView from './components/ArchiveView';
import Notification from './components/Notification';
import {
  AppView,
  JournalEntryRecord,
  LanguageCode,
  NotificationMessage,
  ReviewGrade,
  SM2Flashcard,
} from './types';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { analyzeJournalEntry } from './services/geminiService';
import {
  calculateSM2Review,
  getPrioritizedStudyQueue,
} from './services/sm2Engine';
import {
  loadLocalEntries,
  saveLocalEntries,
  loadLocalFlashcards,
  saveLocalFlashcards,
  pushEntryToFirestore,
  pushFlashcardToFirestore,
  updateFlashcardSM2InFirestore,
  deleteEntryFromFirestore,
  subscribeToUserFirestoreData,
} from './services/syncRepository';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('journal');
  const [notification, setNotification] =
    useState<NotificationMessage | null>(null);

  // System-aware Light/Dark Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('langlog_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved === 'dark';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('langlog_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Network & Offline-First Simulation State
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const isOnline = browserOnline && !simulateOffline;

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);

  // Offline-First Local State (Local Persistence + Cloud Firestore Sync)
  const [entries, setEntries] = useState<JournalEntryRecord[]>(() =>
    loadLocalEntries()
  );
  const [cards, setCards] = useState<SM2Flashcard[]>(() =>
    loadLocalFlashcards()
  );
  const [activeEntryId, setActiveEntryId] = useState<string | null>(() => {
    const initial = loadLocalEntries();
    return initial[0]?.id ?? null;
  });
  const [isSyncingPending, setIsSyncingPending] = useState<boolean>(false);

  useEffect(() => {
    saveLocalEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveLocalFlashcards(cards);
  }, [cards]);

  // Subscribe to Firebase Auth & Firestore when authenticated
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (firebaseUser) {
        unsubFirestore = subscribeToUserFirestoreData(
          firebaseUser.uid,
          (remoteEntries) => {
            if (remoteEntries.length > 0) {
              setEntries((prev) => {
                const map = new Map<string, JournalEntryRecord>();
                prev.forEach((e) => map.set(e.id, e));
                remoteEntries.forEach((e) => map.set(e.id, e));
                return Array.from(map.values()).sort((a, b) =>
                  b.createdAt.localeCompare(a.createdAt)
                );
              });
            }
          },
          (remoteCards) => {
            if (remoteCards.length > 0) {
              setCards((prev) => {
                const map = new Map<string, SM2Flashcard>();
                prev.forEach((c) => map.set(c.id, c));
                remoteCards.forEach((c) => map.set(c.id, c));
                return Array.from(map.values());
              });
            }
          }
        );
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  // Sync any pending entries (`sync_status: pending`) when online
  const syncPendingEntries = useCallback(async () => {
    if (!isOnline || isSyncingPending) return;
    const pendingList = entries.filter((e) => e.syncStatus === 'pending');
    if (pendingList.length === 0) return;

    setIsSyncingPending(true);
    try {
      const knownWords = cards.map((c) => c.wordConjugated);

      for (const pendingEntry of pendingList) {
        const result = await analyzeJournalEntry(
          pendingEntry.originalText,
          pendingEntry.sourceLanguage,
          pendingEntry.targetLanguage,
          knownWords
        );

        const nowIso = new Date().toISOString();
        const syncedEntry: JournalEntryRecord = {
          ...pendingEntry,
          translatedText: result.translation,
          vocabulary: result.vocabulary,
          syncStatus: 'synced',
          updatedAt: nowIso,
        };

        const generatedCards: SM2Flashcard[] = result.vocabulary.map(
          (v, idx) => ({
            id: `card_${pendingEntry.id}_${idx}`,
            userId: user?.uid || 'local_user',
            entryId: pendingEntry.id,
            wordConjugated: v.word_conjugated,
            root: v.root,
            meaning: v.meaning,
            context: v.context,
            targetLanguage: pendingEntry.targetLanguage,
            isNew: v.is_new,
            interval: 0,
            repetitions: 0,
            easeFactor: 2.5,
            nextReviewDate: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
            pendingSync: false,
          })
        );

        setEntries((prev) =>
          prev.map((e) => (e.id === pendingEntry.id ? syncedEntry : e))
        );
        setCards((prev) => {
          const existingWords = new Set(
            prev.map((c) => c.wordConjugated.toLowerCase())
          );
          const freshCards = generatedCards.filter(
            (c) => !existingWords.has(c.wordConjugated.toLowerCase())
          );
          return [...freshCards, ...prev];
        });

        if (user) {
          await pushEntryToFirestore(syncedEntry);
          for (const card of generatedCards) {
            await pushFlashcardToFirestore(card);
          }
        }
      }

      setNotification({
        type: 'success',
        message: `Synced ${pendingList.length} pending ${
          pendingList.length === 1 ? 'entry' : 'entries'
        } & extracted roots to SRS deck.`,
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Failed to sync pending entries.',
      });
    } finally {
      setIsSyncingPending(false);
    }
  }, [isOnline, isSyncingPending, entries, cards, user]);

  // Automatically trigger background sync when network is restored
  useEffect(() => {
    if (isOnline && entries.some((e) => e.syncStatus === 'pending')) {
      syncPendingEntries();
    }
  }, [isOnline]);

  // Handle writing & saving a new journal entry (Offline-First)
  const handleSubmitEntry = useCallback(
    async (
      text: string,
      sourceLang: LanguageCode,
      targetLang: LanguageCode
    ): Promise<JournalEntryRecord> => {
      const nowIso = new Date().toISOString();
      const entryId = `entry_${Date.now()}`;

      // Step 1: Always save locally first with sync_status: pending
      const localPendingEntry: JournalEntryRecord = {
        id: entryId,
        userId: user?.uid || 'local_user',
        originalText: text,
        translatedText: '',
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        syncStatus: 'pending',
        vocabulary: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setEntries((prev) => [localPendingEntry, ...prev]);
      setActiveEntryId(entryId);

      // If offline, leave as sync_status: pending in local queue
      if (!isOnline) {
        setNotification({
          type: 'success',
          message:
            'Saved locally (sync_status: pending). Will translate & sync when back online.',
        });
        return localPendingEntry;
      }

      // Step 2: Online -> Trigger Gemini translation + root extraction and push to Firestore
      try {
        const knownWords = cards.map((c) => c.wordConjugated);
        const result = await analyzeJournalEntry(
          text,
          sourceLang,
          targetLang,
          knownWords
        );

        const syncedEntry: JournalEntryRecord = {
          ...localPendingEntry,
          translatedText: result.translation,
          vocabulary: result.vocabulary,
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        };

        const newCards: SM2Flashcard[] = result.vocabulary.map((v, idx) => ({
          id: `card_${entryId}_${idx}`,
          userId: user?.uid || 'local_user',
          entryId,
          wordConjugated: v.word_conjugated,
          root: v.root,
          meaning: v.meaning,
          context: v.context,
          targetLanguage: targetLang,
          isNew: v.is_new,
          interval: 0,
          repetitions: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          pendingSync: false,
        }));

        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? syncedEntry : e))
        );
        setCards((prev) => {
          const existingWords = new Set(
            prev.map((c) => c.wordConjugated.toLowerCase())
          );
          const uniqueNew = newCards.filter(
            (c) => !existingWords.has(c.wordConjugated.toLowerCase())
          );
          return [...uniqueNew, ...prev];
        });

        if (user) {
          await pushEntryToFirestore(syncedEntry);
          for (const card of newCards) {
            await pushFlashcardToFirestore(card);
          }
        }

        setNotification({
          type: 'success',
          message: `Translated & extracted ${result.vocabulary.length} vocabulary roots into your SRS study queue.`,
        });
        return syncedEntry;
      } catch (error: any) {
        setNotification({
          type: 'error',
          message:
            error?.message ||
            'Saved locally with sync_status: pending. Will retry when online.',
        });
        return localPendingEntry;
      }
    },
    [user, isOnline, cards]
  );

  // Handle SM-2 flashcard review grade (Hard / Good / Easy)
  const handleGradeCard = useCallback(
    async (card: SM2Flashcard, grade: ReviewGrade) => {
      const updatedCard = calculateSM2Review(card, grade);
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? updatedCard : c))
      );

      if (user && isOnline) {
        try {
          await updateFlashcardSM2InFirestore(updatedCard);
        } catch (err) {
          console.warn('Will sync flashcard review later:', err);
        }
      }
    },
    [user, isOnline]
  );

  // Add custom vocabulary & triliteral root from Root Lexicon
  const handleAddCustomCard = useCallback(
    async (cardInput: {
      wordConjugated: string;
      root: string;
      meaning: string;
      context: string;
      targetLanguage: LanguageCode;
    }) => {
      const nowIso = new Date().toISOString();
      const newCard: SM2Flashcard = {
        id: `card_custom_${Date.now()}`,
        userId: user?.uid || 'local_user',
        entryId: activeEntryId || 'custom_lexicon',
        wordConjugated: cardInput.wordConjugated,
        root: cardInput.root,
        meaning: cardInput.meaning,
        context: cardInput.context,
        targetLanguage: cardInput.targetLanguage,
        isNew: true,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewDate: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        pendingSync: !isOnline,
      };

      setCards((prev) => [newCard, ...prev]);

      if (user && isOnline) {
        try {
          await pushFlashcardToFirestore(newCard);
        } catch (err) {
          console.warn('Failed to push custom flashcard to Firestore:', err);
        }
      }

      setNotification({
        type: 'success',
        message: `Added "${cardInput.wordConjugated}" (${cardInput.root}) to your SRS queue.`,
      });
    },
    [user, isOnline, activeEntryId]
  );

  // Prioritize an existing vocabulary card in the daily SM-2 queue
  const handlePrioritizeCard = useCallback(
    async (cardId: string) => {
      const target = cards.find((c) => c.id === cardId);
      if (!target) return;

      const nowIso = new Date().toISOString();
      const prioritized: SM2Flashcard = {
        ...target,
        isNew: true,
        nextReviewDate: nowIso,
        updatedAt: nowIso,
      };

      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? prioritized : c))
      );

      if (user && isOnline) {
        try {
          await updateFlashcardSM2InFirestore(prioritized);
        } catch (err) {
          console.warn('Will sync prioritized card later:', err);
        }
      }

      setNotification({
        type: 'success',
        message: `Prioritized "${target.wordConjugated}" (is_new: true) for today's study queue.`,
      });
    },
    [cards, user, isOnline]
  );

  const handleDeleteCard = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setNotification({
      type: 'success',
      message: 'Removed vocabulary item from lexicon.',
    });
  }, []);

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      if (activeEntryId === entryId) {
        setActiveEntryId(null);
      }
      if (user && isOnline) {
        try {
          await deleteEntryFromFirestore(entryId);
        } catch (err) {
          console.warn('Failed to delete remote entry:', err);
        }
      }
      setNotification({
        type: 'success',
        message: 'Journal entry removed.',
      });
    },
    [activeEntryId, user, isOnline]
  );

  const handleAuthAction = async () => {
    try {
      if (user) {
        await signOutUser();
        setNotification({
          type: 'success',
          message: 'Signed out. Continuing in local offline-first mode.',
        });
      } else {
        await signInWithGoogle();
        setNotification({
          type: 'success',
          message: 'Connected to Firebase Cloud Firestore.',
        });
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Authentication action cancelled.',
      });
    }
  };

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) || entries[0] || null,
    [entries, activeEntryId]
  );

  const dueCardsCount = useMemo(
    () => getPrioritizedStudyQueue(cards, false).length,
    [cards]
  );

  const pendingSyncCount = useMemo(
    () => entries.filter((e) => e.syncStatus === 'pending').length,
    [entries]
  );

  const uniqueRootsCount = useMemo(() => {
    const roots = new Set(cards.map((c) => c.root.trim() || c.wordConjugated));
    return roots.size;
  }, [cards]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        dueCardsCount={dueCardsCount}
        pendingSyncCount={pendingSyncCount}
        rootsCount={uniqueRootsCount}
        userEmail={user?.email || null}
        onAuthAction={handleAuthAction}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <main className="flex-grow">
        {currentView === 'journal' && (
          <DistractionFreeEditor
            isOnline={isOnline}
            onToggleOfflineSim={() => setSimulateOffline((prev) => !prev)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            pendingCount={pendingSyncCount}
            isSyncingPending={isSyncingPending}
            onSyncPendingNow={syncPendingEntries}
            onSubmitEntry={handleSubmitEntry}
            activeEntry={activeEntry}
            onNavigateToStudy={() => setCurrentView('study')}
            onNavigateToRoots={() => setCurrentView('roots')}
            dueCardsCount={dueCardsCount}
          />
        )}

        {currentView === 'study' && (
          <SRSStudyEngine
            cards={cards}
            onGradeCard={handleGradeCard}
            onNavigateToJournal={() => setCurrentView('journal')}
          />
        )}

        {currentView === 'roots' && (
          <RootLexiconView
            cards={cards}
            onAddCustomCard={handleAddCustomCard}
            onPrioritizeCard={handlePrioritizeCard}
            onDeleteCard={handleDeleteCard}
            onNavigateToStudy={() => setCurrentView('study')}
            dueCardsCount={dueCardsCount}
          />
        )}

        {currentView === 'archive' && (
          <ArchiveView
            entries={entries}
            cards={cards}
            isOnline={isOnline}
            isSyncingPending={isSyncingPending}
            onSyncPendingNow={syncPendingEntries}
            onSelectEntry={(entry) => {
              setActiveEntryId(entry.id);
              setCurrentView('journal');
            }}
            onDeleteEntry={handleDeleteEntry}
          />
        )}
      </main>

      <footer className="hidden md:flex items-center justify-between max-w-7xl w-full mx-auto px-8 py-5 text-xs text-slate-500 dark:text-slate-500 border-t border-stone-200/70 dark:border-slate-800/70">
        <span>Language Journal · English &amp; Arabic Acquisition</span>
        <span>
          {user?.email
            ? `Cloud Sync Active (${user.email})`
            : 'Local Offline-First Storage Ready'}
        </span>
      </footer>
    </div>
  );
};

export default App;
