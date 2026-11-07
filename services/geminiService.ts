import {
  GeminiExtractionResponse,
  LanguageCode,
  ProcessedEntryData,
} from '../types';

export const analyzeJournalEntry = async (
  journalEntry: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  knownWords: string[] = []
): Promise<GeminiExtractionResponse> => {
  const res = await fetch('/api/process-entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      journalEntry,
      sourceLanguage,
      targetLanguage,
      knownWords,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to analyze journal entry.');
  }

  return {
    translation: String(data.translation || ''),
    vocabulary: Array.isArray(data.vocabulary)
      ? data.vocabulary.map((v: any) => ({
          word_conjugated: String(v.word_conjugated || ''),
          root: String(v.root || ''),
          meaning: String(v.meaning || ''),
          context: String(v.context || ''),
          is_new: Boolean(v.is_new ?? true),
        }))
      : [],
  };
};

// Legacy compatibility wrapper
export const correctGrammar = async (text: string): Promise<string> => {
  return text;
};

export const processJournalEntry = async (
  journalEntry: string,
  originalLangName: string,
  _targetLangName: string
): Promise<ProcessedEntryData> => {
  const src: LanguageCode = originalLangName.toLowerCase().includes('ar')
    ? 'ar'
    : 'en';
  const tgt: LanguageCode = src === 'en' ? 'ar' : 'en';
  const res = await analyzeJournalEntry(journalEntry, src, tgt);
  return {
    translation: res.translation,
    vocabulary: res.vocabulary.map((v) => ({
      original: v.word_conjugated,
      translation: v.meaning,
      category: `Root: ${v.root}`,
    })),
    exampleSentences: res.vocabulary.map((v) => v.context).filter(Boolean),
    flashcards: res.vocabulary.map((v) => ({
      front: v.word_conjugated,
      back: `${v.meaning} (${v.root})`,
    })),
  };
};
