import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      console.warn('[Server] GEMINI_API_KEY is not set in environment variables');
    }
    return new GoogleGenAI({ apiKey: apiKey || 'MISSING_API_KEY' });
  };

  const parseJsonFromGeminiResponse = (text: string): any => {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    return JSON.parse(jsonStr);
  };

  // API Route: Correct Grammar
  app.post('/api/correct-grammar', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text string is required in request body.' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (!apiKey) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const ai = getGeminiClient();
      const prompt = `Correct the spelling and grammar of the following text. Return only the corrected text, without any introductory phrases or explanations:\n\n"${text}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (!response.text) {
        return res.status(500).json({ error: 'No text was returned from the API' });
      }

      return res.json({ correctedText: response.text });
    } catch (error: any) {
      console.error('Error in /api/correct-grammar:', error);
      return res.status(500).json({ error: error.message || 'Failed to correct grammar.' });
    }
  });

  // API Route: Process Journal Entry
  app.post('/api/process-entry', async (req: Request, res: Response) => {
    try {
      const { journalEntry, originalLangName, targetLangName } = req.body;
      if (!journalEntry || !originalLangName || !targetLangName) {
        return res.status(400).json({
          error: 'journalEntry, originalLangName, and targetLangName are required.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (!apiKey) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const ai = getGeminiClient();
      const prompt = `You are a professional translator and language learning assistant. I will provide a journal entry in ${originalLangName}, and you need to:

1. TRANSLATE the entire journal entry into ${targetLangName} (${targetLangName} output only, no ${originalLangName} in the translation)
2. Extract and translate ALL vocabulary items
3. Create example sentences in ${targetLangName} that use the translated vocabulary

JOURNAL ENTRY IN ${originalLangName}:
"${journalEntry}"

Respond with a JSON object containing the following fields:

1. "translation": The complete, natural-sounding translation of the journal entry in ${targetLangName}.

2. "vocabulary": An array of ALL words/phrases from the original text. For EACH item:
   {
     "original": "[EXACT original text in ${originalLangName}]",
     "translation": "[translation in ${targetLangName}]",
     "category": "[part of speech: noun/verb/adjective/adverb/phrase]"
   }

3. "exampleSentences": 3-5 example sentences in ${targetLangName} that demonstrate the vocabulary in context.
   ["Sentence 1 in ${targetLangName}", "Sentence 2 in ${targetLangName}", ...]

4. "flashcards": [
   {
     "front": "[${originalLangName} word/phrase]",
     "back": "[${targetLangName} translation]",
     "category": "[part of speech]"
   }
 ]

CRITICAL INSTRUCTIONS:
- The translation must be in ${targetLangName} only - do not include any ${originalLangName} in the translation
- Preserve the original meaning and tone
- Include ALL words from the original text in the vocabulary list
- Ensure all vocabulary translations are accurate and natural in ${targetLangName}
- Example sentences must be natural, grammatically correct ${targetLangName}
- The response must be valid JSON with no syntax errors
- Do not include any explanations or text outside the JSON object

Return ONLY the JSON object with no additional text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: 'No response text was returned from the API' });
      }

      const parsedData = parseJsonFromGeminiResponse(responseText);

      if (!parsedData.translation || !Array.isArray(parsedData.vocabulary) || !Array.isArray(parsedData.exampleSentences) || !Array.isArray(parsedData.flashcards)) {
        return res.status(500).json({ error: 'AI response is missing expected fields or has incorrect structure.' });
      }

      const processedData = {
        translation: parsedData.translation || '',
        vocabulary: (parsedData.vocabulary || []).map((v: any) => ({
          original: v.original || '',
          translation: v.translation || '',
          category: v.category || 'N/A',
        })),
        exampleSentences: parsedData.exampleSentences || [],
        flashcards: (parsedData.flashcards || []).map((f: any) => ({
          front: f.front || '',
          back: f.back || '',
        })),
      };

      return res.json(processedData);
    } catch (error: any) {
      console.error('Error in /api/process-entry:', error);
      return res.status(500).json({ error: error.message || 'Failed to process journal entry.' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LinguaJournal AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
