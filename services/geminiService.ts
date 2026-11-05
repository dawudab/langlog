import { ProcessedEntryData } from '../types';

export const correctGrammar = async (text: string): Promise<string> => {
  try {
    const res = await fetch('/api/correct-grammar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to correct grammar.');
    }

    return data.correctedText;
  } catch (error: any) {
    console.error('Error correcting grammar:', error);
    throw new Error(error.message || 'Failed to correct grammar. Please try again.');
  }
};

export const processJournalEntry = async (
  journalEntry: string,
  originalLangName: string,
  targetLangName: string
): Promise<ProcessedEntryData> => {
  try {
    const res = await fetch('/api/process-entry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        journalEntry,
        originalLangName,
        targetLangName,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to process journal entry.');
    }

    const processedData: ProcessedEntryData = {
      translation: data.translation || '',
      vocabulary: (data.vocabulary || []).map((v: any) => ({
        original: v.original || '',
        translation: v.translation || '',
        category: v.category || 'N/A',
      })),
      exampleSentences: data.exampleSentences || [],
      flashcards: (data.flashcards || []).map((f: any) => ({
        front: f.front || '',
        back: f.back || '',
      })),
    };

    return processedData;
  } catch (error: any) {
    console.error('Error processing journal entry:', error);
    throw new Error(error.message || 'Failed to process journal entry. Please try again.');
  }
};
