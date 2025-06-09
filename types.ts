export interface Language {
  code: string;
  name: string;
  speechCode: string;
}

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

export type AppView = 'journal' | 'words' | 'savedEntries' | 'entryDetail';

export interface NotificationMessage {
  type: 'success' | 'error';
  message: string;
}
