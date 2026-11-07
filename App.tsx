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

const CLOZE_SETTING_KEY = 'fusha_notebook_cloze_v4';
const AUTO_AUDIO_SETTING_KEY = 'fusha_notebook_auto_audio_v4';

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

  // Cloze deletion defaults to true (on automatically)
  const [clozeMode, setClozeMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(CLOZE_SETTING_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTO_AUDIO_SETTING_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [activeEntryId, setActiveEntryId] = useState<string | null>(() => {
    const initial = loadLocalEntries();
    return initial[0]?.id ?? null;
  });
  const [isWritingMode, setIsWritingMode] = useState<boolean>(() => {
    const initial = loadLocalEntries();
    return initial.length === 0;
  });

  useEffect(() => {
    saveLocalEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveLocalWordBank(wordBank);
  }, [wordBank]);

  useEffect(() => {
    saveLocalStats(stats);
  }, [stats]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOZE_SETTING_KEY, String(clozeMode));
    } catch {}
  }, [clozeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_AUDIO_SETTING_KEY, String(autoPlayAudio));
    } catch {}
  }, [autoPlayAudio]);

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

  // Submit a new journal entry -> Gemini translates to vocalized Fusha & updates Word Bank
  const handleSubmitJournalEntry = useCallback(
    async (text: string): Promise<JournalEntry> => {
      const geminiResult = await translateJournalToFusha(text);
      const nowIso = new Date().toISOString();
      const entryId = `entry_${Date.now()}`;
      const currentUserId = user?.uid || 'local_user';

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
          root: raw.root,
          partOfSpeech: raw.partOfSpeech,
          contextSentenceArabic:
            raw.contextSentenceArabic || geminiResult.fullArabicTranslation,
          contextSentenceEnglish: raw.contextSentenceEnglish || text,
          visualKeyword: raw.visualKeyword ?? null,
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

      const todayStr = nowIso.slice(0, 10);
      const nextStreak =
        stats.totalEntries === 0
          ? 1
          : stats.lastJournalDate === todayStr
          ? Math.max(1, stats.currentStreak)
          : stats.currentStreak + 1;

      const nextStats: UserStats = {
        ...stats,
        userId: currentUserId,
        currentStreak: nextStreak,
        longestStreak: Math.max(stats.longestStreak, nextStreak),
        totalEntries: entries.length + 1,
        totalWordsEncountered: nextWordBank.length,
        masteredWordsCount: masteredCount,
        lastJournalDate: todayStr,
        updatedAt: nowIso,
      };

      setEntries((prev) => [newEntry, ...prev]);
      setWordBank(nextWordBank);
      setStats(nextStats);
      setActiveEntryId(entryId);
      setIsWritingMode(false);

      if (user) {
        saveJournalEntryToFirestore(newEntry).catch(() => {});
        for (const { item, isNew } of updatedWordsToPersist) {
          saveWordBankItemToFirestore(item, isNew).catch(() => {});
        }
        saveUserStatsToFirestore(nextStats).catch(() => {});
      }

      return newEntry;
    },
    [user, wordBank, stats, entries.length]
  );

  // Handle completing a Contextual Flashcard review
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
          message: `"${target.arabicWord}" reached 20/20 Mastery!`,
        });
      }
    },
    [wordBank, stats, user]
  );

  const handleToggleMasteryInBank = useCallback(
    (wordId: string) => {
      const target = wordBank.find((w) => w.id === wordId);
      if (!target) return;
      const currentlyMastered = isWordMastered(target);
      const updated: WordBankItem = {
        ...target,
        usageCount: currentlyMastered ? 1 : Math.max(20, target.usageCount),
        reviewCount: currentlyMastered ? 1 : Math.max(20, target.reviewCount),
        isMastered: !currentlyMastered,
        updatedAt: new Date().toISOString(),
      };
      setWordBank((prev) => prev.map((w) => (w.id === wordId ? updated : w)));
      if (user) {
        saveWordBankItemToFirestore(updated, false).catch(() => {});
      }
    },
    [wordBank, user]
  );

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      const remaining = entries.filter((e) => e.id !== entryId);
      setEntries(remaining);
      if (activeEntryId === entryId) {
        setActiveEntryId(remaining[0]?.id ?? null);
        if (remaining.length === 0) {
          setIsWritingMode(true);
        }
      }
      if (user) {
        deleteJournalEntryFromFirestore(entryId).catch(() => {});
      }
    },
    [activeEntryId, entries, user]
  );

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      setNotification({
        type: 'success',
        message: 'Signed in.',
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error?.message || 'Sign-in cancelled.',
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
          message: 'Account created.',
        });
      } else {
        await signInWithEmail(email, password);
        setNotification({
          type: 'success',
          message: 'Signed in.',
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
            clozeMode={clozeMode}
            autoPlayAudio={autoPlayAudio}
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
            clozeMode={clozeMode}
            onToggleClozeMode={setClozeMode}
            autoPlayAudio={autoPlayAudio}
            onToggleAutoPlayAudio={setAutoPlayAudio}
            onGoogleSignIn={handleGoogleSignIn}
            onEmailAuth={handleEmailAuth}
            onSignOut={handleSignOut}
          />
        )}
      </main>
    </div>
  );
};

export default App;
