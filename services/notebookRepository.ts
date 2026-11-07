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

const LOCAL_ENTRIES_KEY = 'fusha_notebook_entries_v2';
const LOCAL_WORDBANK_KEY = 'fusha_notebook_wordbank_v2';
const LOCAL_STATS_KEY = 'fusha_notebook_stats_v2';

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

const SEED_WORD_BANK: WordBankItem[] = [
  {
    id: 'word_masjid',
    userId: 'local_user',
    arabicWord: 'الْمَسْجِدِ',
    normalizedWord: 'مسجد',
    englishMeaning: 'the mosque',
    transliteration: 'al-masjidi',
    root: 'س ج د',
    partOfSpeech: 'noun',
    contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
    contextSentenceEnglish: 'I went to the mosque at dawn.',
    visualKeyword: 'mosque dawn peaceful architecture',
    usageCount: 21,
    reviewCount: 22,
    isMastered: true, // 20/20 Mastered -> English hidden in interlinear view!
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'word_fi',
    userId: 'local_user',
    arabicWord: 'فِي',
    normalizedWord: 'في',
    englishMeaning: 'in',
    transliteration: 'fī',
    root: 'ف ي',
    partOfSpeech: 'particle',
    contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ.',
    contextSentenceEnglish: 'In the early morning I drank coffee.',
    visualKeyword: 'garden olive trees peaceful courtyard',
    usageCount: 25,
    reviewCount: 24,
    isMastered: true, // 20/20 Mastered -> English hidden in interlinear view!
    createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'word_qahwah',
    userId: 'local_user',
    arabicWord: 'الْقَهْوَةَ',
    normalizedWord: 'قهوة',
    englishMeaning: 'the coffee',
    transliteration: 'al-qahwata',
    root: 'ق ه و',
    partOfSpeech: 'noun',
    contextSentenceArabic:
      'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ.',
    contextSentenceEnglish: 'In the early morning I drank Arabic coffee.',
    visualKeyword: 'morning coffee notebook sunlit window',
    usageCount: 20,
    reviewCount: 19, // 1 review away from 20/20 Mastery!
    isMastered: false,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'word_fajr',
    userId: 'local_user',
    arabicWord: 'فَجْرًا',
    normalizedWord: 'فجر',
    englishMeaning: 'at dawn',
    transliteration: 'fajran',
    root: 'ف ج ر',
    partOfSpeech: 'noun',
    contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
    contextSentenceEnglish: 'I went to the mosque at dawn.',
    visualKeyword: 'mosque dawn peaceful architecture',
    usageCount: 8,
    reviewCount: 12,
    isMastered: false,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'word_sakinah',
    userId: 'local_user',
    arabicWord: 'سَكِينَةٍ',
    normalizedWord: 'سكينة',
    englishMeaning: 'tranquility / serenity',
    transliteration: 'sakīnatin',
    root: 'س ك ن',
    partOfSpeech: 'noun',
    contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
    contextSentenceEnglish: 'And I recited the Noble Quran in tranquility.',
    visualKeyword: 'garden olive trees peaceful courtyard',
    usageCount: 6,
    reviewCount: 9,
    isMastered: false,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
  },
  {
    id: 'word_daftar',
    userId: 'local_user',
    arabicWord: 'دَفْتَرِ',
    normalizedWord: 'دفتر',
    englishMeaning: 'notebook',
    transliteration: 'daftari',
    root: 'د ف ت ر',
    partOfSpeech: 'noun',
    contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
    contextSentenceEnglish: 'And I wrote my thoughts in the journal notebook.',
    visualKeyword: 'morning coffee notebook sunlit window',
    usageCount: 14,
    reviewCount: 16,
    isMastered: false,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'word_qaratu',
    userId: 'local_user',
    arabicWord: 'وَقَرَأْتُ',
    normalizedWord: 'قرأت',
    englishMeaning: 'and I recited / read',
    transliteration: 'wa-qara’tu',
    root: 'ق ر أ',
    partOfSpeech: 'verb',
    contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
    contextSentenceEnglish: 'And I recited the Noble Quran in tranquility.',
    visualKeyword: 'library books calligraphy manuscript',
    usageCount: 11,
    reviewCount: 14,
    isMastered: false,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 9).toISOString(),
  },
];

const SEED_ENTRIES: JournalEntry[] = [
  {
    id: 'entry_seed_dawn',
    userId: 'local_user',
    originalText:
      'I went to the mosque at dawn and recited the Noble Quran in tranquility and quietude.',
    fullArabicTranslation:
      'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
    tokens: [
      {
        arabicWord: 'ذَهَبْتُ',
        normalizedWord: 'ذهبت',
        englishMeaning: 'I went',
        transliteration: 'dhahabtu',
        root: 'ذ ه ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: 'mosque dawn peaceful architecture',
        usageCount: 9,
        reviewCount: 10,
      },
      {
        arabicWord: 'إِلَى',
        normalizedWord: 'الى',
        englishMeaning: 'to',
        transliteration: 'ilā',
        root: 'إ ل ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: 'mosque dawn peaceful architecture',
        usageCount: 18,
        reviewCount: 15,
      },
      {
        arabicWord: 'الْمَسْجِدِ',
        normalizedWord: 'مسجد',
        englishMeaning: 'the mosque',
        transliteration: 'al-masjidi',
        root: 'س ج د',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: 'mosque dawn peaceful architecture',
        usageCount: 21,
        reviewCount: 22,
      },
      {
        arabicWord: 'فَجْرًا',
        normalizedWord: 'فجر',
        englishMeaning: 'at dawn',
        transliteration: 'fajran',
        root: 'ف ج ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
        contextSentenceEnglish: 'I went to the mosque at dawn.',
        visualKeyword: 'mosque dawn peaceful architecture',
        usageCount: 8,
        reviewCount: 12,
      },
      {
        arabicWord: 'وَقَرَأْتُ',
        normalizedWord: 'قرأت',
        englishMeaning: 'and I recited',
        transliteration: 'wa-qara’tu',
        root: 'ق ر أ',
        partOfSpeech: 'verb',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility.',
        visualKeyword: 'library books calligraphy manuscript',
        usageCount: 11,
        reviewCount: 14,
      },
      {
        arabicWord: 'الْقُرْآنَ',
        normalizedWord: 'قران',
        englishMeaning: 'the Quran',
        transliteration: 'al-Qur’āna',
        root: 'ق ر أ',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility.',
        visualKeyword: 'library books calligraphy manuscript',
        usageCount: 15,
        reviewCount: 17,
      },
      {
        arabicWord: 'الْكَرِيمَ',
        normalizedWord: 'كريم',
        englishMeaning: 'the Noble',
        transliteration: 'al-karīma',
        root: 'ك ر م',
        partOfSpeech: 'adjective',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility.',
        visualKeyword: 'library books calligraphy manuscript',
        usageCount: 7,
        reviewCount: 8,
      },
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        transliteration: 'fī',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility and quietude.',
        visualKeyword: 'garden olive trees peaceful courtyard',
        usageCount: 25,
        reviewCount: 24,
      },
      {
        arabicWord: 'سَكِينَةٍ',
        normalizedWord: 'سكينة',
        englishMeaning: 'tranquility',
        transliteration: 'sakīnatin',
        root: 'س ك ن',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility and quietude.',
        visualKeyword: 'garden olive trees peaceful courtyard',
        usageCount: 6,
        reviewCount: 9,
      },
      {
        arabicWord: 'وَهُدُوءٍ.',
        normalizedWord: 'هدوء',
        englishMeaning: 'and quietude',
        transliteration: 'wa-hudū’in',
        root: 'ه د أ',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
        contextSentenceEnglish:
          'And I recited the Noble Quran in tranquility and quietude.',
        visualKeyword: 'garden olive trees peaceful courtyard',
        usageCount: 4,
        reviewCount: 5,
      },
    ],
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'entry_seed_coffee',
    userId: 'local_user',
    originalText:
      'In the early morning I drank Arabic coffee and wrote my thoughts in my daily journal.',
    fullArabicTranslation:
      'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
    tokens: [
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        transliteration: 'fī',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the early morning I drank coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 25,
        reviewCount: 24,
      },
      {
        arabicWord: 'الصَّبَاحِ',
        normalizedWord: 'صباح',
        englishMeaning: 'the morning',
        transliteration: 'aṣ-ṣabāḥi',
        root: 'ص ب ح',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the early morning I drank coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 12,
        reviewCount: 14,
      },
      {
        arabicWord: 'الْبَاكِرِ',
        normalizedWord: 'باكر',
        englishMeaning: 'the early',
        transliteration: 'al-bākiri',
        root: 'ب ك ر',
        partOfSpeech: 'adjective',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the early morning I drank coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 5,
        reviewCount: 7,
      },
      {
        arabicWord: 'شَرِبْتُ',
        normalizedWord: 'شربت',
        englishMeaning: 'I drank',
        transliteration: 'sharibtu',
        root: 'ش ر ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the early morning I drank coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 9,
        reviewCount: 11,
      },
      {
        arabicWord: 'الْقَهْوَةَ',
        normalizedWord: 'قهوة',
        englishMeaning: 'the coffee',
        transliteration: 'al-qahwata',
        root: 'ق ه و',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ.',
        contextSentenceEnglish: 'In the early morning I drank Arabic coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 20,
        reviewCount: 19,
      },
      {
        arabicWord: 'الْعَرَبِيَّةَ',
        normalizedWord: 'عربية',
        englishMeaning: 'the Arabic',
        transliteration: 'al-‘arabiyyata',
        root: 'ع ر ب',
        partOfSpeech: 'adjective',
        contextSentenceArabic: 'شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ.',
        contextSentenceEnglish: 'I drank Arabic coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 16,
        reviewCount: 15,
      },
      {
        arabicWord: 'وَكَتَبْتُ',
        normalizedWord: 'كتبت',
        englishMeaning: 'and I wrote',
        transliteration: 'wa-katabtu',
        root: 'ك ت ب',
        partOfSpeech: 'verb',
        contextSentenceArabic:
          'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish:
          'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'library books calligraphy manuscript',
        usageCount: 13,
        reviewCount: 12,
      },
      {
        arabicWord: 'أَفْكَارِي',
        normalizedWord: 'افكاري',
        englishMeaning: 'my thoughts',
        transliteration: 'afkārī',
        root: 'ف ك ر',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish:
          'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'library books calligraphy manuscript',
        usageCount: 7,
        reviewCount: 9,
      },
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        transliteration: 'fī',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic:
          'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish:
          'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 25,
        reviewCount: 24,
      },
      {
        arabicWord: 'دَفْتَرِ',
        normalizedWord: 'دفتر',
        englishMeaning: 'notebook',
        transliteration: 'daftari',
        root: 'د ف ت ر',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish:
          'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 14,
        reviewCount: 16,
      },
      {
        arabicWord: 'الْيَوْمِيَّاتِ.',
        normalizedWord: 'يوميات',
        englishMeaning: 'the daily journal',
        transliteration: 'al-yawmiyyāti',
        root: 'ي و م',
        partOfSpeech: 'noun',
        contextSentenceArabic:
          'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish:
          'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'morning coffee notebook sunlit window',
        usageCount: 10,
        reviewCount: 11,
      },
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const SEED_STATS: UserStats = {
  userId: 'local_user',
  currentStreak: 5,
  longestStreak: 12,
  totalEntries: 2,
  totalWordsEncountered: SEED_WORD_BANK.length,
  totalReviewsCompleted: 117,
  masteredWordsCount: 2,
  lastJournalDate: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString(),
};

export function loadLocalEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(SEED_ENTRIES));
      return SEED_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_ENTRIES;
  } catch {
    return SEED_ENTRIES;
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
    if (!raw) {
      localStorage.setItem(LOCAL_WORDBANK_KEY, JSON.stringify(SEED_WORD_BANK));
      return SEED_WORD_BANK;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : SEED_WORD_BANK;
  } catch {
    return SEED_WORD_BANK;
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
    if (!raw) {
      localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(SEED_STATS));
      return SEED_STATS;
    }
    return JSON.parse(raw) as UserStats;
  } catch {
    return SEED_STATS;
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
 * Silent Cloud Firestore Persistence (No Manual Offline Toggles)
 */
export async function saveJournalEntryToFirestore(
  entry: JournalEntry
): Promise<void> {
  const docId = toSafeDocId(entry.id);
  const path = `journalEntries/${docId}`;
  try {
    const sanitizedTokens = (entry.tokens || []).slice(0, 80).map((t) => ({
      arabicWord: String(t.arabicWord || '').slice(0, 200),
      normalizedWord: String(t.normalizedWord || '').slice(0, 200),
      englishMeaning: String(t.englishMeaning || '').slice(0, 500),
      transliteration: String(t.transliteration || '').slice(0, 200),
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
      visualKeyword: String(t.visualKeyword || '').slice(0, 300),
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
      transliteration: (word.transliteration || '—').slice(0, 200),
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
      visualKeyword: (
        word.visualKeyword || 'morning coffee notebook sunlit window'
      ).slice(0, 300),
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
        return {
          id: docSnap.id,
          userId: String(d.userId || userId),
          arabicWord: String(d.arabicWord || ''),
          normalizedWord: String(d.normalizedWord || ''),
          englishMeaning: String(d.englishMeaning || ''),
          transliteration: String(d.transliteration || ''),
          root: String(d.root || '—'),
          partOfSpeech: String(d.partOfSpeech || 'word'),
          contextSentenceArabic: String(d.contextSentenceArabic || ''),
          contextSentenceEnglish: String(d.contextSentenceEnglish || ''),
          visualKeyword: String(d.visualKeyword || ''),
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
