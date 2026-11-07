import { GeminiFushaResponse } from '../types';

/**
 * Calls the server-side Gemini endpoint (/api/process-entry) to translate
 * a journal entry into strictly vocalized Fusha (Modern Standard / Quranic) Arabic
 * and return the tokenized JSON schema.
 */
export async function translateJournalToFusha(
  journalEntry: string
): Promise<GeminiFushaResponse> {
  const response = await fetch('/api/process-entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ journalEntry }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error ||
        `Failed to translate journal entry (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return {
    fullArabicTranslation: String(data.fullArabicTranslation || ''),
    tokens: Array.isArray(data.tokens) ? data.tokens : [],
  };
}
