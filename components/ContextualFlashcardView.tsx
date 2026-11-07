import React, { useState, useEffect, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  Check,
  RotateCcw,
  Eye,
  BookOpen,
} from 'lucide-react';
import { WordBankItem, isWordMastered, normalizeArabicToken } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { resolveVisualCueForKeyword } from '../utils/visualCueAssets';

interface ContextualFlashcardViewProps {
  wordBank: WordBankItem[];
  onCompleteReview: (wordId: string, outcome: 'again' | 'got_it') => void;
  onNavigateToJournal: () => void;
}

const ContextualFlashcardView: React.FC<ContextualFlashcardViewProps> = ({
  wordBank,
  onCompleteReview,
  onNavigateToJournal,
}) => {
  // Prioritize words that haven't reached 20 reviews yet, sorted by closest to 20/20 mastery
  const studyDeck = useMemo(() => {
    const unmastered = wordBank.filter((w) => !isWordMastered(w));
    const source = unmastered.length > 0 ? unmastered : wordBank;
    return [...source].sort((a, b) => {
      const aRemaining = Math.max(0, 20 - a.reviewCount);
      const bRemaining = Math.max(0, 20 - b.reviewCount);
      return aRemaining - bRemaining;
    });
  }, [wordBank]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [confirmedComprehension, setConfirmedComprehension] =
    useState<boolean>(false);
  const [clozeMode, setClozeMode] = useState<boolean>(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
  const [showRoot, setShowRoot] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  const { speak } = useSpeechSynthesis();

  const currentCard =
    studyDeck.length > 0 ? studyDeck[currentIndex % studyDeck.length] : null;

  useEffect(() => {
    setImageError(false);
    setConfirmedComprehension(false);
    setShowRoot(false);
    if (currentCard && autoPlayAudio) {
      const timer = window.setTimeout(() => {
        speak(
          `${currentCard.arabicWord}. ${currentCard.contextSentenceArabic}`,
          'ar-SA'
        );
      }, 180);
      return () => window.clearTimeout(timer);
    }
  }, [currentCard?.id, currentIndex, autoPlayAudio]);

  if (!currentCard) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-12 pb-28 text-center">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-10 space-y-4">
          <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
            No Vocabulary in Your Study Deck Yet
          </h1>
          <p className="text-sm text-[#6E665E]">
            Write a journal entry to generate vocalized Fusha context cards.
          </p>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-[#FDFBF7] bg-[#2D5A3C] rounded-xl"
          >
            Write in Journal
          </button>
        </div>
      </div>
    );
  }

  const visualCue = resolveVisualCueForKeyword(
    currentCard.visualKeyword,
    currentCard.englishMeaning
  );

  const handleAction = (outcome: 'again' | 'got_it') => {
    onCompleteReview(currentCard.id, outcome);
    setSessionCount((prev) => prev + 1);
    setConfirmedComprehension(false);
    setShowRoot(false);
    setDragOffsetX(0);
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, studyDeck.length));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragStartX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX === null) return;
    setDragOffsetX(e.clientX - dragStartX);
  };

  const handlePointerUp = () => {
    if (dragStartX === null) return;
    if (dragOffsetX > 95) {
      handleAction('got_it');
    } else if (dragOffsetX < -95) {
      handleAction('again');
    } else {
      setDragOffsetX(0);
    }
    setDragStartX(null);
  };

  // Highlight or cloze-blank the target word inside contextSentenceArabic
  const renderContextualArabicSentence = () => {
    const words = currentCard.contextSentenceArabic.split(/\s+/);
    const targetNorm = normalizeArabicToken(currentCard.normalizedWord);

    return (
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-3xl sm:text-4xl text-[#2C2A29] leading-[2.0] text-center"
      >
        {words.map((w, idx) => {
          const wNorm = normalizeArabicToken(w);
          const isTarget =
            w === currentCard.arabicWord ||
            (targetNorm.length > 0 && wNorm.includes(targetNorm));

          if (!isTarget) {
            return <span key={`${w}-${idx}`}>{w} </span>;
          }

          if (clozeMode && !confirmedComprehension) {
            return (
              <span
                key={`${w}-${idx}`}
                className="inline-block mx-1.5 px-5 py-0.5 rounded-lg bg-[#EFE9DD] border-b-2 border-[#C87D28] text-[#C87D28] font-mono-tabular text-lg align-middle"
              >
                [ ؟؟؟ ]
              </span>
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Study Header & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E6DEC8]">
        <div>
          <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
            High-Volume Contextual Study
          </h1>
          <p className="text-xs text-[#6E665E] font-mono-tabular mt-0.5">
            Tri-Modal Immersion (Picture + Journal Sentence + Fusha Audio) ·{' '}
            {sessionCount} reviewed this session
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Cloze Sentence Toggle */}
          <button
            type="button"
            onClick={() => setClozeMode((prev) => !prev)}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              clozeMode
                ? 'bg-[#2D5A3C] text-[#FDFBF7]'
                : 'bg-[#EFE9DD] text-[#5C554D] hover:text-[#2C2A29]'
            }`}
          >
            {clozeMode ? 'Cloze Blank: ON' : 'Cloze Blank: OFF'}
          </button>

          {/* Auto-Audio Toggle */}
          <button
            type="button"
            onClick={() => setAutoPlayAudio((prev) => !prev)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EFE9DD] text-[#5C554D] hover:text-[#2C2A29] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {autoPlayAudio ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#2D5A3C]" />
                <span>Audio First: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#8C8377]" />
                <span>Audio Muted</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* TRI-MODAL CONTEXTUAL CARD (SINGLE UNIFIED IMMERSION SURFACE - NO FLIP CARD) */}
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
        {/* Card Progress Top Bar */}
        <div className="px-6 py-3.5 bg-[#F6F1E6] border-b border-[#E2D9C5] flex items-center justify-between text-xs font-mono-tabular text-[#6E665E]">
          <span>
            Card {(currentIndex % studyDeck.length) + 1} of {studyDeck.length}
          </span>
          <div className="flex items-center gap-3">
            <span>Used: {currentCard.usageCount}/20</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#C87D28]">
              Reviewed: {currentCard.reviewCount}/20
            </span>
          </div>
        </div>

        {/* 1. VISUAL CUE / PICTURE */}
        <div className="relative h-56 sm:h-64 w-full bg-[#F2ECE0] overflow-hidden border-b border-[#E2D9C5]">
          {!imageError ? (
            <img
              src={visualCue.imageUrl}
              alt={visualCue.caption}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#F6F1E6] to-[#E8DFCE]">
              <BookOpen className="w-10 h-10 text-[#2D5A3C] mb-2" />
              <span className="font-serif-notebook text-sm text-[#5C554D]">
                {visualCue.caption}
              </span>
            </div>
          )}

          {/* Measured Scrim Overlay with Audio Replay Button */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 flex items-end justify-between gap-4">
            <span className="text-xs font-medium text-[#FDFBF7]/90">
              Visual Cue: {currentCard.visualKeyword}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                speak(
                  `${currentCard.arabicWord}. ${currentCard.contextSentenceArabic}`,
                  'ar-SA'
                );
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#FDFBF7]/95 text-[#2C2A29] hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Volume2 className="w-4 h-4 text-[#2D5A3C]" />
              <span>Listen in Fusha</span>
            </button>
          </div>
        </div>

        {/* 2. SENTENCE CONTEXT & TARGET VOCALIZED WORD */}
        <div className="p-6 sm:p-8 space-y-6 text-center">
          {/* Target Vocalized Word Callout */}
          <div>
            <button
              type="button"
              onClick={() => speak(currentCard.arabicWord, 'ar-SA')}
              className="inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-[#F6F1E6] hover:bg-[#EFE9DD] border border-[#E2D9C5] transition-colors"
            >
              <Volume2 className="w-5 h-5 text-[#2D5A3C]" />
              <span
                dir="rtl"
                className="font-arabic text-4xl sm:text-5xl font-bold text-[#2C2A29]"
              >
                {currentCard.arabicWord}
              </span>
            </button>
            <p className="text-xs text-[#7A7267] mt-2">
              {currentCard.transliteration} · {currentCard.partOfSpeech}
            </p>
          </div>

          {/* Journal Sentence Context in Vocalized Fusha */}
          <div className="py-4 px-4 rounded-xl bg-[#FAF7F2] border border-[#EAE2D1]">
            {renderContextualArabicSentence()}
          </div>

          {/* 3. COMPREHENSION CONFIRMATION REVEAL */}
          {!confirmedComprehension ? (
            <button
              type="button"
              onClick={() => setConfirmedComprehension(true)}
              className="w-full min-h-[48px] py-3 px-6 rounded-xl bg-[#EFE9DD] hover:bg-[#E5DEC9] text-sm font-semibold text-[#2C2A29] transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-[#2D5A3C]" />
              <span>Tap to Confirm Meaning &amp; Sentence Context</span>
            </button>
          ) : (
            <div className="p-5 rounded-xl bg-[#F4EFE4] border border-[#E2D9C5] space-y-3 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-[#7A7267] block">
                    English Meaning:
                  </span>
                  <p className="text-lg font-bold text-[#2C2A29]">
                    {currentCard.englishMeaning}
                  </p>
                </div>

                {/* Subtle [See Root] Pill Button */}
                <button
                  type="button"
                  onClick={() => setShowRoot((prev) => !prev)}
                  className="min-h-[34px] px-3 py-1 text-xs font-medium text-[#5C554D] bg-[#FDFBF7] hover:bg-[#EFE9DD] border border-[#E2D9C5] rounded-md transition-colors"
                >
                  {showRoot ? `Root: ${currentCard.root}` : 'See Root'}
                </button>
              </div>

              <div className="pt-2 border-t border-[#E2D9C5]/80">
                <span className="text-xs text-[#7A7267] block">
                  Journal Sentence Translation:
                </span>
                <p className="font-serif-notebook text-sm text-[#4A453E] italic">
                  “{currentCard.contextSentenceEnglish}”
                </p>
              </div>
            </div>
          )}

          {/* HIGH-VOLUME ACTION BUTTONS: AGAIN / GOT IT (+1 REVIEW COUNT) */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleAction('again')}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-[#D8CFC0] bg-[#FAF7F2] hover:bg-[#EFE9DD] text-sm font-semibold text-[#5C554D] transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-[#C87D28]" />
              <span>Again (Keep Practicing)</span>
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
    </div>
  );
};

export default ContextualFlashcardView;
