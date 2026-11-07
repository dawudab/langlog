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
  transliteration: string;
  root: string;
  partOfSpeech: string;
  contextSentenceArabic: string;
  contextSentenceEnglish: string;
  visualKeyword: string;
  usageCount: number;
  reviewCount: number;
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
  return input
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[.,،؛؟!":«»()[\]]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .trim();
}

export interface GeminiFushaResponse {
  fullArabicTranslation: string;
  tokens: Array<{
    arabicWord: string;
    normalizedWord: string;
    englishMeaning: string;
    transliteration: string;
    root: string;
    partOfSpeech: string;
    contextSentenceArabic: string;
    contextSentenceEnglish: string;
    visualKeyword: string;
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
