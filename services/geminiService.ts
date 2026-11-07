import { GeminiFushaResponse } from '../types';

/**
 * Shared system prompt specification enforced by the Gemini endpoint (/api/process-entry).
 * Enforces exhaustive word extraction up to 250 words, no transliteration, and concrete-only visualKeyword.
 */
export const GEMINI_FUSHA_PROMPT_INSTRUCTIONS = `You are an expert Classical & Modern Standard Arabic (al-'Arabiyyah al-Fusha / Quranic Arabic) scholar.

The user will submit journal entries up to 250 words. You MUST translate the entire entry into Fusha Arabic and extract EVERY SINGLE WORD into the tokens array. Do not summarize or skip words; if the entry is 150 words, the tokens array must contain 150 items in sequential order.

Translate the user's journal entry into strictly vocalized Fusha Arabic (Modern Standard / Quranic Arabic) with full Harakat (vowel markings) on every word. Zero colloquial dialects.
For \`visualKeyword\`, ONLY provide a keyword if the word is a highly visual, concrete noun or simple, physical action (e.g., 'mosque', 'tree', 'coffee'). If the entry or word is abstract, complex, emotional, or a grammar particle, you MUST return \`null\` or an empty string for \`visualKeyword\`.`;

/**
 * Expected JSON output schema for Gemini (transliteration completely removed).
 */
export const GEMINI_FUSHA_SCHEMA_FIELDS = [
  'arabicWord',
  'normalizedWord',
  'englishMeaning',
  'root',
  'partOfSpeech',
  'contextSentenceArabic',
  'contextSentenceEnglish',
  'visualKeyword',
] as const;

const REQUEST_TIMEOUT_MS = 60000;

/**
 * Calls the server-side Gemini endpoint (/api/process-entry) with a strict timeout
 * so the UI never hangs indefinitely.
 */
export async function translateJournalToFusha(
  journalEntry: string
): Promise<GeminiFushaResponse> {
  const trimmed = journalEntry.trim();
  if (!trimmed) {
    throw new Error('Please write a journal entry before translating.');
  }

  const wordList = trimmed.split(/\s+/);
  if (wordList.length > 250) {
    throw new Error('Journal entries are limited to 250 words.');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch('/api/process-entry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ journalEntry: trimmed }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody.error || `Translation failed (HTTP ${response.status}).`
      );
    }

    const data = await response.json();
    const fullArabicTranslation = String(
      data?.fullArabicTranslation || ''
    ).trim();
    const rawTokens = Array.isArray(data?.tokens) ? data.tokens : [];

    if (!fullArabicTranslation || rawTokens.length === 0) {
      throw new Error('Received an incomplete translation response.');
    }

    return {
      fullArabicTranslation,
      tokens: rawTokens.map((t: any) => {
        const rawVisual =
          t?.visualKeyword !== null && t?.visualKeyword !== undefined
            ? String(t.visualKeyword).trim()
            : '';
        const cleanedVisual =
          rawVisual &&
          rawVisual.toLowerCase() !== 'null' &&
          rawVisual.toLowerCase() !== 'none'
            ? rawVisual
            : null;

        return {
          arabicWord: String(t?.arabicWord || '').trim(),
          normalizedWord: String(t?.normalizedWord || '').trim(),
          englishMeaning: String(t?.englishMeaning || '').trim(),
          root: String(t?.root || '—').trim(),
          partOfSpeech: String(t?.partOfSpeech || 'word').trim(),
          contextSentenceArabic: String(
            t?.contextSentenceArabic || fullArabicTranslation
          ).trim(),
          contextSentenceEnglish: String(
            t?.contextSentenceEnglish || trimmed
          ).trim(),
          visualKeyword: cleanedVisual,
        };
      }),
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Translation timed out. Please try again.');
    }
    throw error instanceof Error
      ? error
      : new Error('Unable to translate entry right now.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
