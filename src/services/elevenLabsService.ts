// src/services/elevenLabsService.ts

const ELEVENLABS_API_KEY =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_ELEVENLABS_API_KEY
    : undefined;

const RAW_ENV_VOICE_ID =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_ELEVENLABS_VOICE_ID
    : undefined;

/**
 * Validates that a candidate Voice ID is an actual ElevenLabs voice ID
 * (~15-28 alphanumeric chars) and not an accidentally pasted API key or 64-char hex hash.
 */
function isValidElevenLabsVoiceId(id: string | undefined): id is string {
  if (!id) return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.startsWith('sk_')) return false;
  if (/^[0-9a-fA-F]{32,}$/.test(trimmed)) return false;
  return /^[a-zA-Z0-9]{15,30}$/.test(trimmed);
}

// High-clarity multilingual voices for Fusha Arabic ('pNInz6obpgDQGcFmaJgB' - Adam, 'onwK4e9ZLuTAKqWW03F9' - Daniel)
const FALLBACK_VOICE_IDS = ['pNInz6obpgDQGcFmaJgB', 'onwK4e9ZLuTAKqWW03F9'];

const DEFAULT_VOICE_ID = isValidElevenLabsVoiceId(RAW_ENV_VOICE_ID)
  ? RAW_ENV_VOICE_ID.trim()
  : FALLBACK_VOICE_IDS[0];

let workingVoiceId: string = DEFAULT_VOICE_ID;
const audioBlobUrlCache = new Map<string, string>();

async function requestServerTts(
  text: string,
  voiceId: string
): Promise<Response | null> {
  try {
    return await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId,
      }),
    });
  } catch {
    return null;
  }
}

async function requestDirectElevenLabsTts(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<Response | null> {
  try {
    return await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.78,
        },
      }),
    });
  } catch {
    return null;
  }
}

export async function getPronunciationAudio(
  text: string
): Promise<HTMLAudioElement | null> {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const cachedUrl = audioBlobUrlCache.get(trimmed);
  if (cachedUrl) {
    return new Audio(cachedUrl);
  }

  try {
    const candidateVoices = Array.from(
      new Set([workingVoiceId, ...FALLBACK_VOICE_IDS])
    );

    let validResponse: Response | null = null;

    // 1. Try direct ElevenLabs API if client key is configured
    if (ELEVENLABS_API_KEY && String(ELEVENLABS_API_KEY).trim().length > 0) {
      for (const candidateVoice of candidateVoices) {
        const res = await requestDirectElevenLabsTts(
          trimmed,
          candidateVoice,
          String(ELEVENLABS_API_KEY)
        );
        if (res && res.ok) {
          workingVoiceId = candidateVoice;
          validResponse = res;
          break;
        }
        // If rate-limited or unauthorized, stop looping direct calls and try server proxy
        if (res && (res.status === 401 || res.status === 403 || res.status === 429)) {
          break;
        }
      }
    }

    // 2. Fallback to backend /api/tts proxy if direct request was not used or failed
    if (!validResponse) {
      const serverRes = await requestServerTts(trimmed, workingVoiceId);
      if (serverRes && serverRes.ok) {
        validResponse = serverRes;
      }
    }

    if (!validResponse || !validResponse.ok) {
      return null;
    }

    const audioBlob = await validResponse.blob();
    if (!audioBlob || audioBlob.size === 0) {
      return null;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    audioBlobUrlCache.set(trimmed, audioUrl);
    return new Audio(audioUrl);
  } catch (error) {
    console.error('Failed to fetch pronunciation audio:', error);
    // Graceful fallback to prevent app crashes when rate-limited or offline
    return null;
  }
}
