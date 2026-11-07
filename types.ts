export type AppTab = 'journal' | 'wordBank' | 'study' | 'profile';

/**
 * Individual Fusha Arabic word token returned by Gemini and stored in the Word Bank.
 * Implements the 20/20 Mastery Rule:
 * isMastered => usageCount >= 20 && reviewCount >= 20
 */
export interface WordToken {
  arabicWord: string;
  normalizedWord: string;
  englishMeaning: string;
  root: string;
  partOfSpeech: string;
  contextSentenceArabic: string;
  contextSentenceEnglish: string;
  visualKeyword: string | null;
  usageCount: number;
  reviewCount: number;
  isPreviouslyUsed?: boolean;
}

export interface WordBankItem extends WordToken {
  id: string;
  userId: string;
  isMastered: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper implementing the 20/20 Immersion Rule getter:
 * Once usageCount >= 20 AND reviewCount >= 20, the word is mastered
 * and its English translation is hidden in future interlinear journal views.
 */
export function isWordMastered(
  word: Pick<WordToken, 'usageCount' | 'reviewCount'>
): boolean {
  return word.usageCount >= 20 && word.reviewCount >= 20;
}

/**
 * Normalizes an Arabic word by stripping Harakat (tashkeel/diacritics),
 * tatweel, and punctuation so occurrences across journal entries match reliably.
 */
export function normalizeArabicToken(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[.,،؛؟!":«»()[\]'"\-—]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * Generates canonical lookup keys for an Arabic word (including stripping common
 * prefixes like ال, وال, بال, فال, كال, لل, and conjunction و) so inflected or
 * definite/indefinite variants match existing Word Bank entries accurately.
 */
export function getArabicLookupKeys(input: string): string[] {
  const base = normalizeArabicToken(input);
  if (!base) return [];

  const keys = new Set<string>([base]);

  // Strip taa marbuta -> haa variant
  const withoutTaa = base.replace(/ة$/g, 'ه');
  keys.add(withoutTaa);

  const prefixes = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال'];
  for (const prefix of prefixes) {
    if (base.startsWith(prefix) && base.length - prefix.length >= 2) {
      const stripped = base.slice(prefix.length);
      keys.add(stripped);
      keys.add(stripped.replace(/ة$/g, 'ه'));
    }
  }

  if (base.startsWith('و') && base.length >= 4) {
    const withoutWaw = base.slice(1);
    keys.add(withoutWaw);
    if (withoutWaw.startsWith('ال') && withoutWaw.length >= 4) {
      keys.add(withoutWaw.slice(2));
    }
  }

  return Array.from(keys).filter(Boolean);
}

/**
 * Checks whether two Arabic tokens represent the same word/stem in context sentences
 * (without false-positive substring matches on short particles like و or في).
 */
export function isSameArabicWordInContext(
  sentenceWord: string,
  targetArabicWord: string,
  targetNormalizedWord?: string
): boolean {
  const sNorm = normalizeArabicToken(sentenceWord);
  const tNorm = normalizeArabicToken(targetArabicWord);
  const baseNorm = normalizeArabicToken(targetNormalizedWord || '');
  if (!sNorm) return false;
  if (sNorm === tNorm || (baseNorm && sNorm === baseNorm)) return true;

  const sKeys = getArabicLookupKeys(sentenceWord);
  const tKeys = new Set([
    ...getArabicLookupKeys(targetArabicWord),
    ...(targetNormalizedWord ? getArabicLookupKeys(targetNormalizedWord) : []),
  ]);

  for (const k of sKeys) {
    if (k.length >= 2 && tKeys.has(k)) {
      return true;
    }
  }
  return false;
}

/**
 * Built-in Fusha lexicon fallback for common journal words & particles so that if
 * a token is ever missing its meaning/root, it never displays as "—".
 */
const CORE_FUSHA_LEXICON: Record<
  string,
  { englishMeaning: string; root: string; partOfSpeech: string; visualKeyword: string | null }
> = {
  في: { englishMeaning: 'in', root: 'ف ي', partOfSpeech: 'particle', visualKeyword: null },
  من: { englishMeaning: 'from', root: 'م ن', partOfSpeech: 'particle', visualKeyword: null },
  الي: { englishMeaning: 'to', root: 'إ ل ي', partOfSpeech: 'particle', visualKeyword: null },
  علي: { englishMeaning: 'on / upon', root: 'ع ل و', partOfSpeech: 'particle', visualKeyword: null },
  مع: { englishMeaning: 'with', root: 'م ع', partOfSpeech: 'particle', visualKeyword: null },
  عن: { englishMeaning: 'about / from', root: 'ع ن', partOfSpeech: 'particle', visualKeyword: null },
  و: { englishMeaning: 'and', root: 'و', partOfSpeech: 'particle', visualKeyword: null },
  او: { englishMeaning: 'or', root: 'أ و', partOfSpeech: 'particle', visualKeyword: null },
  ثم: { englishMeaning: 'then', root: 'ث م', partOfSpeech: 'particle', visualKeyword: null },
  هذا: { englishMeaning: 'this', root: 'ه ذ ا', partOfSpeech: 'pronoun', visualKeyword: null },
  هذه: { englishMeaning: 'this', root: 'ه ذ ه', partOfSpeech: 'pronoun', visualKeyword: null },
  ذلك: { englishMeaning: 'that', root: 'ذ ل ك', partOfSpeech: 'pronoun', visualKeyword: null },
  انا: { englishMeaning: 'I', root: 'أ ن ا', partOfSpeech: 'pronoun', visualKeyword: null },
  نحن: { englishMeaning: 'we', root: 'ن ح ن', partOfSpeech: 'pronoun', visualKeyword: null },
  هو: { englishMeaning: 'he', root: 'ه و', partOfSpeech: 'pronoun', visualKeyword: null },
  هي: { englishMeaning: 'she', root: 'ه ي', partOfSpeech: 'pronoun', visualKeyword: null },
  صباح: { englishMeaning: 'the morning', root: 'ص ب ح', partOfSpeech: 'noun', visualKeyword: null },
  مساء: { englishMeaning: 'the evening', root: 'م س و', partOfSpeech: 'noun', visualKeyword: null },
  يوم: { englishMeaning: 'day', root: 'ي و م', partOfSpeech: 'noun', visualKeyword: null },
  فجر: { englishMeaning: 'dawn', root: 'ف ج ر', partOfSpeech: 'noun', visualKeyword: null },
  فجرا: { englishMeaning: 'at dawn', root: 'ف ج ر', partOfSpeech: 'noun', visualKeyword: null },
  مسجد: { englishMeaning: 'the mosque', root: 'س ج د', partOfSpeech: 'noun', visualKeyword: 'mosque' },
  قهوة: { englishMeaning: 'coffee', root: 'ق ه و', partOfSpeech: 'noun', visualKeyword: 'coffee' },
  شاي: { englishMeaning: 'tea', root: 'ش ي أ', partOfSpeech: 'noun', visualKeyword: 'coffee' },
  كتاب: { englishMeaning: 'book', root: 'ك ت ب', partOfSpeech: 'noun', visualKeyword: 'book' },
  كتابا: { englishMeaning: 'a book', root: 'ك ت ب', partOfSpeech: 'noun', visualKeyword: 'book' },
  دفتر: { englishMeaning: 'notebook', root: 'د ف ت ر', partOfSpeech: 'noun', visualKeyword: 'notebook' },
  قران: { englishMeaning: 'the Quran', root: 'ق ر أ', partOfSpeech: 'noun', visualKeyword: 'book' },
  حديقة: { englishMeaning: 'the garden', root: 'ح د ق', partOfSpeech: 'noun', visualKeyword: 'garden' },
  شجرة: { englishMeaning: 'tree', root: 'ش ج ر', partOfSpeech: 'noun', visualKeyword: 'tree' },
  ماء: { englishMeaning: 'water', root: 'م و ه', partOfSpeech: 'noun', visualKeyword: 'water' },
  بيت: { englishMeaning: 'house / home', root: 'ب ي ت', partOfSpeech: 'noun', visualKeyword: null },
  ذهب: { englishMeaning: 'went', root: 'ذ ه ب', partOfSpeech: 'verb', visualKeyword: null },
  ذهبت: { englishMeaning: 'I went', root: 'ذ ه ب', partOfSpeech: 'verb', visualKeyword: null },
  شرب: { englishMeaning: 'drank', root: 'ش ر ب', partOfSpeech: 'verb', visualKeyword: 'coffee' },
  شربت: { englishMeaning: 'I drank', root: 'ش ر ب', partOfSpeech: 'verb', visualKeyword: 'coffee' },
  قرأ: { englishMeaning: 'read', root: 'ق ر أ', partOfSpeech: 'verb', visualKeyword: 'book' },
  قرأت: { englishMeaning: 'I read', root: 'ق ر أ', partOfSpeech: 'verb', visualKeyword: 'book' },
  كتب: { englishMeaning: 'wrote', root: 'ك ت ب', partOfSpeech: 'verb', visualKeyword: 'notebook' },
  كتبت: { englishMeaning: 'I wrote', root: 'ك ت ب', partOfSpeech: 'verb', visualKeyword: 'notebook' },
  جلست: { englishMeaning: 'I sat', root: 'ج ل س', partOfSpeech: 'verb', visualKeyword: null },
  عملت: { englishMeaning: 'I worked', root: 'ع م ل', partOfSpeech: 'verb', visualKeyword: null },
  سكينة: { englishMeaning: 'tranquility', root: 'س ك ن', partOfSpeech: 'noun', visualKeyword: null },
  كريم: { englishMeaning: 'noble / generous', root: 'ك ر م', partOfSpeech: 'adjective', visualKeyword: null },
  جميل: { englishMeaning: 'beautiful', root: 'ج م ل', partOfSpeech: 'adjective', visualKeyword: null },
  افكاري: { englishMeaning: 'my thoughts', root: 'ف ك ر', partOfSpeech: 'noun', visualKeyword: null },
};

export function lookupFushaLexiconFallback(
  arabicWord: string,
  normalizedWord?: string
): { englishMeaning: string; root: string; partOfSpeech: string; visualKeyword: string | null } | null {
  const keys = [
    ...getArabicLookupKeys(arabicWord),
    ...(normalizedWord ? getArabicLookupKeys(normalizedWord) : []),
  ];
  for (const key of keys) {
    if (CORE_FUSHA_LEXICON[key]) {
      return CORE_FUSHA_LEXICON[key];
    }
  }
  return null;
}

export interface GeminiFushaResponse {
  fullArabicTranslation: string;
  tokens: Array<{
    arabicWord: string;
    normalizedWord: string;
    englishMeaning: string;
    root: string;
    partOfSpeech: string;
    contextSentenceArabic: string;
    contextSentenceEnglish: string;
    visualKeyword: string | null;
    isPreviouslyUsed: boolean;
  }>;
}

export interface JournalEntry {
  id: string;
  userId: string;
  originalText: string;
  fullArabicTranslation: string;
  tokens: WordToken[];
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  totalWordsEncountered: number;
  totalReviewsCompleted: number;
  masteredWordsCount: number;
  lastJournalDate: string;
  updatedAt: string;
}

export interface NotificationMessage {
  type: 'success' | 'error';
  message: string;
}

// Legacy compatibility types
export interface Language {
  code: string;
  name: string;
  speechCode: string;
}
export type LanguageCode = 'en' | 'ar';
export type AppView = AppTab;
export interface VocabularyItem {
  original: string;
  translation: string;
  category: string;
  isSaved?: boolean;
  id?: string;
}
export interface Flashcard {
  front: string;
  back: string;
  isFlipped?: boolean;
  isCompleted?: boolean;
}
export interface ProcessedEntryData {
  translation: string;
  vocabulary: VocabularyItem[];
  exampleSentences: string[];
  flashcards: Flashcard[];
}
export interface JournalEntryData {
  id: string;
  originalEntry: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  originalLanguageCode: string;
  originalLanguageName: string;
  translatedText: string;
  vocabularyList: VocabularyItem[];
  exampleSentences: string[];
  flashcardWords: Flashcard[];
  createdAt: Date;
  date?: string;
}
export interface SavedWord extends VocabularyItem {
  id: string;
  targetLangCode: string;
  englishEquivalent: string;
  savedAt: Date;
}
