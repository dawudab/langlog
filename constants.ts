import { Language } from './types';

export const GEMINI_MODEL_NAME = 'gemini-1.5-flash';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', speechCode: 'en-US' },
  { code: 'es', name: 'Español', speechCode: 'es-ES' },
  { code: 'ar', name: 'العربية', speechCode: 'ar-SA' },
];

export const DEFAULT_ORIGINAL_LANGUAGE: Language = SUPPORTED_LANGUAGES[0]; // English
export const DEFAULT_TARGET_LANGUAGE_CODE: string = 'es'; // Spanish
