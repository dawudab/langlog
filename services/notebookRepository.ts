import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  JournalEntry,
  UserStats,
  WordBankItem,
  WordToken,
  isWordMastered,
  normalizeArabicToken,
} from '../types';

const LOCAL_ENTRIES_KEY = 'fusha_notebook_entries_v4';
const LOCAL_WORDBANK_KEY = 'fusha_notebook_wordbank_v4';
const LOCAL_STATS_KEY = 'fusha_notebook_stats_v4';

function toSafeDocId(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `doc_${Date.now()}`;
}

function hashArabicToId(normalized: string): string {
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `word_${Math.abs(hash)}`;
}

const EMPTY_STATS: UserStats = {
  userId: 'local_user',
  currentStreak: 0,
  longestStreak: 0,
  totalEntries: 0,
  totalWordsEncountered: 0,
  totalReviewsCompleted: 0,
  masteredWordsCount: 0,
  lastJournalDate: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString(),
};

export function loadLocalEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to persist local entries:', err);
  }
}

export function loadLocalWordBank(): WordBankItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_WORDBANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalWordBank(words: WordBankItem[]): void {
  try {
    localStorage.setItem(LOCAL_WORDBANK_KEY, JSON.stringify(words));
  } catch (err) {
    console.error('Failed to persist local word bank:', err);
  }
}

export function loadLocalStats(): UserStats {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    if (!raw) return EMPTY_STATS;
    return JSON.parse(raw) as UserStats;
  } catch {
    return EMPTY_STATS;
  }
}

export function saveLocalStats(stats: UserStats): void {
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error('Failed to persist local stats:', err);
  }
}

export function getWordIdForNormalized(normalizedWord: string): string {
  const clean = normalizeArabicToken(normalizedWord);
  return hashArabicToId(clean || normalizedWord);
}

/**
 * Silent Cloud Firestore Persistence
 */
export async function saveJournalEntryToFirestore(
  entry: JournalEntry
): Promise<void> {
  const docId = toSafeDocId(entry.id);
  const path = `journalEntries/${docId}`;
  try {
    const sanitizedTokens = (entry.tokens || []).slice(0, 350).map((t) => ({
      arabicWord: String(t.arabicWord || '').slice(0, 200),
      normalizedWord: String(t.normalizedWord || '').slice(0, 200),
      englishMeaning: String(t.englishMeaning || '').slice(0, 500),
      root: String(t.root || '—').slice(0, 100),
      partOfSpeech: String(t.partOfSpeech || 'word').slice(0, 64),
      contextSentenceArabic: String(t.contextSentenceArabic || '').slice(
        0,
        1500
      ),
      contextSentenceEnglish: String(t.contextSentenceEnglish || '').slice(
        0,
        1500
      ),
      visualKeyword: t.visualKeyword
        ? String(t.visualKeyword).slice(0, 300)
        : '',
      usageCount: Math.max(0, Number(t.usageCount) || 1),
      reviewCount: Math.max(0, Number(t.reviewCount) || 0),
    }));

    await setDoc(doc(db, 'journalEntries', docId), {
      userId: entry.userId,
      originalText: entry.originalText.slice(0, 10000),
      fullArabicTranslation: entry.fullArabicTranslation.slice(0, 15000),
      tokens: sanitizedTokens,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveWordBankItemToFirestore(
  word: WordBankItem,
  isNewDoc: boolean
): Promise<void> {
  const docId = toSafeDocId(word.id);
  const path = `wordBank/${docId}`;
  const usageCount = Math.max(
    0,
    Math.min(100000, Math.round(word.usageCount))
  );
  const reviewCount = Math.max(
    0,
    Math.min(100000, Math.round(word.reviewCount))
  );
  const mastered = isWordMastered({ usageCount, reviewCount });

  try {
    const payload: Record<string, unknown> = {
      userId: word.userId,
      arabicWord: (word.arabicWord || '—').slice(0, 200),
      normalizedWord: (word.normalizedWord || word.arabicWord || '—').slice(
        0,
        200
      ),
      englishMeaning: (word.englishMeaning || '—').slice(0, 500),
      root: (word.root || '—').slice(0, 100),
      partOfSpeech: (word.partOfSpeech || 'word').slice(0, 64),
      contextSentenceArabic: (
        word.contextSentenceArabic ||
        word.arabicWord ||
        '—'
      ).slice(0, 1500),
      contextSentenceEnglish: (
        word.contextSentenceEnglish ||
        word.englishMeaning ||
        '—'
      ).slice(0, 1500),
      visualKeyword: word.visualKeyword
        ? word.visualKeyword.slice(0, 300)
        : '',
      usageCount,
      reviewCount,
      isMastered: mastered,
      updatedAt: serverTimestamp(),
    };

    if (isNewDoc) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(doc(db, 'wordBank', docId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserStatsToFirestore(
  stats: UserStats
): Promise<void> {
  const docId = toSafeDocId(stats.userId);
  const path = `userStats/${docId}`;
  try {
    await setDoc(
      doc(db, 'userStats', docId),
      {
        userId: stats.userId,
        currentStreak: Math.max(0, Math.round(stats.currentStreak)),
        longestStreak: Math.max(0, Math.round(stats.longestStreak)),
        totalEntries: Math.max(0, Math.round(stats.totalEntries)),
        totalWordsEncountered: Math.max(
          0,
          Math.round(stats.totalWordsEncountered)
        ),
        totalReviewsCompleted: Math.max(
          0,
          Math.round(stats.totalReviewsCompleted)
        ),
        masteredWordsCount: Math.max(0, Math.round(stats.masteredWordsCount)),
        lastJournalDate: (stats.lastJournalDate || '2026-11-06').slice(0, 32),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteJournalEntryFromFirestore(
  entryId: string
): Promise<void> {
  const docId = toSafeDocId(entryId);
  const path = `journalEntries/${docId}`;
  try {
    await deleteDoc(doc(db, 'journalEntries', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function subscribeToNotebookFirestore(
  userId: string,
  onEntries: (entries: JournalEntry[]) => void,
  onWords: (words: WordBankItem[]) => void
): () => void {
  const entriesQuery = query(
    collection(db, 'journalEntries'),
    where('userId', '==', userId)
  );
  const wordsQuery = query(
    collection(db, 'wordBank'),
    where('userId', '==', userId)
  );

  const unsubEntries = onSnapshot(
    entriesQuery,
    (snapshot) => {
      const loaded: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: String(d.userId || userId),
          originalText: String(d.originalText || ''),
          fullArabicTranslation: String(d.fullArabicTranslation || ''),
          tokens: Array.isArray(d.tokens) ? (d.tokens as WordToken[]) : [],
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
        };
      });
      onEntries(loaded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journalEntries');
    }
  );

  const unsubWords = onSnapshot(
    wordsQuery,
    (snapshot) => {
      const loaded: WordBankItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const usageCount = Number(d.usageCount ?? 1);
        const reviewCount = Number(d.reviewCount ?? 0);
        const rawVisual = String(d.visualKeyword || '').trim();
        return {
          id: docSnap.id,
          userId: String(d.userId || userId),
          arabicWord: String(d.arabicWord || ''),
          normalizedWord: String(d.normalizedWord || ''),
          englishMeaning: String(d.englishMeaning || ''),
          root: String(d.root || '—'),
          partOfSpeech: String(d.partOfSpeech || 'word'),
          contextSentenceArabic: String(d.contextSentenceArabic || ''),
          contextSentenceEnglish: String(d.contextSentenceEnglish || ''),
          visualKeyword: rawVisual ? rawVisual : null,
          usageCount,
          reviewCount,
          isMastered: isWordMastered({ usageCount, reviewCount }),
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
        };
      });
      onWords(loaded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wordBank');
    }
  );

  return () => {
    unsubEntries();
    unsubWords();
  };
}
