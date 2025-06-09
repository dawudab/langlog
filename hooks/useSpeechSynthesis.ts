import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechSynthesisHook {
  speak: (text: string, langCode: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  supported: boolean;
  currentText: string | null;
  currentLang: string | null;
  progress: number; // 0 to 1
  duration: number; // in seconds
}

export const useSpeechSynthesis = (): SpeechSynthesisHook => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressInterval = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const pauseTime = useRef<number>(0);
  const elapsedTime = useRef<number>(0);

  const updateProgress = useCallback(() => {
    if (!startTime.current) return;
    
    const now = Date.now();
    const elapsed = (now - startTime.current + elapsedTime.current) / 1000; // in seconds
    const newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);

    if (newProgress >= 1) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      setProgress(0);
      setDuration(0);
      elapsedTime.current = 0;
    }
  }, [duration]);

  useEffect(() => {
    if (isSpeaking && !isPaused) {
      progressInterval.current = window.setInterval(updateProgress, 100);
    } else if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isSpeaking, isPaused, updateProgress]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSupported(true);
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
        }
      };
      loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      } else {
        setTimeout(loadVoices, 200);
      }
    } else {
      setSupported(false);
    }

    return () => {
      stop();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (supported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentText(null);
      setCurrentLang(null);
      setProgress(0);
      setDuration(0);
      elapsedTime.current = 0;
      utteranceRef.current = null;
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
  }, [supported]);

  const pause = useCallback(() => {
    if (supported && speechSynthesis.speaking && !isPaused) {
      speechSynthesis.pause();
      setIsPaused(true);
      pauseTime.current = Date.now();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
  }, [supported, isPaused]);

  const resume = useCallback(() => {
    if (supported && isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      elapsedTime.current += Date.now() - pauseTime.current;
      startTime.current = Date.now();
      progressInterval.current = window.setInterval(updateProgress, 100);
    }
  }, [supported, isPaused, updateProgress]);

  const speak = useCallback((text: string, langCode: string) => {
    if (!supported || !text) return;

    // If the same text is being spoken, toggle pause/resume
    if (currentText === text && currentLang === langCode) {
      if (isPaused) {
        resume();
      } else if (isSpeaking) {
        pause();
      } else {
        stop();
        const utterance = new SpeechSynthesisUtterance(text);
        setupUtterance(utterance, text, langCode);
      }
      return;
    }

    // If new text or language, stop current and start new
    stop();
    
    const utterance = new SpeechSynthesisUtterance(text);
    setupUtterance(utterance, text, langCode);
  }, [supported, voices, currentText, currentLang, isPaused, isSpeaking, pause, resume, stop]);

  const setupUtterance = (utterance: SpeechSynthesisUtterance, text: string, langCode: string) => {
    utteranceRef.current = utterance;
    setCurrentText(text);
    setCurrentLang(langCode);
    
    const voice = voices.find(v => v.lang === langCode) || 
                 voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (voice) {
      utterance.voice = voice;
    } else {
      utterance.lang = langCode;
    }
    
    // Estimate duration based on word count (average 0.6s per word)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = Math.max(1, wordCount * 0.6);
    setDuration(estimatedDuration);
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      startTime.current = Date.now();
      elapsedTime.current = 0;
      setProgress(0);
      progressInterval.current = window.setInterval(updateProgress, 100);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentText(null);
      setCurrentLang(null);
      setProgress(0);
      setDuration(0);
      elapsedTime.current = 0;
      utteranceRef.current = null;
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
    
    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentText(null);
      setCurrentLang(null);
      setProgress(0);
      setDuration(0);
      utteranceRef.current = null;
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
    
    speechSynthesis.speak(utterance);
  };

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
    duration
  };
};
