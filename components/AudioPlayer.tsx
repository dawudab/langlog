import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AudioPlayerProps {
  text: string;
  langCode: string;
  onSpeak: (text: string, langCode: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  text,
  langCode,
  onSpeak,
  onPause,
  onResume,
  onStop,
  isSpeaking,
  isPaused,
  className = '',
}) => {
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const duration = useRef(0);

  // Estimate duration based on text length (average reading speed: ~150 words per minute)
  useEffect(() => {
    const wordCount = text.split(/\s+/).length;
    duration.current = (wordCount / 2.5) * 1000; // Convert to milliseconds
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [text]);

  const startProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    startTime.current = Date.now() - (progress * duration.current);
    
    progressInterval.current = setInterval(() => {
      if (startTime.current) {
        const elapsed = Date.now() - startTime.current;
        const newProgress = Math.min(elapsed / duration.current, 1);
        setProgress(newProgress);
        
        if (newProgress >= 1) {
          setProgress(0);
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
          }
        }
      }
    }, 100);
  };

  const handlePlayPause = () => {
    if (!isSpeaking && !isPaused) {
      // Start new playback
      onSpeak(text, langCode);
      setProgress(0);
      startProgress();
    } else if (isPaused) {
      // Resume playback
      onResume();
      startProgress();
    } else {
      // Pause playback
      onPause();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }
  };

  const handleStop = () => {
    onStop();
    setProgress(0);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSpeaking && !isPaused) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const seekTime = position * duration.current;
    
    // Update progress
    setProgress(position);
    startTime.current = Date.now() - seekTime;
    
    // Restart speech from the new position
    onStop();
    // Note: The Web Speech API doesn't support seeking, so we restart from the beginning
    // A more advanced solution would require a different TTS service with seeking support
    onSpeak(text, langCode);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentTime = progress * duration.current / 1000; // Convert to seconds
  const totalTime = duration.current / 1000; // Convert to seconds

  return (
    <div className={`flex flex-col w-full ${className}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className="p-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white"
            aria-label={isSpeaking && !isPaused ? 'Pause' : 'Play'}
          >
            {isSpeaking && !isPaused ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <button
            onClick={handleStop}
            className="p-2 rounded-full bg-slate-600 hover:bg-slate-500 text-white"
            aria-label="Stop"
          >
            <RotateCcw size={16} />
          </button>
          
          <span className="text-xs text-slate-400">
            {formatTime(currentTime)} / {formatTime(totalTime)}
          </span>
        </div>
        
        <div className="flex items-center">
          <Volume2 size={16} className="text-slate-400" />
        </div>
      </div>
      
      <div 
        className="w-full h-2 bg-slate-700 rounded-full mt-2 cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        <div 
          className="h-full bg-sky-500 transition-all duration-100 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};

export default AudioPlayer;
