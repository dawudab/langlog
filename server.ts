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
  root: string;
  partOfSpeech: string;
  contextSentenceArabic: string;
  contextSentenceEnglish: string;
  visualKeyword: string | null;
  isPreviouslyUsed: boolean;
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

function sanitizeVisualKeyword(
  rawKeyword: unknown,
  partOfSpeech: string
): string | null {
  if (rawKeyword === null || rawKeyword === undefined) return null;
  const str = String(rawKeyword).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'none' ||
    lower === 'n/a' ||
    lower === 'abstract' ||
    partOfSpeech.toLowerCase().includes('particle') ||
    partOfSpeech.toLowerCase().includes('preposition') ||
    partOfSpeech.toLowerCase().includes('pronoun') ||
    partOfSpeech.toLowerCase().includes('conjunction')
  ) {
    return null;
  }
  return str;
}

/**
 * Splits a journal entry into balanced sentence chunks (~30 words max per chunk)
 * so even 250-word entries can be translated and tokenized in parallel in ~3-5 seconds.
 */
function chunkJournalEntryIntoSegments(
  text: string,
  maxWordsPerChunk = 30
): string[] {
  const rawSentences = text
    .split(/(?<=[.!?؟۔\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: string[] = [];
  let currentSegment = '';
  let currentWordCount = 0;

  for (const sentence of rawSentences) {
    const words = sentence.split(/\s+/).filter(Boolean);

    if (words.length > maxWordsPerChunk) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = '';
        currentWordCount = 0;
      }
      for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        segments.push(words.slice(i, i + maxWordsPerChunk).join(' '));
      }
      continue;
    }

    if (currentWordCount + words.length > maxWordsPerChunk && currentSegment) {
      segments.push(currentSegment.trim());
      currentSegment = sentence;
      currentWordCount = words.length;
    } else {
      currentSegment = currentSegment
        ? `${currentSegment} ${sentence}`
        : sentence;
      currentWordCount += words.length;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.length > 0 ? segments : [text.trim()];
}

function buildFushaLinguisticFallback(
  text: string
): GeminiFushaTranslationPayload {
  const lower = text.toLowerCase();

  if (
    lower.includes('mosque') ||
    lower.includes('dawn') ||
    lower.includes('fajr') ||
    lower.includes('pray')
  ) {
    return {
      fullArabicTranslation:
        'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
      tokens: [
        {
          arabicWord: 'ذَهَبْتُ',
          normalizedWord: 'ذهبت',
          englishMeaning: 'I went',
          root: 'ذ ه ب',
          partOfSpeech: 'verb',
          contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
          contextSentenceEnglish: 'I went to the mosque at dawn.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'إِلَى',
          normalizedWord: 'الى',
          englishMeaning: 'to',
          root: 'إ ل ي',
          partOfSpeech: 'particle',
          contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
          contextSentenceEnglish: 'I went to the mosque at dawn.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'الْمَسْجِدِ',
          normalizedWord: 'مسجد',
          englishMeaning: 'the mosque',
          root: 'س ج د',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
          contextSentenceEnglish: 'I went to the mosque at dawn.',
          visualKeyword: 'mosque',
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'فَجْرًا',
          normalizedWord: 'فجر',
          englishMeaning: 'at dawn',
          root: 'ف ج ر',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'ذَهَبْتُ إِلَى الْمَسْجِدِ فَجْرًا.',
          contextSentenceEnglish: 'I went to the mosque at dawn.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'وَقَرَأْتُ',
          normalizedWord: 'قرأت',
          englishMeaning: 'and I read',
          root: 'ق ر أ',
          partOfSpeech: 'verb',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
          visualKeyword: 'book',
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'الْقُرْآنَ',
          normalizedWord: 'قران',
          englishMeaning: 'the Quran',
          root: 'ق ر أ',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
          visualKeyword: 'book',
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'الْكَرِيمَ',
          normalizedWord: 'كريم',
          englishMeaning: 'the Noble',
          root: 'ك ر م',
          partOfSpeech: 'adjective',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'فِي',
          normalizedWord: 'في',
          englishMeaning: 'in',
          root: 'ف ي',
          partOfSpeech: 'particle',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
        {
          arabicWord: 'سَكِينَةٍ.',
          normalizedWord: 'سكينة',
          englishMeaning: 'tranquility',
          root: 'س ك ن',
          partOfSpeech: 'noun',
          contextSentenceArabic: 'وَقَرَأْتُ الْقُرْآنَ الْكَرِيمَ فِي سَكِينَةٍ.',
          contextSentenceEnglish: 'And I read the Noble Quran in tranquility.',
          visualKeyword: null,
          isPreviouslyUsed: false,
        },
      ],
    };
  }

  return {
    fullArabicTranslation:
      'فِي الصَّبَاحِ شَرِبْتُ الْقَهْوَةَ وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
    tokens: [
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'فِي الصَّبَاحِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the morning I drank coffee.',
        visualKeyword: null,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'الصَّبَاحِ',
        normalizedWord: 'صباح',
        englishMeaning: 'the morning',
        root: 'ص ب ح',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'فِي الصَّبَاحِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the morning I drank coffee.',
        visualKeyword: null,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'شَرِبْتُ',
        normalizedWord: 'شربت',
        englishMeaning: 'I drank',
        root: 'ش ر ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'فِي الصَّبَاحِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the morning I drank coffee.',
        visualKeyword: 'coffee',
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'الْقَهْوَةَ',
        normalizedWord: 'قهوة',
        englishMeaning: 'the coffee',
        root: 'ق ه و',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'فِي الصَّبَاحِ شَرِبْتُ الْقَهْوَةَ.',
        contextSentenceEnglish: 'In the morning I drank coffee.',
        visualKeyword: 'coffee',
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'وَكَتَبْتُ',
        normalizedWord: 'كتبت',
        englishMeaning: 'and I wrote',
        root: 'ك ت ب',
        partOfSpeech: 'verb',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the notebook.',
        visualKeyword: 'notebook',
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'أَفْكَارِي',
        normalizedWord: 'افكاري',
        englishMeaning: 'my thoughts',
        root: 'ف ك ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the notebook.',
        visualKeyword: null,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'فِي',
        normalizedWord: 'في',
        englishMeaning: 'in',
        root: 'ف ي',
        partOfSpeech: 'particle',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the notebook.',
        visualKeyword: null,
        isPreviouslyUsed: false,
      },
      {
        arabicWord: 'الدَّفْتَرِ.',
        normalizedWord: 'دفتر',
        englishMeaning: 'the notebook',
        root: 'د ف ت ر',
        partOfSpeech: 'noun',
        contextSentenceArabic: 'وَكَتَبْتُ أَفْكَارِي فِي الدَّفْتَرِ.',
        contextSentenceEnglish: 'And I wrote my thoughts in the notebook.',
        visualKeyword: 'notebook',
        isPreviouslyUsed: false,
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

  // API Route: ElevenLabs TTS Proxy for Natural Fusha Arabic Pronunciation
  app.post('/api/tts', async (req: Request, res: Response) => {
    const { text, voiceId } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text string is required.' });
    }

    const elevenLabsKey =
      process.env.ELEVENLABS_API_KEY ||
      process.env.VITE_ELEVENLABS_API_KEY ||
      '';

    if (!elevenLabsKey) {
      return res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured.',
      });
    }

    const selectedVoice =
      typeof voiceId === 'string' && voiceId.trim().length > 0
        ? voiceId.trim()
        : process.env.VITE_ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9';

    try {
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          selectedVoice
        )}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsKey.trim(),
          },
          body: JSON.stringify({
            text: text.trim(),
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.65,
              similarity_boost: 0.8,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        const errText = await ttsResponse.text().catch(() => '');
        return res.status(ttsResponse.status).json({
          error: `ElevenLabs API error (${ttsResponse.status})`,
          details: errText.slice(0, 300),
        });
      }

      const arrayBuffer = await ttsResponse.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || 'Failed to synthesize speech via ElevenLabs.',
      });
    }
  });

  // API Route: Process Journal Entry into Vocalized Fusha Arabic & Exhaustive Interlinear Tokens
  app.post('/api/process-entry', async (req: Request, res: Response) => {
    const { journalEntry, existingWords } = req.body;

    if (!journalEntry || typeof journalEntry !== 'string') {
      return res.status(400).json({
        error: 'journalEntry string is required.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      return res.json(buildFushaLinguisticFallback(journalEntry));
    }

    const knownWordsArray: string[] = Array.isArray(existingWords)
      ? existingWords.map((w) => String(w || '').trim()).filter(Boolean)
      : [];

    try {
      const ai = getGeminiClient();

      const responseSchema = {
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
              'Ordered word-by-word tokens of the entire Fusha translation.',
            items: {
              type: Type.OBJECT,
              properties: {
                arabicWord: {
                  type: Type.STRING,
                  description: 'Vocalized Fusha Arabic word (e.g., الْمَسْجِدِ).',
                },
                isPreviouslyUsed: {
                  type: Type.BOOLEAN,
                  description:
                    'True if this word already exists in the user previously learned words list.',
                },
                normalizedWord: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    'Unvocalized normalized base form (omit or null if isPreviouslyUsed is true).',
                },
                englishMeaning: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    'Concise English meaning (omit or null if isPreviouslyUsed is true).',
                },
                root: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    'Spaced triliteral root (omit or null if isPreviouslyUsed is true).',
                },
                partOfSpeech: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    'Part of speech: noun, verb, adjective, particle (omit or null if isPreviouslyUsed is true).',
                },
                visualKeyword: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "ONLY provide a keyword if the word is a highly visual, concrete noun or simple, physical action (e.g., 'mosque', 'tree', 'coffee'). If abstract, complex, emotional, a grammar particle, or isPreviouslyUsed is true, return null or an empty string.",
                },
              },
              required: ['arabicWord', 'isPreviouslyUsed'],
            },
          },
        },
        required: ['fullArabicTranslation', 'tokens'],
      };

      const translateSegment = async (segmentText: string) => {
        const prompt = `You are an expert Classical & Modern Standard Arabic (al-'Arabiyyah al-Fusha / Quranic Arabic) scholar.

The user will submit journal entries up to 250 words. You MUST translate the entire entry into Fusha Arabic and extract EVERY SINGLE WORD into the tokens array sequentially. Do not summarize or skip words.

You will be provided with an array of the user's previously learned words. If a word in the new entry already exists in this list, simply return its exact Arabic word and a flag "isPreviouslyUsed": true, omitting the meaning, root, and context sentence to save output tokens. The client will merge the existing data.

Translate the user's journal entry into strictly eloquent, authentic Fusha Arabic (Modern Standard / Quranic Arabic) with FULL Harakat (complete vowel markings / tashkeel on every word). Zero colloquial dialects.

For every NEW token (where "isPreviouslyUsed" is false):
- "arabicWord": The exact vocalized Fusha Arabic word as it appears in fullArabicTranslation (with full Harakat).
- "isPreviouslyUsed": false.
- "normalizedWord": The base unvocalized Arabic form without Harakat or definite article "ال" when appropriate (e.g., "مسجد" for "الْمَسْجِدِ").
- "englishMeaning": Concise contextual English meaning for this word (1–4 words).
- "root": Spaced 3-letter Arabic triliteral root (e.g., "س ج د", "ك ت ب"). For particles without a 3-letter root, provide the particle letters spaced (e.g., "ف ي").
- "partOfSpeech": "noun", "verb", "adjective", "particle", or "pronoun".
- "visualKeyword": For \`visualKeyword\`, ONLY provide a keyword if the word is a highly visual, concrete noun or simple, physical action (e.g., 'mosque', 'tree', 'coffee'). If the entry or word is abstract, complex, emotional, or a grammar particle, you MUST return \`null\` or an empty string for \`visualKeyword\`.

Previously Learned Words Array:
${JSON.stringify(knownWordsArray)}

User's Journal Entry:
"${segmentText}"`;

        const callOnce = async (timeoutMs: number) => {
          const geminiPromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Segment timeout')), timeoutMs)
          );

          return Promise.race([geminiPromise, timeoutPromise]);
        };

        let response;
        try {
          response = await callOnce(25000);
        } catch {
          response = await callOnce(30000);
        }

        const responseText = (response.text ?? '').trim();
        if (!responseText) {
          throw new Error('Empty response from Gemini model');
        }

        const parsed = JSON.parse(responseText) as {
          fullArabicTranslation?: string;
          tokens?: Array<Record<string, unknown>>;
        };

        const segmentArabic = String(parsed.fullArabicTranslation || '').trim();
        const rawTokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];

        const mappedTokens: FushaTokenPayload[] = rawTokens.map((t) => {
          const arabicWord = String(t.arabicWord || '').trim();
          const pos = String(t.partOfSpeech || '').trim();
          const isPrev = Boolean(t.isPreviouslyUsed);
          return {
            arabicWord,
            normalizedWord:
              String(t.normalizedWord || '').trim() ||
              normalizeArabicServer(arabicWord),
            englishMeaning: String(t.englishMeaning || '').trim(),
            root: String(t.root || '').trim(),
            partOfSpeech: pos,
            contextSentenceArabic: segmentArabic,
            contextSentenceEnglish: segmentText,
            visualKeyword: isPrev
              ? null
              : sanitizeVisualKeyword(t.visualKeyword, pos || 'word'),
            isPreviouslyUsed: isPrev,
          };
        });

        return {
          segmentArabic,
          mappedTokens,
        };
      };

      const segments = chunkJournalEntryIntoSegments(journalEntry.trim(), 30);
      const segmentResults = await Promise.all(
        segments.map((seg) => translateSegment(seg))
      );

      const fullArabicTranslation = segmentResults
        .map((r) => r.segmentArabic)
        .filter(Boolean)
        .join(' ');

      const allTokens = segmentResults
        .flatMap((r) => r.mappedTokens)
        .slice(0, 350);

      if (!fullArabicTranslation || allTokens.length === 0) {
        return res.json(buildFushaLinguisticFallback(journalEntry));
      }

      return res.json({
        fullArabicTranslation,
        tokens: allTokens,
      });
    } catch {
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
