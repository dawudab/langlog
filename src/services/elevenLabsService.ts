// src/services/elevenLabsService.ts

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
// Using a standard Arabic-capable voice ID (e.g., 'pNInz6obbfDQGcgMyIGb' - Adam, or replace with your preferred voice)
const VOICE_ID = 'pNInz6obbfDQGcgMyIGb';

export async function getPronunciationAudio(
  text: string
): Promise<HTMLAudioElement | null> {
  if (!text) return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    return new Audio(audioUrl);
  } catch (error) {
    console.error('Failed to fetch pronunciation audio:', error);
    // Graceful fallback to prevent app crashes when rate-limited or offline
    return null;
  }
}
