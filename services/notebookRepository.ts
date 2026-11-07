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
import {
  db,
  handleFirestoreError,
  formatFirestoreErrorInfo,
  OperationType,
} from '../firebase';
import {
  JournalEntry,
  UserStats,
  WordBankItem,
  WordToken,
  isWordMastered,
  normalizeArabicToken,
  getArabicLookupKeys,
  lookupFushaLexiconFallback,
} from '../types';

const LOCAL_ENTRIES_KEY = 'fusha_notebook_entries_v4';
const LOCAL_WORDBANK_KEY = 'fusha_notebook_wordbank_v4';
const LOCAL_STATS_KEY = 'fusha_notebook_stats_v4';

const LEGACY_ENTRIES_KEYS = [
  'fusha_notebook_entries_v3',
  'fusha_notebook_entries_v2',
  'fusha_notebook_entries_v1',
];

const LEGACY_WORDBANK_KEYS = [
  'fusha_notebook_wordbank_v3',
  'fusha_notebook_wordbank_v2',
  'fusha_notebook_wordbank_v1',
];

const knownRemoteEntryIds = new Set<string>();
const knownRemoteWordIds = new Set<string>();
const knownRemoteStatsIds = new Set<string>();

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

export function getWordIdForNormalized(normalizedWord: string): string {
  const clean = normalizeArabicToken(normalizedWord);
  return hashArabicToId(clean || normalizedWord);
}

const STARTER_ENTRIES: JournalEntry[] = [
  {
    id: 'entry_starter_dawn',
    userId: 'local_user',
    originalText:
      'I went to the mosque at dawn and read the Noble Quran in tranquility, then I drank coffee and wrote my thoughts in the notebook.',
    fullArabicTranslation:
      'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ، ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
    tokens: [
      {
        arabicWord: 'ذَهَبْتُ',
        normalizedWord: 'ذهب',
        englishMeaning: 'I went',
        root: 'ذ ه ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: null,
        usageCount: 3,
        reviewCount: 4,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'إِلَى',
        normalizedWord: 'الي',
        englishMeaning: 'to',
        root: 'إ ل ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: null,
        usageCount: 22,
        reviewCount: 21,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'الْمَسْجِدِ',
        normalizedWord: 'مسجد',
        englishMeaning: 'the mosque',
        root: 'س ج د',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: 'mosque',
        usageCount: 5,
        reviewCount: 8,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'فَجْرًا',
        normalizedWord: 'فجر',
        englishMeaning: 'at dawn',
        root: 'ف ج ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: null,
        usageCount: 2,
        reviewCount: 3,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'وَقَرَأْتُ',
        normalizedWord: 'قرأ',
        englishMeaning: 'and I read',
        root: 'ق ر أ',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
        visualKeyword: 'book',
        usageCount: 4,
        reviewCount: 6,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'الْقُرْآنَ',
        normalizedWord: 'قران',
        englishMeaning: 'the Quran',
        root: 'ق ر أ',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
        visualKeyword: 'book',
        usageCount: 6,
        reviewCount: 9,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'الْكَرِيمَ',
        normalizedWord: 'كريم',
        englishMeaning: 'the Noble',
        root: 'ك ر م',
        partOfSpeech: 'adjective',
        contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
        visualKeyword: null,
        usageCount: 2,
        reviewCount: 2,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
        visualKeyword: null,
        usageCount: 25,
        reviewCount: 22,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'سَكِينَةٍ',
        normalizedWord: 'سكينة',
        englishMeaning: 'tranquility',
        root: 'س ك ن',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
        visualKeyword: null,
        usageCount: 1,
        reviewCount: 2,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'ثُمَّ',
        normalizedWord: 'ثم',
        englishMeaning: 'then',
        root: 'ث م م',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: null,
        usageCount: 3,
        reviewCount: 2,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'شَرِبْتُ',
        normalizedWord: 'شرب',
        englishMeaning: 'I drank',
        root: 'ش ر ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: 'coffee',
        usageCount: 4,
        reviewCount: 5,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'الْقَهْوَةَ',
        normalizedWord: 'قهوة',
        englishMeaning: 'the coffee',
        root: 'ق ه و',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: 'coffee',
        usageCount: 7,
        reviewCount: 11,
        isPreviouslyUsed: true,
      },
      {
        arabicWord: 'وَكَتَبْتُ',
        normalizedWord: 'كتب',
        englishMeaning: 'and I wrote',
        root: 'ك ت ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: 'notebook',
        usageCount: 3,
        reviewCount: 4,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'أَفْكَارِي',
        normalizedWord: 'افكاري',
        englishMeaning: 'my thoughts',
        root: 'ف ك ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: null,
        usageCount: 1,
        reviewCount: 1,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'الدَّفْتَرِ.',
        normalizedWord: 'دفتر',
        englishMeaning: 'the notebook',
        root: 'د ف ت ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ثُمَّ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'Then I drank coffee and wrote my thoughts in the notebook.',
        visualKeyword: 'notebook',
        usageCount: 5,
        reviewCount: 7,
        isPreviouslyUsed: true,
      },
    ],
    createdAt: '2026-11-06T08:00:00.000Z',
    updatedAt: '2026-11-06T08:00:00.000Z',
  },
];

function buildWordBankFromEntries(entries: JournalEntry[]): WordBankItem[] {
  const map = new Map<string, WordBankItem>();
  const nowIso = new Date().toISOString();

  entries.forEach((entry) => {
    (entry.tokens || []).forEach((t) => {
      const cleanNorm =
        normalizeArabicToken(t.normalizedWord) ||
        normalizeArabicToken(t.arabicWord);
      if (!cleanNorm) return;

      const fallback = lookupFushaLexiconFallback(t.arabicWord, cleanNorm);
      const meaning =
        t.englishMeaning && t.englishMeaning !== '—'
          ? t.englishMeaning
          : fallback?.englishMeaning || 'word';
      const root =
        t.root && t.root !== '—'
          ? t.root
          : fallback?.root || cleanNorm.split('').slice(0, 3).join(' ');
      const pos =
        t.partOfSpeech && t.partOfSpeech !== 'word'
          ? t.partOfSpeech
          : fallback?.partOfSpeech || 'noun';

      const existing = map.get(cleanNorm);
      const usageCount = Math.max(existing?.usageCount ?? 0, t.usageCount || 1);
      const reviewCount = Math.max(
        existing?.reviewCount ?? 0,
        t.reviewCount || 0
      );

      map.set(cleanNorm, {
        id: existing?.id || getWordIdForNormalized(cleanNorm),
        userId: entry.userId || 'local_user',
        arabicWord: t.arabicWord.replace(/[.,،؛؟!":«»()[\]]/g, '').trim() || t.arabicWord,
        normalizedWord: cleanNorm,
        englishMeaning: meaning,
        root,
        partOfSpeech: pos,
        contextSentenceArabic:
          t.contextSentenceArabic || entry.fullArabicTranslation,
        contextSentenceEnglish: t.contextSentenceEnglish || entry.originalText,
        visualKeyword:
          t.visualKeyword ?? existing?.visualKeyword ?? fallback?.visualKeyword ?? null,
        usageCount,
        reviewCount,
        isMastered: isWordMastered({ usageCount, reviewCount }),
        createdAt: existing?.createdAt || entry.createdAt || nowIso,
        updatedAt: nowIso,
      });
    });
  });

  return Array.from(map.values());
}

/**
 * Repairs any entries whose tokens have missing or placeholder "—" meanings/roots
 */
function repairEntriesList(entries: JournalEntry[]): JournalEntry[] {
  const knownMeaningByKey = new Map<
    string,
    { englishMeaning: string; root: string; partOfSpeech: string; visualKeyword: string | null }
  >();

  // Collect valid meanings across all entries first
  entries.forEach((entry) => {
    (entry.tokens || []).forEach((t) => {
      if (t.englishMeaning && t.englishMeaning !== '—') {
        const info = {
          englishMeaning: t.englishMeaning,
          root: t.root && t.root !== '—' ? t.root : '',
          partOfSpeech:
            t.partOfSpeech && t.partOfSpeech !== 'word' ? t.partOfSpeech : 'noun',
          visualKeyword: t.visualKeyword ?? null,
        };
        for (const k of [
          ...getArabicLookupKeys(t.arabicWord),
          ...getArabicLookupKeys(t.normalizedWord),
        ]) {
          if (!knownMeaningByKey.has(k)) {
            knownMeaningByKey.set(k, info);
          }
        }
      }
    });
  });

  return entries.map((entry) => ({
    ...entry,
    tokens: (entry.tokens || []).map((t) => {
      const lookupKeys = [
        ...getArabicLookupKeys(t.arabicWord),
        ...getArabicLookupKeys(t.normalizedWord),
      ];
      let found: {
        englishMeaning: string;
        root: string;
        partOfSpeech: string;
        visualKeyword: string | null;
      } | null = null;

      for (const k of lookupKeys) {
        const candidate = knownMeaningByKey.get(k);
        if (candidate) {
          found = candidate;
          break;
        }
      }

      const lexicon = lookupFushaLexiconFallback(t.arabicWord, t.normalizedWord);
      const cleanNorm =
        normalizeArabicToken(t.normalizedWord) ||
        normalizeArabicToken(t.arabicWord);

      return {
        ...t,
        normalizedWord: cleanNorm || t.normalizedWord,
        englishMeaning:
          t.englishMeaning && t.englishMeaning !== '—'
            ? t.englishMeaning
            : found?.englishMeaning || lexicon?.englishMeaning || 'word',
        root:
          t.root && t.root !== '—'
            ? t.root
            : found?.root ||
              lexicon?.root ||
              cleanNorm.split('').slice(0, 3).join(' '),
        partOfSpeech:
          t.partOfSpeech && t.partOfSpeech !== 'word'
            ? t.partOfSpeech
            : found?.partOfSpeech || lexicon?.partOfSpeech || 'noun',
        visualKeyword:
          t.visualKeyword ?? found?.visualKeyword ?? lexicon?.visualKeyword ?? null,
      };
    }),
  }));
}

/**
 * Repairs and deduplicates WordBankItems so no item has "—" for meaning or root.
 */
function repairWordBankList(
  words: WordBankItem[],
  entries: JournalEntry[]
): WordBankItem[] {
  const fromEntries = buildWordBankFromEntries(entries);
  const entryLookup = new Map<string, WordBankItem>();
  fromEntries.forEach((w) => {
    for (const k of [
      ...getArabicLookupKeys(w.normalizedWord),
      ...getArabicLookupKeys(w.arabicWord),
    ]) {
      if (!entryLookup.has(k)) entryLookup.set(k, w);
    }
  });

  const mergedMap = new Map<string, WordBankItem>();

  const upsertItem = (item: WordBankItem) => {
    const cleanArab =
      item.arabicWord.replace(/[.,،؛؟!":«»()[\]]/g, '').trim() ||
      item.arabicWord;
    const keys = [
      ...getArabicLookupKeys(item.normalizedWord),
      ...getArabicLookupKeys(cleanArab),
    ];
    let matchedFromEntry: WordBankItem | undefined;
    for (const k of keys) {
      if (entryLookup.has(k)) {
        matchedFromEntry = entryLookup.get(k);
        break;
      }
    }

    const lexicon = lookupFushaLexiconFallback(cleanArab, item.normalizedWord);
    const canonicalNorm =
      matchedFromEntry?.normalizedWord ||
      keys.find((k) => k.length >= 2) ||
      normalizeArabicToken(item.normalizedWord) ||
      normalizeArabicToken(cleanArab);

    const validMeaning =
      item.englishMeaning && item.englishMeaning !== '—'
        ? item.englishMeaning
        : matchedFromEntry?.englishMeaning || lexicon?.englishMeaning || 'word';

    const validRoot =
      item.root && item.root !== '—'
        ? item.root
        : matchedFromEntry?.root ||
          lexicon?.root ||
          canonicalNorm.split('').slice(0, 3).join(' ');

    const validPos =
      item.partOfSpeech && item.partOfSpeech !== 'word'
        ? item.partOfSpeech
        : matchedFromEntry?.partOfSpeech || lexicon?.partOfSpeech || 'noun';

    const existing = mergedMap.get(canonicalNorm);
    const usageCount = Math.max(
      existing?.usageCount ?? 0,
      item.usageCount || 1
    );
    const reviewCount = Math.max(
      existing?.reviewCount ?? 0,
      item.reviewCount || 0
    );

    mergedMap.set(canonicalNorm, {
      ...item,
      id: existing?.id || getWordIdForNormalized(canonicalNorm),
      arabicWord:
        existing && existing.englishMeaning !== '—'
          ? existing.arabicWord
          : cleanArab,
      normalizedWord: canonicalNorm,
      englishMeaning:
        existing &&
        existing.englishMeaning &&
        existing.englishMeaning !== '—' &&
        existing.englishMeaning !== 'word'
          ? existing.englishMeaning
          : validMeaning,
      root:
        existing && existing.root && existing.root !== '—'
          ? existing.root
          : validRoot,
      partOfSpeech:
        existing &&
        existing.partOfSpeech &&
        existing.partOfSpeech !== 'word'
          ? existing.partOfSpeech
          : validPos,
      visualKeyword:
        item.visualKeyword ??
        existing?.visualKeyword ??
        matchedFromEntry?.visualKeyword ??
        lexicon?.visualKeyword ??
        null,
      usageCount,
      reviewCount,
      isMastered: isWordMastered({ usageCount, reviewCount }),
    });
  };

  words.forEach(upsertItem);
  fromEntries.forEach(upsertItem);

  return Array.from(mergedMap.values());
}

const DEFAULT_STARTER_WORDS = buildWordBankFromEntries(STARTER_ENTRIES);

const EMPTY_STATS: UserStats = {
  userId: 'local_user',
  currentStreak: 1,
  longestStreak: 1,
  totalEntries: STARTER_ENTRIES.length,
  totalWordsEncountered: DEFAULT_STARTER_WORDS.length,
  totalReviewsCompleted: 12,
  masteredWordsCount: DEFAULT_STARTER_WORDS.filter((w) => isWordMastered(w))
    .length,
  lastJournalDate: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString(),
};

export function loadLocalEntries(): JournalEntry[] {
  try {
    let raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_ENTRIES_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          raw = legacyRaw;
          break;
        }
      }
    }
    if (!raw) {
      saveLocalEntries(STARTER_ENTRIES);
      return STARTER_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveLocalEntries(STARTER_ENTRIES);
      return STARTER_ENTRIES;
    }
    const repaired = repairEntriesList(parsed);
    return repaired;
  } catch {
    return STARTER_ENTRIES;
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
    const entries = loadLocalEntries();
    let raw = localStorage.getItem(LOCAL_WORDBANK_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_WORDBANK_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          raw = legacyRaw;
          break;
        }
      }
    }
    if (!raw) {
      const seeded = buildWordBankFromEntries(entries);
      saveLocalWordBank(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = buildWordBankFromEntries(entries);
      saveLocalWordBank(seeded);
      return seeded;
    }
    const repaired = repairWordBankList(parsed, entries);
    saveLocalWordBank(repaired);
    return repaired;
  } catch {
    return DEFAULT_STARTER_WORDS;
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

/**
 * Silent Cloud Firestore Persistence
 */
export async function saveJournalEntryToFirestore(
  entry: JournalEntry
): Promise<void> {
  const docId = toSafeDocId(entry.id);
  const path = `journalEntries/${docId}`;
  const isExistingRemote = knownRemoteEntryIds.has(docId);

  try {
    const sanitizedTokens = (entry.tokens || []).slice(0, 350).map((t) => ({
      arabicWord: String(t.arabicWord || '').slice(0, 200),
      normalizedWord: String(t.normalizedWord || '').slice(0, 200),
      englishMeaning: String(t.englishMeaning || 'word').slice(0, 500),
      root: String(t.root || '—').slice(0, 100),
      partOfSpeech: String(t.partOfSpeech || 'noun').slice(0, 64),
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

    const payload: Record<string, unknown> = {
      userId: entry.userId,
      originalText: entry.originalText.slice(0, 10000),
      fullArabicTranslation: entry.fullArabicTranslation.slice(0, 15000),
      tokens: sanitizedTokens,
      updatedAt: serverTimestamp(),
    };

    if (!isExistingRemote) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(doc(db, 'journalEntries', docId), payload, { merge: true });
    knownRemoteEntryIds.add(docId);
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
  const shouldIncludeCreatedAt = isNewDoc || !knownRemoteWordIds.has(docId);

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
      englishMeaning: (word.englishMeaning || 'word').slice(0, 500),
      root: (word.root || '—').slice(0, 100),
      partOfSpeech: (word.partOfSpeech || 'noun').slice(0, 64),
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

    if (shouldIncludeCreatedAt) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(doc(db, 'wordBank', docId), payload, { merge: true });
    knownRemoteWordIds.add(docId);
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
    knownRemoteStatsIds.add(docId);
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
    knownRemoteEntryIds.delete(docId);
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
        knownRemoteEntryIds.add(docSnap.id);
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
      onEntries(repairEntriesList(loaded));
    },
    (error) => {
      const info = formatFirestoreErrorInfo(
        error,
        OperationType.LIST,
        'journalEntries'
      );
      console.warn('Firestore listener notice:', JSON.stringify(info));
    }
  );

  const unsubWords = onSnapshot(
    wordsQuery,
    (snapshot) => {
      const loaded: WordBankItem[] = snapshot.docs.map((docSnap) => {
        knownRemoteWordIds.add(docSnap.id);
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
          partOfSpeech: String(d.partOfSpeech || 'noun'),
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
      const info = formatFirestoreErrorInfo(
        error,
        OperationType.LIST,
        'wordBank'
      );
      console.warn('Firestore listener notice:', JSON.stringify(info));
    }
  );

  return () => {
    unsubEntries();
    unsubWords();
  };
}
