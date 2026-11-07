import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechSynthesisHook {
  speak: (text: string, langCode?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  supported: boolean;
  currentText: string | null;
  currentLang: string | null;
  progress: number;
  duration: number;
  audioError: string | null;
}

// Clear, articulate multilingual voice well-suited for vocalized Modern Standard Arabic (Fusha)
const DEFAULT_FUSHA_VOICE_ID =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_ELEVENLABS_VOICE_ID) ||
  'onwK4e9ZLuTAKqWW03F9';

// In-memory cache of object URLs keyed by normalized text to avoid redundant ElevenLabs API calls
const elevenLabsAudioCache = new Map<string, string>();

export const useSpeechSynthesis = (): SpeechSynthesisHook => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supported] = useState(true);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanupAudio = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stop = useCallback(() => {
    cleanupAudio();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentText(null);
    setCurrentLang(null);
    setProgress(0);
    setDuration(0);
  }, [cleanupAudio]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play().catch(() => {});
      setIsPaused(false);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      isPaused
    ) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const playWithFallbackBrowserTTS = useCallback(
    (text: string, langCode: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsSpeaking(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice =
          voices.find((v) => v.lang === langCode) ||
          voices.find((v) => v.lang.startsWith(langCode.split('-')[0]));
        if (arabicVoice) {
          utterance.voice = arabicVoice;
        }
        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setCurrentText(null);
          setProgress(0);
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          setIsPaused(false);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    []
  );

  const playBlobUrl = useCallback(
    (objectUrl: string, text: string, langCode: string) => {
      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setProgress(Math.min(1, audio.currentTime / audio.duration));
        }
      };

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentText(null);
        setCurrentLang(null);
        setProgress(0);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        playWithFallbackBrowserTTS(text, langCode);
      };

      audio.play().catch(() => {
        playWithFallbackBrowserTTS(text, langCode);
      });
    },
    [playWithFallbackBrowserTTS]
  );

  const speak = useCallback(
    async (text: string, langCode = 'ar-SA') => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stop();
      setAudioError(null);
      setCurrentText(trimmed);
      setCurrentLang(langCode);
      setIsSpeaking(true);

      const cacheKey = `${DEFAULT_FUSHA_VOICE_ID}:${trimmed}`;
      const cachedUrl = elevenLabsAudioCache.get(cacheKey);
      if (cachedUrl) {
        playBlobUrl(cachedUrl, trimmed, langCode);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const clientApiKey =
          typeof import.meta !== 'undefined'
            ? (import.meta as any).env?.VITE_ELEVENLABS_API_KEY
            : '';

        let response: Response;

        if (clientApiKey && String(clientApiKey).trim().length > 0) {
          // Direct ElevenLabs TTS API call when VITE_ELEVENLABS_API_KEY is present
          response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_FUSHA_VOICE_ID}?output_format=mp3_44100_128`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': String(clientApiKey).trim(),
              },
              body: JSON.stringify({
                text: trimmed,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.65,
                  similarity_boost: 0.8,
                  style: 0.15,
                  use_speaker_boost: true,
                },
              }),
              signal: controller.signal,
            }
          );
        } else {
          // Server-side ElevenLabs proxy (/api/tts) reading ELEVENLABS_API_KEY / .env.local
          response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: trimmed,
              voiceId: DEFAULT_FUSHA_VOICE_ID,
            }),
            signal: controller.signal,
          });
        }

        if (!response.ok) {
          throw new Error(`ElevenLabs TTS status ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error('Empty audio stream received from ElevenLabs');
        }

        const objectUrl = URL.createObjectURL(blob);
        elevenLabsAudioCache.set(cacheKey, objectUrl);
        playBlobUrl(objectUrl, trimmed, langCode);
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          setIsSpeaking(false);
          return;
        }
        setAudioError(
          'ElevenLabs audio unavailable — using fallback pronunciation.'
        );
        playWithFallbackBrowserTTS(trimmed, langCode);
      }
    },
    [playBlobUrl, playWithFallbackBrowserTTS, stop]
  );

  return {
    speak,
    pause,
    resume,
    stop,
    isSpeaking,
    isPaused,
    supported,
    currentText,
    currentLang,
    progress,
    duration,
    audioError,
  };
};
