import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { ReviewGrade, SM2Flashcard } from '../types';
import {
  getPrioritizedStudyQueue,
  previewNextIntervalDays,
} from '../services/sm2Engine';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface SRSStudyEngineProps {
  cards: SM2Flashcard[];
  onGradeCard: (card: SM2Flashcard, grade: ReviewGrade) => void;
  onNavigateToJournal: () => void;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

const SRSStudyEngine: React.FC<SRSStudyEngineProps> = ({
  cards,
  onGradeCard,
  onNavigateToJournal,
}) => {
  const [practiceAllMode, setPracticeAllMode] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [sessionReviewedCount, setSessionReviewedCount] = useState<number>(0);

  // Physics-based Drag Gesture State
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [swipeExitDirection, setSwipeExitDirection] =
    useState<ReviewGrade | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedDistanceRef = useRef<number>(0);

  const { speak } = useSpeechSynthesis();

  const studyQueue = useMemo(
    () => getPrioritizedStudyQueue(cards, practiceAllMode),
    [cards, practiceAllMode]
  );

  const activeCard: SM2Flashcard | undefined = studyQueue[0];

  useEffect(() => {
    setIsFlipped(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeExitDirection(null);
  }, [activeCard?.id]);

  // Keyboard shortcuts for rapid study (Space = flip, 1/Left = Hard, 2/Up = Good, 3/Right = Easy)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCard) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerGradeWithPhysics('hard');
      } else if (e.key === '2' || e.key === 'ArrowUp') {
        e.preventDefault();
        triggerGradeWithPhysics('good');
      } else if (e.key === '3' || e.key === 'ArrowRight') {
        e.preventDefault();
        triggerGradeWithPhysics('easy');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCard]);

  const triggerGradeWithPhysics = (grade: ReviewGrade) => {
    if (!activeCard || swipeExitDirection) return;
    setSwipeExitDirection(grade);
    const exitX = grade === 'hard' ? -420 : grade === 'easy' ? 420 : 0;
    const exitY = grade === 'good' ? -340 : 20;
    setDragOffset({ x: exitX, y: exitY });

    window.setTimeout(() => {
      onGradeCard(activeCard, grade);
      setSessionReviewedCount((c) => c + 1);
      setSwipeExitDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsFlipped(false);
    }, 180);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    movedDistanceRef.current = 0;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    movedDistanceRef.current = Math.hypot(dx, dy);
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const { x, y } = dragOffset;
    dragStartRef.current = null;

    // If tap (minimal movement), flip the card
    if (movedDistanceRef.current < 10) {
      setDragOffset({ x: 0, y: 0 });
      setIsFlipped((prev) => !prev);
      return;
    }

    // Check swipe thresholds
    if (x < -105) {
      triggerGradeWithPhysics('hard');
    } else if (x > 105) {
      triggerGradeWithPhysics('easy');
    } else if (y < -95 && Math.abs(x) < 90) {
      triggerGradeWithPhysics('good');
    } else {
      // Snap back with spring ease
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const newCardsCount = cards.filter((c) => c.isNew).length;
  const dueNowCount = getPrioritizedStudyQueue(cards, false).length;
  const masteredCount = cards.filter((c) => c.interval >= 6).length;

  const activeSwipeHint: ReviewGrade | null =
    dragOffset.x < -65
      ? 'hard'
      : dragOffset.x > 65
      ? 'easy'
      : dragOffset.y < -65
      ? 'good'
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-12">
      {/* Top Study Metrics Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b border-stone-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Spaced Repetition Study Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            Modified SM-2 · Prioritizing is_new: true roots first ·{' '}
            {sessionReviewedCount} reviewed this session
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
          <div>
            <span className="text-slate-400 dark:text-slate-500">
              New Priority:{' '}
            </span>
            <strong className="font-semibold text-sky-600 dark:text-sky-400">
              {newCardsCount}
            </strong>
          </div>
          <span aria-hidden="true">·</span>
          <div>
            <span className="text-slate-400 dark:text-slate-500">
              Due Queue:{' '}
            </span>
            <strong className="font-semibold text-slate-900 dark:text-white">
              {dueNowCount}
            </strong>
          </div>
          <span aria-hidden="true">·</span>
          <div>
            <span className="text-slate-400 dark:text-slate-500">
              Long-Term (&ge;6d):{' '}
            </span>
            <strong className="font-semibold text-emerald-600 dark:text-emerald-400">
              {masteredCount}
            </strong>
          </div>
        </div>
      </div>

      {!activeCard ? (
        <div className="bg-white dark:bg-[#121824] rounded-3xl border border-stone-200/90 dark:border-slate-800/90 p-10 text-center max-w-xl mx-auto my-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Daily SM-2 Queue Complete
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            You have reviewed all due and new vocabulary cards for today. Write
            a new journal entry to extract fresh roots, or practice the full
            deck ahead of schedule.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateToJournal}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Write New Journal Entry</span>
            </button>
            {cards.length > 0 && (
              <button
                type="button"
                onClick={() => setPracticeAllMode(true)}
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice All ({cards.length} Cards)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto">
          {/* Card Queue Position & SM-2 Telemetry */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>
                Queue: 1 of {studyQueue.length} remaining
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  activeCard.isNew
                    ? 'text-sky-600 dark:text-sky-400 font-semibold'
                    : ''
                }
              >
                {activeCard.isNew ? 'is_new: true (Priority)' : 'Scheduled Review'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span>EF {activeCard.easeFactor.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span>Reps {activeCard.repetitions}</span>
              <span aria-hidden="true">·</span>
              <span>Int {activeCard.interval}d</span>
            </div>
          </div>

          {/* Tactile Physics-Based 3D Flashcard */}
          <div className="perspective-1000 select-none my-2">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${
                  dragOffset.x * 0.045
                }deg)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 190ms cubic-bezier(0.16, 1, 0.3, 1)',
                touchAction: 'none',
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div
                className={`relative w-full min-h-[340px] sm:min-h-[370px] preserve-3d transition-transform duration-300 ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* FRONT OF CARD: Target Conjugated Word + Context */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-[#141B29] rounded-3xl border border-stone-200 dark:border-slate-800 p-7 sm:p-9 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {activeCard.targetLanguage === 'ar'
                        ? 'Arabic Target Vocabulary'
                        : 'English Target Vocabulary'}
                    </span>

                    {activeSwipeHint ? (
                      <span className="font-mono-tabular font-semibold uppercase text-sky-600 dark:text-sky-400">
                        Release for {activeSwipeHint}
                      </span>
                    ) : (
                      <span>Tap to flip · Drag Left / Up / Right</span>
                    )}
                  </div>

                  <div className="my-auto py-6 text-center space-y-4">
                    <p
                      dir={
                        activeCard.targetLanguage === 'ar' ||
                        ARABIC_CHAR_REGEX.test(activeCard.wordConjugated)
                          ? 'rtl'
                          : 'ltr'
                      }
                      className={`font-bold text-slate-900 dark:text-white break-words ${
                        activeCard.targetLanguage === 'ar' ||
                        ARABIC_CHAR_REGEX.test(activeCard.wordConjugated)
                          ? 'font-arabic text-4xl sm:text-5xl leading-relaxed'
                          : 'text-3xl sm:text-4xl tracking-tight'
                      }`}
                    >
                      {activeCard.wordConjugated}
                    </p>

                    {activeCard.context && (
                      <p
                        dir={
                          activeCard.targetLanguage === 'ar' ||
                          ARABIC_CHAR_REGEX.test(activeCard.context)
                            ? 'rtl'
                            : 'ltr'
                        }
                        className={`text-slate-500 dark:text-slate-400 max-w-md mx-auto ${
                          activeCard.targetLanguage === 'ar' ||
                          ARABIC_CHAR_REGEX.test(activeCard.context)
                            ? 'font-arabic text-lg'
                            : 'text-sm'
                        }`}
                      >
                        “{activeCard.context}”
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono-tabular text-slate-400 dark:text-slate-500">
                      Root hint hidden — tap card to reveal
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(
                          activeCard.wordConjugated,
                          activeCard.targetLanguage === 'ar' ||
                            ARABIC_CHAR_REGEX.test(activeCard.wordConjugated)
                            ? 'ar-SA'
                            : 'en-US'
                        );
                      }}
                      aria-label="Pronounce word"
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* BACK OF CARD: Triliteral Root + Meaning + Context */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white dark:bg-[#141B29] rounded-3xl border border-sky-500/40 dark:border-sky-400/40 p-7 sm:p-9 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Meaning & Triliteral Root Analysis</span>
                    <span className="font-mono-tabular text-sky-600 dark:text-sky-400 font-medium">
                      Root: {activeCard.root}
                    </span>
                  </div>

                  <div className="my-auto py-4 text-center space-y-4">
                    <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                      Conjugated:{' '}
                      <span
                        dir={
                          activeCard.targetLanguage === 'ar' ? 'rtl' : 'ltr'
                        }
                        className="font-arabic font-semibold text-base text-slate-800 dark:text-slate-200"
                      >
                        {activeCard.wordConjugated}
                      </span>
                    </div>

                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                      {activeCard.meaning}
                    </p>

                    <div className="pt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                        Triliteral Root / Base Form (الجذر)
                      </span>
                      <p
                        dir={
                          ARABIC_CHAR_REGEX.test(activeCard.root)
                            ? 'rtl'
                            : 'ltr'
                        }
                        className={`font-bold text-sky-700 dark:text-sky-400 ${
                          ARABIC_CHAR_REGEX.test(activeCard.root)
                            ? 'font-arabic text-2xl tracking-widest'
                            : 'font-mono-tabular text-lg'
                        }`}
                      >
                        {activeCard.root}
                      </p>
                    </div>

                    {activeCard.context && (
                      <p
                        dir={
                          activeCard.targetLanguage === 'ar' ? 'rtl' : 'ltr'
                        }
                        className={`text-slate-500 dark:text-slate-400 max-w-md mx-auto pt-1 ${
                          activeCard.targetLanguage === 'ar'
                            ? 'font-arabic text-base'
                            : 'text-xs'
                        }`}
                      >
                        “{activeCard.context}”
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Swipe or choose recall grade below
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(
                          activeCard.wordConjugated,
                          activeCard.targetLanguage === 'ar' ||
                            ARABIC_CHAR_REGEX.test(activeCard.wordConjugated)
                            ? 'ar-SA'
                            : 'en-US'
                        );
                      }}
                      aria-label="Pronounce word"
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ergonomic Thumb-Zone SM-2 Grading Controls (Hard / Good / Easy) */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <button
              type="button"
              onClick={() => triggerGradeWithPhysics('hard')}
              className="min-h-[56px] px-4 py-3 rounded-2xl bg-white dark:bg-[#141B29] border border-stone-200 dark:border-slate-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 transition-all active:scale-[0.98] flex flex-col items-center justify-center"
            >
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Hard
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                {previewNextIntervalDays(activeCard, 'hard')}d · Swipe Left
              </span>
            </button>

            <button
              type="button"
              onClick={() => triggerGradeWithPhysics('good')}
              className="min-h-[56px] px-4 py-3 rounded-2xl bg-white dark:bg-[#141B29] border border-stone-200 dark:border-slate-800 hover:border-sky-500/60 dark:hover:border-sky-500/60 transition-all active:scale-[0.98] flex flex-col items-center justify-center"
            >
              <span className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                Good
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                {previewNextIntervalDays(activeCard, 'good')}d · Swipe Up
              </span>
            </button>

            <button
              type="button"
              onClick={() => triggerGradeWithPhysics('easy')}
              className="min-h-[56px] px-4 py-3 rounded-2xl bg-white dark:bg-[#141B29] border border-stone-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition-all active:scale-[0.98] flex flex-col items-center justify-center"
            >
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Easy
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                {previewNextIntervalDays(activeCard, 'easy')}d · Swipe Right
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SRSStudyEngine;
