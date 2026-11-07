import { useState, useEffect, useCallback, useRef } from 'react';
import { getPronunciationAudio } from '../src/services/elevenLabsService';

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

  const cleanupAudio = useCallback(() => {
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

  const speak = useCallback(
    async (text: string, langCode = 'ar-SA') => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stop();
      setAudioError(null);
      setCurrentText(trimmed);
      setCurrentLang(langCode);
      setIsSpeaking(true);

      const audio = await getPronunciationAudio(trimmed);

      if (audio) {
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
          playWithFallbackBrowserTTS(trimmed, langCode);
        };

        audio.play().catch(() => {
          playWithFallbackBrowserTTS(trimmed, langCode);
        });
      } else {
        setAudioError('ElevenLabs audio unavailable — using fallback pronunciation.');
        playWithFallbackBrowserTTS(trimmed, langCode);
      }
    },
    [playWithFallbackBrowserTTS, stop]
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
