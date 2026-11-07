import React, { useState, useEffect, useMemo } from 'react';
import {
  Volume2,
  Check,
  RotateCcw,
  Eye,
  Headphones,
  BookOpen,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import {
  WordBankItem,
  isWordMastered,
  normalizeArabicToken,
  isSameArabicWordInContext,
} from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { resolveVisualCueForKeyword } from '../utils/visualCueAssets';

interface ContextualFlashcardViewProps {
  wordBank: WordBankItem[];
  clozeMode: boolean;
  autoPlayAudio: boolean;
  onCompleteReview: (wordId: string, outcome: 'again' | 'got_it') => void;
  onNavigateToJournal: () => void;
}

type StudyExerciseMode = 'flashcard' | 'listenSelect';

const FALLBACK_FUSHA_DISTRACTORS: Array<{
  arabicWord: string;
  englishMeaning: string;
}> = [
  { arabicWord: 'الْمَسْجِدِ', englishMeaning: 'the mosque' },
  { arabicWord: 'الْقَهْوَةَ', englishMeaning: 'the coffee' },
  { arabicWord: 'الدَّفْتَرِ', englishMeaning: 'the notebook' },
  { arabicWord: 'الصَّبَاحِ', englishMeaning: 'the morning' },
  { arabicWord: 'الْكِتَابَ', englishMeaning: 'the book' },
  { arabicWord: 'الْحَدِيقَةِ', englishMeaning: 'the garden' },
  { arabicWord: 'سَكِينَةٍ', englishMeaning: 'tranquility' },
  { arabicWord: 'فَجْرًا', englishMeaning: 'at dawn' },
];

function cleanDisplayArabicWord(word: string): string {
  return word.replace(/[.,،؛؟!":«»()[\]]/g, '').trim() || word;
}

const ContextualFlashcardView: React.FC<ContextualFlashcardViewProps> = ({
  wordBank,
  clozeMode,
  autoPlayAudio,
  onCompleteReview,
  onNavigateToJournal,
}) => {
  const studyDeck = useMemo(() => {
    const unmastered = wordBank.filter((w) => !isWordMastered(w));
    const source = unmastered.length > 0 ? unmastered : wordBank;
    return [...source].sort((a, b) => {
      const aRemaining = Math.max(0, 20 - a.reviewCount);
      const bRemaining = Math.max(0, 20 - b.reviewCount);
      return aRemaining - bRemaining;
    });
  }, [wordBank]);

  const [exerciseMode, setExerciseMode] =
    useState<StudyExerciseMode>('flashcard');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [confirmedComprehension, setConfirmedComprehension] =
    useState<boolean>(false);
  const [showRoot, setShowRoot] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  // State for "Listen and Select" Exercise
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const { speak, isSpeaking } = useSpeechSynthesis();

  const currentCard =
    studyDeck.length > 0 ? studyDeck[currentIndex % studyDeck.length] : null;

  const targetDisplayWord = currentCard
    ? cleanDisplayArabicWord(currentCard.arabicWord)
    : '';

  // Build 4 multiple-choice Arabic options for "Listen and Select"
  const listenOptions = useMemo(() => {
    if (!currentCard) return [];
    const targetClean = cleanDisplayArabicWord(currentCard.arabicWord);
    const targetNorm = normalizeArabicToken(targetClean);

    const pool: string[] = [];
    const seenNorm = new Set<string>([targetNorm]);

    for (const item of wordBank) {
      const cleaned = cleanDisplayArabicWord(item.arabicWord);
      const norm = normalizeArabicToken(cleaned);
      if (norm && !seenNorm.has(norm)) {
        seenNorm.add(norm);
        pool.push(cleaned);
      }
    }

    for (const fallback of FALLBACK_FUSHA_DISTRACTORS) {
      if (pool.length >= 3) break;
      const cleaned = cleanDisplayArabicWord(fallback.arabicWord);
      const norm = normalizeArabicToken(cleaned);
      if (norm && !seenNorm.has(norm)) {
        seenNorm.add(norm);
        pool.push(cleaned);
      }
    }

    const distractors = pool.slice(0, 3);
    const combined = [targetClean, ...distractors];

    // Deterministic shuffle seeded by currentCard.id + currentIndex
    const seedStr = `${currentCard.id}-${currentIndex}`;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
    }

    return [...combined].sort((a, b) => {
      const hashA = ((a.charCodeAt(0) || 1) * 17 + seed) % 97;
      const hashB = ((b.charCodeAt(0) || 1) * 17 + seed) % 97;
      return hashA - hashB;
    });
  }, [currentCard, wordBank, currentIndex]);

  useEffect(() => {
    setImageError(false);
    setConfirmedComprehension(false);
    setShowRoot(false);
    setSelectedOption(null);

    if (!currentCard) return;

    const cleanWord = cleanDisplayArabicWord(currentCard.arabicWord);

    if (exerciseMode === 'listenSelect') {
      // Always play the target word audio in "Listen and Select" mode
      const timer = window.setTimeout(() => {
        speak(cleanWord, 'ar-SA');
      }, 150);
      return () => window.clearTimeout(timer);
    }

    if (autoPlayAudio) {
      const timer = window.setTimeout(() => {
        speak(
          `${cleanWord}. ${currentCard.contextSentenceArabic}`,
          'ar-SA'
        );
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [currentCard?.id, currentIndex, exerciseMode, autoPlayAudio]);

  if (!currentCard) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-12 pb-28 text-center">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-10 space-y-4">
          <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
            No Study Cards Yet
          </h1>
          <p className="text-sm text-[#6E665E]">
            Write a journal entry to generate contextual Fusha flashcards.
          </p>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-[#FDFBF7] bg-[#2D5A3C] rounded-xl"
          >
            Write Entry
          </button>
        </div>
      </div>
    );
  }

  const visualCue = resolveVisualCueForKeyword(currentCard.visualKeyword);
  const showVisualBanner = Boolean(visualCue && !imageError);

  const handleAction = (outcome: 'again' | 'got_it') => {
    onCompleteReview(currentCard.id, outcome);
    setSessionCount((prev) => prev + 1);
    setConfirmedComprehension(false);
    setShowRoot(false);
    setSelectedOption(null);
    setDragOffsetX(0);
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, studyDeck.length));
  };

  const handleSelectListenOption = (optionWord: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionWord);
    speak(optionWord, 'ar-SA');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (exerciseMode !== 'flashcard') return;
    setDragStartX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX === null || exerciseMode !== 'flashcard') return;
    setDragOffsetX(e.clientX - dragStartX);
  };

  const handlePointerUp = () => {
    if (dragStartX === null || exerciseMode !== 'flashcard') return;
    if (dragOffsetX > 95) {
      handleAction('got_it');
    } else if (dragOffsetX < -95) {
      handleAction('again');
    } else {
      setDragOffsetX(0);
    }
    setDragStartX(null);
  };

  const renderContextualArabicSentence = () => {
    const words = currentCard.contextSentenceArabic.split(/\s+/);

    return (
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-3xl sm:text-4xl text-[#2C2A29] leading-[2.0] text-center"
      >
        {words.map((w, idx) => {
          const isTarget = isSameArabicWordInContext(
            w,
            currentCard.arabicWord,
            currentCard.normalizedWord
          );

          if (!isTarget) {
            return <span key={`${w}-${idx}`}>{w} </span>;
          }

          if (clozeMode && !confirmedComprehension) {
            return (
              <button
                key={`${w}-${idx}`}
                type="button"
                onClick={() => setConfirmedComprehension(true)}
                title="Click to reveal word"
                className="inline-block mx-1.5 px-5 py-0.5 rounded-lg bg-[#EFE9DD] hover:bg-[#E2D9C5] border-b-2 border-[#C87D28] text-[#C87D28] font-mono-tabular text-lg align-middle transition-colors cursor-pointer"
              >
                [ ... ]
              </button>
            );
          }

          return (
            <span
              key={`${w}-${idx}`}
              className="inline-block mx-1 px-2.5 py-0.5 rounded-lg bg-[#2D5A3C]/15 text-[#2D5A3C] font-bold underline decoration-[#C87D28] decoration-2 underline-offset-8"
            >
              {w}
            </span>
          );
        })}
      </p>
    );
  };

  const isListenCorrect = selectedOption === targetDisplayWord;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Header & Exercise Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E6DEC8]">
        <div>
          <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
            Study
          </h1>
          <p className="text-xs text-[#6E665E] font-mono-tabular mt-0.5">
            {sessionCount} reviewed · Card {(currentIndex % studyDeck.length) + 1}{' '}
            of {studyDeck.length}
          </p>
        </div>

        {/* Exercise Type Selector */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DD] rounded-xl">
          <button
            type="button"
            onClick={() => setExerciseMode('flashcard')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              exerciseMode === 'flashcard'
                ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                : 'text-[#6E665E] hover:text-[#2C2A29]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#2D5A3C]" />
            <span>Contextual Card</span>
          </button>

          <button
            type="button"
            onClick={() => setExerciseMode('listenSelect')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              exerciseMode === 'listenSelect'
                ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                : 'text-[#6E665E] hover:text-[#2C2A29]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-[#C87D28]" />
            <span>Listen &amp; Select</span>
          </button>
        </div>
      </div>

      {exerciseMode === 'listenSelect' ? (
        /* EXERCISE 2: LISTEN AND SELECT THE WORD YOU HEAR */
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-10 shadow-xs space-y-8 text-center">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#C87D28]">
              Auditory Recognition
            </span>
            <h2 className="font-serif-notebook text-xl sm:text-2xl font-bold text-[#2C2A29]">
              Listen and select the word you hear
            </h2>
          </div>

          {/* Prominent ElevenLabs Audio Trigger (Target Arabic text hidden until answered) */}
          <div className="flex flex-col items-center justify-center py-2">
            <button
              type="button"
              onClick={() => speak(targetDisplayWord, 'ar-SA')}
              aria-label="Play target Arabic word audio"
              className={`w-24 h-24 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                isSpeaking
                  ? 'bg-[#2D5A3C] border-[#2D5A3C] text-[#FDFBF7]'
                  : 'bg-[#F6F1E6] hover:bg-[#EFE9DD] border-[#D8CFC0] text-[#2D5A3C]'
              }`}
            >
              <Volume2 className="w-9 h-9" />
              <span className="text-[11px] font-semibold">
                {isSpeaking ? 'Playing...' : 'Listen'}
              </span>
            </button>
          </div>

          {/* Multiple-Choice Grid of 3–4 Arabic Words */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl mx-auto">
            {listenOptions.map((optionWord, idx) => {
              const isSelected = selectedOption === optionWord;
              const isTargetWord = optionWord === targetDisplayWord;
              const hasAnswered = selectedOption !== null;

              let buttonStyle =
                'bg-[#FAF7F2] hover:bg-[#F3EDE0] border-[#E2D9C5] text-[#2C2A29]';

              if (hasAnswered) {
                if (isTargetWord) {
                  buttonStyle =
                    'bg-[#2D5A3C]/15 border-[#2D5A3C] text-[#2D5A3C] ring-1 ring-[#2D5A3C]';
                } else if (isSelected && !isTargetWord) {
                  buttonStyle = 'bg-red-50 border-red-400 text-red-900';
                } else {
                  buttonStyle =
                    'bg-[#FAF7F2]/60 border-[#EAE2D1] text-[#8C8377] opacity-70';
                }
              }

              return (
                <button
                  key={`${optionWord}-${idx}`}
                  type="button"
                  disabled={hasAnswered}
                  onClick={() => handleSelectListenOption(optionWord)}
                  dir="rtl"
                  lang="ar"
                  className={`min-h-[72px] px-5 py-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${buttonStyle}`}
                >
                  <span className="font-arabic text-3xl sm:text-4xl font-bold leading-relaxed">
                    {optionWord}
                  </span>

                  {hasAnswered && isTargetWord && (
                    <Check className="w-5 h-5 text-[#2D5A3C] shrink-0" />
                  )}
                  {hasAnswered && isSelected && !isTargetWord && (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Continue Banner */}
          {selectedOption !== null && (
            <div className="max-w-xl mx-auto p-5 rounded-2xl bg-[#F4EFE4] border border-[#E2D9C5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isListenCorrect ? 'text-[#2D5A3C]' : 'text-red-700'
                    }`}
                  >
                    {isListenCorrect ? 'Correct!' : 'Keep Practicing'}
                  </span>
                  <span aria-hidden="true" className="text-[#B8AFA0]">
                    ·
                  </span>
                  <span className="text-xs text-[#6E665E]">
                    Root: {currentCard.root}
                  </span>
                </div>
                <p className="text-base font-bold text-[#2C2A29]">
                  <span dir="rtl" className="font-arabic text-2xl mr-2">
                    {targetDisplayWord}
                  </span>{' '}
                  — {currentCard.englishMeaning}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleAction(isListenCorrect ? 'got_it' : 'again')
                }
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2D5A3C] hover:bg-[#23472F] text-xs font-semibold text-[#FDFBF7] transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Next Word</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* EXERCISE 1: CONTEXTUAL FLASHCARD */
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            transform: `translateX(${dragOffsetX * 0.35}px) rotate(${
              dragOffsetX * 0.02
            }deg)`,
          }}
          className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] shadow-xs overflow-hidden transition-transform duration-150 select-none"
        >
          {/* Optional Concrete Visual Cue (Only rendered when visualKeyword has a valid concrete illustration) */}
          {showVisualBanner && visualCue && (
            <div className="relative h-52 sm:h-60 w-full bg-[#F2ECE0] overflow-hidden border-b border-[#E2D9C5]">
              <img
                src={visualCue.imageUrl}
                alt={visualCue.caption}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Sentence Context & Audio Surface */}
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() =>
                  speak(
                    `${targetDisplayWord}. ${currentCard.contextSentenceArabic}`,
                    'ar-SA'
                  )
                }
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-[#F6F1E6] hover:bg-[#EFE9DD] border border-[#E2D9C5] transition-colors"
              >
                <Volume2 className="w-5 h-5 text-[#2D5A3C]" />
                <span
                  dir="rtl"
                  className="font-arabic text-4xl sm:text-5xl font-bold text-[#2C2A29] leading-relaxed"
                >
                  {targetDisplayWord}
                </span>
              </button>
              <p className="text-xs text-[#7A7267] mt-2">
                {currentCard.partOfSpeech}
              </p>
            </div>

            {/* Journal Sentence Context in Vocalized Fusha */}
            <div className="py-4 px-4 rounded-xl bg-[#FAF7F2] border border-[#EAE2D1]">
              {renderContextualArabicSentence()}
            </div>

            {/* Comprehension Reveal */}
            {!confirmedComprehension ? (
              <button
                type="button"
                onClick={() => setConfirmedComprehension(true)}
                className="w-full min-h-[48px] py-3 px-6 rounded-xl bg-[#EFE9DD] hover:bg-[#E5DEC9] text-sm font-semibold text-[#2C2A29] transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-[#2D5A3C]" />
                <span>Show Meaning</span>
              </button>
            ) : (
              <div className="p-5 rounded-xl bg-[#F4EFE4] border border-[#E2D9C5] space-y-3 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold text-[#2C2A29]">
                    {currentCard.englishMeaning}
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowRoot((prev) => !prev)}
                    className="min-h-[32px] px-3 py-1 text-xs font-medium text-[#5C554D] bg-[#FDFBF7] hover:bg-[#EFE9DD] border border-[#E2D9C5] rounded-md transition-colors"
                  >
                    {showRoot ? `Root: ${currentCard.root}` : 'See Root'}
                  </button>
                </div>

                <div className="pt-2 border-t border-[#E2D9C5]/80">
                  <p className="font-serif-notebook text-sm text-[#4A453E] italic">
                    “{currentCard.contextSentenceEnglish}”
                  </p>
                </div>
              </div>
            )}

            {/* Again / Got It */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleAction('again')}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-[#D8CFC0] bg-[#FAF7F2] hover:bg-[#EFE9DD] text-sm font-semibold text-[#5C554D] transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-[#C87D28]" />
                <span>Again</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('got_it')}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#2D5A3C] hover:bg-[#23472F] text-sm font-semibold text-[#FDFBF7] transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  Got It ({Math.min(20, currentCard.reviewCount + 1)}/20)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextualFlashcardView;
