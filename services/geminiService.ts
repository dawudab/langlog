import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_NAME } from '../constants';
import { ProcessedEntryData } from '../types';

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!API_KEY) {
  console.error('VITE_GEMINI_API_KEY is not set in environment variables');
}

if (!API_KEY) {
  console.error("API_KEY is not set. Please ensure import.meta.env.VITE_GEMINI_API_KEY is available.");
  // Potentially throw an error or disable API functionality
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" }); // Fallback to prevent crash if key is missing

function parseJsonFromGeminiResponse(text: string): any {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Matches ```json ... ``` or ``` ... ```
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Original text:", text);
    throw new Error("Failed to parse AI response as JSON. The response might not be valid JSON.");
  }
}

export const correctGrammar = async (text: string): Promise<string> => {
  if (!API_KEY) throw new Error("Gemini API key not configured.");
  try {
    const prompt = `Correct the spelling and grammar of the following text. Return only the corrected text, without any introductory phrases or explanations:\n\n"${text}"`;
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
    });
    
    if (!response.text) {
      throw new Error("No text was returned from the API");
    }
    
    return response.text;
  } catch (error) {
    console.error("Error correcting grammar:", error);
    throw new Error("Failed to correct grammar. Please try again.");
  }
};

export const processJournalEntry = async (
  journalEntry: string,
  originalLangName: string,
  targetLangName: string
): Promise<ProcessedEntryData> => {
  if (!API_KEY) {
    console.error('Gemini API key not configured');
    throw new Error("API key not configured. Please check your environment variables.");
  }
  
  try {
    console.log('Sending request to Gemini API with model:', GEMINI_MODEL_NAME);
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
      model: GEMINI_MODEL_NAME,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
      }
    });
    
    console.log('Received response from Gemini API');
    
    const responseText = response.text;
    if (!responseText) {
      console.error('No text in response from Gemini API');
      throw new Error("No response text was returned from the API");
    }
    
    console.log('Response text:', responseText);
    const parsedData = parseJsonFromGeminiResponse(responseText);

    // Validate structure of parsedData
    if (!parsedData.translation || !Array.isArray(parsedData.vocabulary) || !Array.isArray(parsedData.exampleSentences) || !Array.isArray(parsedData.flashcards)) {
        throw new Error("AI response is missing expected fields or has incorrect structure.");
    }
    
    const processedData: ProcessedEntryData = {
        translation: parsedData.translation || "",
        vocabulary: (parsedData.vocabulary || []).map((v: any) => ({
            original: v.original || "",
            translation: v.translation || "",
            category: v.category || "N/A",
        })),
        exampleSentences: parsedData.exampleSentences || [],
        flashcards: (parsedData.flashcards || []).map((f: any) => ({
            front: f.front || "",
            back: f.back || "",
        })),
    };
    
    return processedData;

  } catch (error) {
    console.error("Error processing journal entry with Gemini:", error);
    if (error instanceof Error && error.message.includes("Failed to parse AI response as JSON")) {
        throw error;
    }
    throw new Error("Failed to process journal entry. The AI model might be temporarily unavailable or the request could not be fulfilled.");
  }
};
