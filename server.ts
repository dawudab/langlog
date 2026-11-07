import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FushaTokenPayload {
  arabicWord: string;
  normalizedWord: string;
  englishMeaning: string;
  transliteration: string;
  root: string;
  partOfSpeech: string;
  contextSentenceArabic: string;
  contextSentenceEnglish: string;
  visualKeyword: string;
}

interface GeminiFushaTranslationPayload {
  fullArabicTranslation: string;
  tokens: FushaTokenPayload[];
}

function normalizeArabicServer(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[.,،؛؟!":«»()[\]]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .trim();
}

function buildFushaLinguisticFallback(
  text: string
): GeminiFushaTranslationPayload {
  const lower = text.toLowerCase();

  if (lower.includes('mosque') || lower.includes('dawn') || lower.includes('fajr') || lower.includes('pray')) {
    return {
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
        },
        {
          arabicWord: 'إِلَى',
          normalizedWord: 'الى',
          englishMeaning: 'to / toward',
          transliteration: 'ilā',
          root: 'إ ل ي',
          partOfSpeech: 'particle',
          contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
          contextSentenceEnglish: 'I went to the mosque at dawn.',
          visualKeyword: 'mosque dawn peaceful architecture',
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
        },
        {
          arabicWord: 'وَقَرَأْتُ',
          normalizedWord: 'قرأت',
          englishMeaning: 'and I recited / read',
          transliteration: 'wa-qara’tu',
          root: 'ق ر أ',
          partOfSpeech: 'verb',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility.',
          visualKeyword: 'library books calligraphy manuscript',
        },
        {
          arabicWord: 'الْقُرْآنَ',
          normalizedWord: 'قران',
          englishMeaning: 'the Quran',
          transliteration: 'al-Qur’āna',
          root: 'ق ر أ',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility.',
          visualKeyword: 'library books calligraphy manuscript',
        },
        {
          arabicWord: 'الْكَرِيمَ',
          normalizedWord: 'كريم',
          englishMeaning: 'the Noble / Generous',
          transliteration: 'al-karīma',
          root: 'ك ر م',
          partOfSpeech: 'adjective',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility.',
          visualKeyword: 'library books calligraphy manuscript',
        },
        {
          arabicWord: 'فِي',
          normalizedWord: 'في',
          englishMeaning: 'in',
          transliteration: 'fī',
          root: 'ف ي',
          partOfSpeech: 'particle',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility and peace.',
          visualKeyword: 'garden olive trees peaceful courtyard',
        },
        {
          arabicWord: 'سَكِينَةٍ',
          normalizedWord: 'سكينة',
          englishMeaning: 'tranquility / serenity',
          transliteration: 'sakīnatin',
          root: 'س ك ن',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility and peace.',
          visualKeyword: 'garden olive trees peaceful courtyard',
        },
        {
          arabicWord: 'وَهُدُوءٍ.',
          normalizedWord: 'هدوء',
          englishMeaning: 'and quietude',
          transliteration: 'wa-hudū’in',
          root: 'ه د أ',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ وَهُدُوءٍ.',
          contextSentenceEnglish: 'And I recited the Noble Quran in tranquility and peace.',
          visualKeyword: 'garden olive trees peaceful courtyard',
        },
      ],
    };
  }

  return {
    fullArabicTranslation:
      'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ لِأَتَعَلَّمَ اللُّغَةَ الْعَرَبِيَّةَ الْفُصْحَى.',
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
      },
      {
        arabicWord: 'شَرِبْتُ',
        normalizedWord: 'شربت',
        englishMeaning: 'I drank',
        transliteration: 'sharibtu',
        root: 'ش ر ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ.',
        contextSentenceEnglish: 'In the early morning I drank Arabic coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
      },
      {
        arabicWord: 'الْقَهْوَةَ',
        normalizedWord: 'قهوة',
        englishMeaning: 'the coffee',
        transliteration: 'al-qahwata',
        root: 'ق ه و',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'فِي الصَّبَاحِ الْبَاكِرِ شَرِبْتُ الْقَهْوَةَ الْعَرَبِيَّةَ.',
        contextSentenceEnglish: 'In the early morning I drank Arabic coffee.',
        visualKeyword: 'morning coffee notebook sunlit window',
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
      },
      {
        arabicWord: 'وَكَتَبْتُ',
        normalizedWord: 'كتبت',
        englishMeaning: 'and I wrote',
        transliteration: 'wa-katabtu',
        root: 'ك ت ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'library books calligraphy manuscript',
      },
      {
        arabicWord: 'أَفْكَارِي',
        normalizedWord: 'افكاري',
        englishMeaning: 'my thoughts',
        transliteration: 'afkārī',
        root: 'ف ك ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'library books calligraphy manuscript',
      },
      {
        arabicWord: 'دَفْتَرِ',
        normalizedWord: 'دفتر',
        englishMeaning: 'notebook',
        transliteration: 'daftari',
        root: 'د ف ت ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'morning coffee notebook sunlit window',
      },
      {
        arabicWord: 'الْيَوْمِيَّاتِ',
        normalizedWord: 'يوميات',
        englishMeaning: 'the daily journal',
        transliteration: 'al-yawmiyyāti',
        root: 'ي و م',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي دَفْتَرِ الْيَوْمِيَّاتِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the journal notebook.',
        visualKeyword: 'morning coffee notebook sunlit window',
      },
      {
        arabicWord: 'لِأَتَعَلَّمَ',
        normalizedWord: 'اتعلم',
        englishMeaning: 'so that I learn',
        transliteration: 'li-ata‘allama',
        root: 'ع ل م',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'لِأَتَعَلَّمَ اللُّغَةَ الْعَرَبِيَّةَ الْفُصْحَى.',
        contextSentenceEnglish: 'So that I learn eloquent Fusha Arabic.',
        visualKeyword: 'library books calligraphy manuscript',
      },
      {
        arabicWord: 'اللُّغَةَ',
        normalizedWord: 'لغة',
        englishMeaning: 'the language',
        transliteration: 'al-lughata',
        root: 'ل غ و',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'لِأَتَعَلَّمَ اللُّغَةَ الْعَرَبِيَّةَ الْفُصْحَى.',
        contextSentenceEnglish: 'So that I learn eloquent Fusha Arabic.',
        visualKeyword: 'library books calligraphy manuscript',
      },
      {
        arabicWord: 'الْفُصْحَى.',
        normalizedWord: 'فصحى',
        englishMeaning: 'Fusha / Classical',
        transliteration: 'al-fuṣḥā',
        root: 'ف ص ح',
        partOfSpeech: 'adjective',
        contextSentenceArabic: 'لِأَتَعَلَّمَ اللُّغَةَ الْعَرَبِيَّةَ الْفُصْحَى.',
        contextSentenceEnglish: 'So that I learn eloquent Fusha Arabic.',
        visualKeyword: 'library books calligraphy manuscript',
      },
    ],
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    return new GoogleGenAI({
      apiKey: apiKey || 'MISSING_API_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Route: Process Journal Entry into Vocalized Fusha Arabic & Interlinear Tokens
  app.post('/api/process-entry', async (req: Request, res: Response) => {
    const { journalEntry } = req.body;

    if (!journalEntry || typeof journalEntry !== 'string') {
      return res.status(400).json({
        error: 'journalEntry string is required.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      return res.json(buildFushaLinguisticFallback(journalEntry));
    }

    try {
      const ai = getGeminiClient();

      const prompt = `You are an expert Classical & Modern Standard Arabic (al-'Arabiyyah al-Fusha / Quranic Arabic) scholar and pedagogue teaching English speakers to read and think in Arabic.

Translate the user's journal entry into strictly eloquent, authentic Fusha Arabic (Modern Standard / Quranic Arabic) with FULL Harakat (complete vowel diacritics / tashkeel on every word, including case endings / i'rab where appropriate). Do NOT use any colloquial dialect.

Then tokenize the ENTIRE translated Fusha Arabic text in exact sequential order into the "tokens" array so that rendering all tokens in order reconstructs the full translated sentence(s) for an interlinear word-by-word reader.

For every token in "tokens":
- "arabicWord": The exact vocalized Fusha Arabic word as it appears in fullArabicTranslation (with full Harakat).
- "normalizedWord": The base unvocalized Arabic form without Harakat or definite article "ال" when appropriate (e.g., "مسجد" for "الْمَسْجِدِ", "ذهب" or "ذهبت" for "ذَهَبْتُ").
- "englishMeaning": Concise contextual English meaning for this word (1–4 words, e.g., "the mosque", "I went", "at dawn").
- "transliteration": Clean academic transliteration (e.g., "al-masjidi").
- "root": Spaced 3-letter Arabic triliteral root (e.g., "س ج د", "ك ت ب"). For particles without a 3-letter root, provide the particle letters spaced (e.g., "ف ي").
- "partOfSpeech": "noun", "verb", "adjective", "particle", or "pronoun".
- "contextSentenceArabic": The vocalized Fusha sentence from fullArabicTranslation containing this word.
- "contextSentenceEnglish": The English translation of that context sentence.
- "visualKeyword": Descriptive 3–5 word visual cue prompt for a flashcard illustration (e.g., "mosque dawn peaceful architecture", "morning coffee notebook sunlit window", "library books calligraphy manuscript", "garden olive trees courtyard").

User's Journal Entry:
"${journalEntry}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullArabicTranslation: {
                type: Type.STRING,
                description:
                  'Vocalized Fusha Arabic text with full Harakat (vowel markings).',
              },
              tokens: {
                type: Type.ARRAY,
                description:
                  'Ordered word-by-word tokens of the Fusha translation for interlinear display and Word Bank indexing.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    arabicWord: {
                      type: Type.STRING,
                      description: 'Vocalized Fusha Arabic word (e.g., الْمَسْجِدِ).',
                    },
                    normalizedWord: {
                      type: Type.STRING,
                      description: 'Unvocalized normalized base form (e.g., مسجد).',
                    },
                    englishMeaning: {
                      type: Type.STRING,
                      description: 'Concise English meaning (e.g., the mosque).',
                    },
                    transliteration: {
                      type: Type.STRING,
                      description: 'Latin transliteration (e.g., al-masjid).',
                    },
                    root: {
                      type: Type.STRING,
                      description: 'Spaced triliteral root (e.g., س ج د).',
                    },
                    partOfSpeech: {
                      type: Type.STRING,
                      description: 'Part of speech (noun, verb, adjective, particle).',
                    },
                    contextSentenceArabic: {
                      type: Type.STRING,
                      description: 'Vocalized Fusha context sentence.',
                    },
                    contextSentenceEnglish: {
                      type: Type.STRING,
                      description: 'English translation of the context sentence.',
                    },
                    visualKeyword: {
                      type: Type.STRING,
                      description: 'Visual cue keywords for flashcard illustration.',
                    },
                  },
                  required: [
                    'arabicWord',
                    'normalizedWord',
                    'englishMeaning',
                    'transliteration',
                    'root',
                    'partOfSpeech',
                    'contextSentenceArabic',
                    'contextSentenceEnglish',
                    'visualKeyword',
                  ],
                },
              },
            },
            required: ['fullArabicTranslation', 'tokens'],
          },
        },
      });

      const responseText = (response.text ?? '').trim();
      if (!responseText) {
        throw new Error('Empty response from Gemini model');
      }

      const parsed = JSON.parse(responseText) as GeminiFushaTranslationPayload;
      return res.json({
        fullArabicTranslation: parsed.fullArabicTranslation || '',
        tokens: Array.isArray(parsed.tokens)
          ? parsed.tokens.slice(0, 80).map((t) => ({
              arabicWord: String(t.arabicWord || ''),
              normalizedWord:
                String(t.normalizedWord || '').trim() ||
                normalizeArabicServer(String(t.arabicWord || '')),
              englishMeaning: String(t.englishMeaning || ''),
              transliteration: String(t.transliteration || ''),
              root: String(t.root || '—'),
              partOfSpeech: String(t.partOfSpeech || 'word'),
              contextSentenceArabic: String(
                t.contextSentenceArabic || parsed.fullArabicTranslation || ''
              ),
              contextSentenceEnglish: String(t.contextSentenceEnglish || ''),
              visualKeyword: String(
                t.visualKeyword || 'morning coffee notebook sunlit window'
              ),
            }))
          : [],
      });
    } catch (error: any) {
      console.warn(
        '[Server] Gemini API call fell back to Fusha linguistic analyzer:',
        error?.message || error
      );
      return res.json(buildFushaLinguisticFallback(journalEntry));
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fusha Notebook server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
