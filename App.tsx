import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import Header from './components/Header';
import NotebookJournalView from './components/NotebookJournalView';
import WordBankView from './components/WordBankView';
import ContextualFlashcardView from './components/ContextualFlashcardView';
import ProfileStatsView from './components/ProfileStatsView';
import Notification from './components/Notification';
import {
  AppTab,
  JournalEntry,
  NotificationMessage,
  UserStats,
  WordBankItem,
  WordToken,
  isWordMastered,
  normalizeArabicToken,
} from './types';
import {
  auth,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  signOutUser,
} from './firebase';
import { translateJournalToFusha } from './services/geminiService';
import {
  loadLocalEntries,
  saveLocalEntries,
  loadLocalWordBank,
  saveLocalWordBank,
  loadLocalStats,
  saveLocalStats,
  getWordIdForNormalized,
  saveJournalEntryToFirestore,
  saveWordBankItemToFirestore,
  saveUserStatsToFirestore,
  deleteJournalEntryFromFirestore,
  subscribeToNotebookFirestore,
} from './services/notebookRepository';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('journal');
  const [notification, setNotification] =
    useState<NotificationMessage | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>(() =>
    loadLocalEntries()
  );
  const [wordBank, setWordBank] = useState<WordBankItem[]>(() =>
    loadLocalWordBank()
  );
  const [stats, setStats] = useState<UserStats>(() => loadLocalStats());

  const [activeEntryId, setActiveEntryId] = useState<string | null>(() => {
    const initial = loadLocalEntries();
    return initial[0]?.id ?? null;
  });
  const [isWritingMode, setIsWritingMode] = useState<boolean>(false);

  useEffect(() => {
    saveLocalEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveLocalWordBank(wordBank);
  }, [wordBank]);

  useEffect(() => {
    saveLocalStats(stats);
  }, [stats]);

  // Silent Cloud Firestore synchronization under the hood
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (firebaseUser) {
        unsubFirestore = subscribeToNotebookFirestore(
          firebaseUser.uid,
          (remoteEntries) => {
            if (remoteEntries.length > 0) {
              setEntries((prev) => {
                const map = new Map<string, JournalEntry>();
                prev.forEach((e) => map.set(e.id, e));
                remoteEntries.forEach((e) => map.set(e.id, e));
                return Array.from(map.values()).sort((a, b) =>
                  b.createdAt.localeCompare(a.createdAt)
                );
              });
            }
          },
          (remoteWords) => {
            if (remoteWords.length > 0) {
              setWordBank((prev) => {
                const map = new Map<string, WordBankItem>();
                prev.forEach((w) => map.set(w.id, w));
                remoteWords.forEach((w) => map.set(w.id, w));
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

  // Submit a new English/Arabic journal entry -> Gemini translates to vocalized Fusha & updates Word Bank
  const handleSubmitJournalEntry = useCallback(
    async (text: string): Promise<JournalEntry> => {
      const geminiResult = await translateJournalToFusha(text);
      const nowIso = new Date().toISOString();
      const entryId = `entry_${Date.now()}`;
      const currentUserId = user?.uid || 'local_user';

      // Map existing word bank by normalizedWord to increment usageCount
      const bankMap = new Map<string, WordBankItem>();
      wordBank.forEach((item) => {
        bankMap.set(normalizeArabicToken(item.normalizedWord), item);
      });

      const updatedWordsToPersist: Array<{
        item: WordBankItem;
        isNew: boolean;
      }> = [];

      const enrichedTokens: WordToken[] = geminiResult.tokens.map((raw) => {
        const norm =
          normalizeArabicToken(raw.normalizedWord) ||
          normalizeArabicToken(raw.arabicWord) ||
          raw.arabicWord;
        const existing = bankMap.get(norm);

        const nextUsageCount = existing ? existing.usageCount + 1 : 1;
        const nextReviewCount = existing ? existing.reviewCount : 0;
        const mastered = isWordMastered({
          usageCount: nextUsageCount,
          reviewCount: nextReviewCount,
        });

        const updatedBankItem: WordBankItem = {
          id: existing ? existing.id : getWordIdForNormalized(norm),
          userId: currentUserId,
          arabicWord: raw.arabicWord,
          normalizedWord: norm,
          englishMeaning: raw.englishMeaning,
          transliteration: raw.transliteration,
          root: raw.root,
          partOfSpeech: raw.partOfSpeech,
          contextSentenceArabic:
            raw.contextSentenceArabic || geminiResult.fullArabicTranslation,
          contextSentenceEnglish: raw.contextSentenceEnglish || text,
          visualKeyword:
            raw.visualKeyword || 'morning coffee notebook sunlit window',
          usageCount: nextUsageCount,
          reviewCount: nextReviewCount,
          isMastered: mastered,
          createdAt: existing ? existing.createdAt : nowIso,
          updatedAt: nowIso,
        };

        bankMap.set(norm, updatedBankItem);
        updatedWordsToPersist.push({
          item: updatedBankItem,
          isNew: !existing,
        });

        return {
          arabicWord: raw.arabicWord,
          normalizedWord: norm,
          englishMeaning: raw.englishMeaning,
          transliteration: raw.transliteration,
          root: raw.root,
          partOfSpeech: raw.partOfSpeech,
          contextSentenceArabic: updatedBankItem.contextSentenceArabic,
          contextSentenceEnglish: updatedBankItem.contextSentenceEnglish,
          visualKeyword: updatedBankItem.visualKeyword,
          usageCount: nextUsageCount,
          reviewCount: nextReviewCount,
        };
      });

      const newEntry: JournalEntry = {
        id: entryId,
        userId: currentUserId,
        originalText: text,
        fullArabicTranslation: geminiResult.fullArabicTranslation,
        tokens: enrichedTokens,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const nextWordBank = Array.from(bankMap.values());
      const masteredCount = nextWordBank.filter((w) =>
        isWordMastered(w)
      ).length;

      const nextStats: UserStats = {
        ...stats,
        userId: currentUserId,
        totalEntries: entries.length + 1,
        totalWordsEncountered: nextWordBank.length,
        masteredWordsCount: masteredCount,
        lastJournalDate: nowIso.slice(0, 10),
        updatedAt: nowIso,
      };

      setEntries((prev) => [newEntry, ...prev]);
      setWordBank(nextWordBank);
      setStats(nextStats);
      setActiveEntryId(entryId);
      setIsWritingMode(false);

      // Silently persist to Firestore if authenticated
      if (user) {
        saveJournalEntryToFirestore(newEntry).catch(() => {});
        for (const { item, isNew } of updatedWordsToPersist) {
          saveWordBankItemToFirestore(item, isNew).catch(() => {});
        }
        saveUserStatsToFirestore(nextStats).catch(() => {});
      }

      setNotification({
        type: 'success',
        message: `Translated into vocalized Fusha Arabic & updated ${enrichedTokens.length} words in your Word Bank.`,
      });

      return newEntry;
    },
    [user, wordBank, stats, entries.length]
  );

  // Handle completing a Tri-Modal Contextual Flashcard review
  const handleCompleteFlashcardReview = useCallback(
    (wordId: string, outcome: 'again' | 'got_it') => {
      const target = wordBank.find((w) => w.id === wordId);
      if (!target) return;

      const increment = outcome === 'got_it' ? 1 : 0;
      const nextReviewCount = target.reviewCount + increment;
      const nowMastered = isWordMastered({
        usageCount: target.usageCount,
        reviewCount: nextReviewCount,
      });
      const justReachedMastery = !target.isMastered && nowMastered;

      const updatedItem: WordBankItem = {
        ...target,
        reviewCount: nextReviewCount,
        isMastered: nowMastered,
        updatedAt: new Date().toISOString(),
      };

      const nextWordBank = wordBank.map((w) =>
        w.id === wordId ? updatedItem : w
      );
      setWordBank(nextWordBank);

      const nextStats: UserStats = {
        ...stats,
        totalReviewsCompleted: stats.totalReviewsCompleted + 1,
        masteredWordsCount: nextWordBank.filter((w) => isWordMastered(w))
          .length,
        updatedAt: new Date().toISOString(),
      };
      setStats(nextStats);

      if (user) {
        saveWordBankItemToFirestore(updatedItem, false).catch(() => {});
        saveUserStatsToFirestore(nextStats).catch(() => {});
      }

      if (justReachedMastery) {
        setNotification({
          type: 'success',
          message: `Mabruk! "${target.arabicWord}" reached 20/20 Mastery! Its English translation is now hidden in your journal.`,
        });
      }
    },
    [wordBank, stats, user]
  );

  // Interactive helper to let users test/toggle the 20/20 Hidden-English Mastery rule on any word
  const handleFastForwardMasteryByNorm = useCallback(
    (normalizedWord: string) => {
      const norm = normalizeArabicToken(normalizedWord);
      const existing = wordBank.find(
        (w) =>
          normalizeArabicToken(w.normalizedWord) === norm ||
          normalizeArabicToken(w.arabicWord) === norm
      );

      if (existing) {
        const updated: WordBankItem = {
          ...existing,
          usageCount: Math.max(20, existing.usageCount),
          reviewCount: Math.max(20, existing.reviewCount),
          isMastered: true,
          updatedAt: new Date().toISOString(),
        };
        setWordBank((prev) =>
          prev.map((w) => (w.id === existing.id ? updated : w))
        );
        if (user) {
          saveWordBankItemToFirestore(updated, false).catch(() => {});
        }
        setNotification({
          type: 'success',
          message: `"${existing.arabicWord}" promoted to 20/20 Mastery! English gloss is now hidden in the interlinear reader.`,
        });
      } else {
        // Create mastered entry in wordBank if token wasn't in bank yet
        const activeEntry = entries.find((e) => e.id === activeEntryId);
        const tokenMatch = activeEntry?.tokens.find(
          (t) =>
            normalizeArabicToken(t.normalizedWord) === norm ||
            normalizeArabicToken(t.arabicWord) === norm
        );
        if (!tokenMatch) return;

        const nowIso = new Date().toISOString();
        const created: WordBankItem = {
          id: getWordIdForNormalized(norm),
          userId: user?.uid || 'local_user',
          ...tokenMatch,
          normalizedWord: norm,
          usageCount: 20,
          reviewCount: 20,
          isMastered: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setWordBank((prev) => [created, ...prev]);
        if (user) {
          saveWordBankItemToFirestore(created, true).catch(() => {});
        }
        setNotification({
          type: 'success',
          message: `"${tokenMatch.arabicWord}" promoted to 20/20 Mastery! English gloss is now hidden in the interlinear reader.`,
        });
      }
    },
    [wordBank, entries, activeEntryId, user]
  );

  const handleToggleMasteryInBank = useCallback(
    (wordId: string) => {
      const target = wordBank.find((w) => w.id === wordId);
      if (!target) return;
      const currentlyMastered = isWordMastered(target);
      const updated: WordBankItem = {
        ...target,
        usageCount: currentlyMastered ? 8 : Math.max(20, target.usageCount),
        reviewCount: currentlyMastered ? 10 : Math.max(20, target.reviewCount),
        isMastered: !currentlyMastered,
        updatedAt: new Date().toISOString(),
      };
      setWordBank((prev) => prev.map((w) => (w.id === wordId ? updated : w)));
      if (user) {
        saveWordBankItemToFirestore(updated, false).catch(() => {});
      }
      setNotification({
        type: 'success',
        message: currentlyMastered
          ? `"${target.arabicWord}" returned to Learning state.`
          : `"${target.arabicWord}" set to 20/20 Mastered! English translation will now hide in journal entries.`,
      });
    },
    [wordBank, user]
  );

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      if (activeEntryId === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        setActiveEntryId(remaining[0]?.id ?? null);
      }
      if (user) {
        deleteJournalEntryFromFirestore(entryId).catch(() => {});
      }
      setNotification({
        type: 'success',
        message: 'Notebook page removed.',
      });
    },
    [activeEntryId, entries, user]
  );

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      setNotification({
        type: 'success',
        message: 'Signed in with Google.',
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Google sign-in could not be completed.',
      });
    }
  };

  const handleEmailAuth = async (
    email: string,
    password: string,
    isRegistering: boolean
  ) => {
    try {
      if (isRegistering) {
        await registerWithEmail(email, password);
        setNotification({
          type: 'success',
          message: 'Account created and signed in.',
        });
      } else {
        await signInWithEmail(email, password);
        setNotification({
          type: 'success',
          message: 'Signed in with email.',
        });
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Authentication failed.',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setNotification({
        type: 'success',
        message: 'Signed out.',
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Failed to sign out.',
      });
    }
  };

  const masteredCount = useMemo(
    () => wordBank.filter((w) => isWordMastered(w)).length,
    [wordBank]
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C2A29] flex flex-col">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wordBankCount={wordBank.length}
        masteredCount={masteredCount}
        onStartNewEntry={() => {
          setIsWritingMode(true);
          setActiveTab('journal');
        }}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <main className="flex-grow">
        {activeTab === 'journal' && (
          <NotebookJournalView
            entries={entries}
            wordBank={wordBank}
            activeEntryId={activeEntryId}
            isWritingMode={isWritingMode}
            onSelectEntry={(entryId) => {
              setActiveEntryId(entryId);
              setIsWritingMode(false);
            }}
            onStartWriting={() => setIsWritingMode(true)}
            onSubmitJournalEntry={handleSubmitJournalEntry}
            onDeleteEntry={handleDeleteEntry}
            onNavigateToStudy={() => setActiveTab('study')}
            onNavigateToWordBank={() => setActiveTab('wordBank')}
            onFastForwardMastery={handleFastForwardMasteryByNorm}
          />
        )}

        {activeTab === 'wordBank' && (
          <WordBankView
            wordBank={wordBank}
            onToggleMasteryDemo={handleToggleMasteryInBank}
            onNavigateToStudy={() => setActiveTab('study')}
          />
        )}

        {activeTab === 'study' && (
          <ContextualFlashcardView
            wordBank={wordBank}
            onCompleteReview={handleCompleteFlashcardReview}
            onNavigateToJournal={() => {
              setIsWritingMode(true);
              setActiveTab('journal');
            }}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileStatsView
            stats={stats}
            wordBank={wordBank}
            entriesCount={entries.length}
            userEmail={user?.email || null}
            onGoogleSignIn={handleGoogleSignIn}
            onEmailAuth={handleEmailAuth}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      <footer className="hidden md:flex items-center justify-between max-w-5xl w-full mx-auto px-8 py-5 text-xs text-[#7A7267] border-t border-[#E6DEC8]">
        <span>
          Fusha Notebook · Modern Standard &amp; Quranic Arabic Acquisition
        </span>
        <span>20 Uses + 20 Reviews = Direct Arabic Reading</span>
      </footer>
    </div>
  );
};

export default App;
