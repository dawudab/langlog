import {
  GeminiFushaResponse,
  WordBankItem,
  normalizeArabicToken,
} from '../types';

/**
 * Shared system prompt specification enforced by the Gemini endpoint (/api/process-entry).
 * Enforces:
 * 1. 250-word limit & exhaustive sequential word extraction into `tokens`.
 * 2. Complete removal of `transliteration`.
 * 3. Word Bank cross-referencing via `isPreviouslyUsed: true` to save output tokens.
 * 4. Concrete-only `visualKeyword` rule.
 */
export const GEMINI_FUSHA_PROMPT_INSTRUCTIONS = `You are an expert Classical & Modern Standard Arabic (al-'Arabiyyah al-Fusha / Quranic Arabic) scholar.

The user will submit journal entries up to 250 words. You MUST translate the entire entry into Fusha Arabic and extract EVERY SINGLE WORD into the tokens array sequentially. Do not summarize or skip words.

You will be provided with an array of the user's previously learned words. If a word in the new entry already exists in this list, simply return its exact Arabic word and a flag "isPreviouslyUsed": true, omitting the meaning, root, and context sentence to save output tokens. The client will merge the existing data.

Translate the user's journal entry into strictly vocalized Fusha Arabic (Modern Standard / Quranic Arabic) with full Harakat (vowel markings) on every word. Zero colloquial dialects.
For \`visualKeyword\`, ONLY provide a keyword if the word is a highly visual, concrete noun or simple, physical action (e.g., 'mosque', 'tree', 'coffee'). If the entry or word is abstract, complex, emotional, or a grammar particle, you MUST return \`null\` or an empty string for \`visualKeyword\`.`;

/**
 * Expected JSON output schema fields for Gemini (transliteration completely removed,
 * and `isPreviouslyUsed` supported for token-saving Word Bank cross-referencing).
 */
export const GEMINI_FUSHA_SCHEMA_FIELDS = [
  'arabicWord',
  'normalizedWord',
  'englishMeaning',
  'root',
  'partOfSpeech',
  'visualKeyword',
  'isPreviouslyUsed',
] as const;

const REQUEST_TIMEOUT_MS = 60000;

/**
 * Calls the server-side Gemini endpoint (/api/process-entry) with the user's
 * `existingWordBank` so known words are flagged with `isPreviouslyUsed: true`
 * and merged with existing meaning, root, and context data on the client.
 */
export async function translateJournalToFusha(
  journalEntry: string,
  existingWordBank: WordBankItem[] = []
): Promise<GeminiFushaResponse> {
  const trimmed = journalEntry.trim();
  if (!trimmed) {
    throw new Error('Please write a journal entry before translating.');
  }

  const wordList = trimmed.split(/\s+/);
  if (wordList.length > 250) {
    throw new Error('Journal entries are limited to 250 words.');
  }

  // Build fast client-side lookup map for merging known Word Bank items
  const existingMap = new Map<string, WordBankItem>();
  existingWordBank.forEach((item) => {
    const norm = normalizeArabicToken(item.normalizedWord);
    const arabNorm = normalizeArabicToken(item.arabicWord);
    if (norm) existingMap.set(norm, item);
    if (arabNorm) existingMap.set(arabNorm, item);
    if (item.arabicWord) existingMap.set(item.arabicWord.trim(), item);
  });

  // Compact list of previously learned Arabic words sent for Gemini cross-referencing
  const knownWordsPayload = Array.from(
    new Set(
      existingWordBank
        .map((w) => w.arabicWord.trim())
        .filter(Boolean)
    )
  ).slice(0, 300);

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
      body: JSON.stringify({
        journalEntry: trimmed,
        existingWords: knownWordsPayload,
      }),
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
        const arabicWord = String(t?.arabicWord || '').trim();
        const rawNorm =
          String(t?.normalizedWord || '').trim() ||
          normalizeArabicToken(arabicWord);

        const matchedBankItem =
          existingMap.get(rawNorm) ||
          existingMap.get(normalizeArabicToken(arabicWord)) ||
          existingMap.get(arabicWord);

        const isPreviouslyUsed = Boolean(
          t?.isPreviouslyUsed || matchedBankItem
        );

        const rawVisual =
          t?.visualKeyword !== null && t?.visualKeyword !== undefined
            ? String(t.visualKeyword).trim()
            : '';
        const cleanedVisual =
          rawVisual &&
          rawVisual.toLowerCase() !== 'null' &&
          rawVisual.toLowerCase() !== 'none'
            ? rawVisual
            : matchedBankItem?.visualKeyword ?? null;

        return {
          arabicWord,
          normalizedWord:
            rawNorm ||
            matchedBankItem?.normalizedWord ||
            normalizeArabicToken(arabicWord) ||
            arabicWord,
          englishMeaning:
            String(t?.englishMeaning || '').trim() ||
            matchedBankItem?.englishMeaning ||
            '—',
          root:
            String(t?.root || '').trim() ||
            matchedBankItem?.root ||
            '—',
          partOfSpeech:
            String(t?.partOfSpeech || '').trim() ||
            matchedBankItem?.partOfSpeech ||
            'word',
          contextSentenceArabic:
            String(t?.contextSentenceArabic || '').trim() ||
            matchedBankItem?.contextSentenceArabic ||
            fullArabicTranslation,
          contextSentenceEnglish:
            String(t?.contextSentenceEnglish || '').trim() ||
            matchedBankItem?.contextSentenceEnglish ||
            trimmed,
          visualKeyword: cleanedVisual,
          isPreviouslyUsed,
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
