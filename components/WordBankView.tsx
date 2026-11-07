import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Search,
  Volume2,
  Layers,
  Check,
  RotateCcw,
} from 'lucide-react';
import { WordBankItem } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface WordBankViewProps {
  wordBank: WordBankItem[];
  onToggleMasteryDemo: (wordId: string) => void;
  onNavigateToStudy: () => void;
}

type FilterState = 'all' | 'learning' | 'mastered';

interface RowData {
  items: WordBankItem[];
  revealedRoots: Record<string, boolean>;
  activeAudioWord: string | null;
  onToggleRoot: (id: string, e: React.MouseEvent) => void;
  onSpeak: (arabicWord: string) => void;
  onToggleMastery: (wordId: string) => void;
}

const ROW_HEIGHT = 92;

const Row: React.FC<ListChildComponentProps<RowData>> = ({
  index,
  style,
  data,
}) => {
  const {
    items,
    revealedRoots,
    activeAudioWord,
    onToggleRoot,
    onSpeak,
    onToggleMastery,
  } = data;
  const item = items[index];
  if (!item) return null;

  const isMastered = item.usageCount >= 20 && item.reviewCount >= 20;
  const isRootShown = Boolean(revealedRoots[item.id]);
  const isPlayingThis = activeAudioWord === item.arabicWord;
  const displayArabic =
    item.arabicWord.replace(/[.,،؛؟!":«»()[\]]/g, '').trim() ||
    item.arabicWord;

  return (
    <div
      style={style}
      onClick={() => onSpeak(item.arabicWord)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSpeak(item.arabicWord);
        }
      }}
      className="px-5 sm:px-6 border-b border-[#EAE2D1] bg-[#FDFBF7] hover:bg-[#F7F2E7]/80 transition-colors cursor-pointer flex items-center justify-between gap-4 select-none"
    >
      {/* Left: Audio Play Button + Vocalized Fusha Word + English Meaning */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSpeak(item.arabicWord);
          }}
          aria-label={`Pronounce ${displayArabic}`}
          className={`min-h-[40px] min-w-[40px] p-2 rounded-xl transition-colors flex items-center justify-center shrink-0 ${
            isPlayingThis
              ? 'bg-[#2D5A3C] text-[#FDFBF7]'
              : 'bg-[#F3EDE0] hover:bg-[#E6DEC8] text-[#2D5A3C]'
          }`}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        <div className="flex flex-wrap items-baseline gap-2.5 min-w-0">
          <span
            dir="rtl"
            className="font-arabic text-2xl sm:text-3xl font-bold text-[#2C2A29] leading-relaxed"
          >
            {displayArabic}
          </span>
          <span aria-hidden="true" className="text-[#B8AFA0]">
            ·
          </span>
          <span className="text-sm sm:text-base font-semibold text-[#2C2A29] truncate">
            {item.englishMeaning}
          </span>
        </div>
      </div>

      {/* Right: Usage/Review Progress Indicators + [See Root] Toggle + Mastery Toggle */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono-tabular text-[#5C554D]">
          <span>Used: {item.usageCount}/20</span>
          <span aria-hidden="true">·</span>
          <span>Reviewed: {item.reviewCount}/20</span>
        </div>

        <span className="sm:hidden text-[11px] font-mono-tabular text-[#5C554D]">
          {item.usageCount}/20u · {item.reviewCount}/20r
        </span>

        <button
          type="button"
          onClick={(e) => onToggleRoot(item.id, e)}
          className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#5C554D] bg-[#F3EDE0] hover:bg-[#E6DEC8] rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          {isRootShown ? `Root: ${item.root}` : 'See Root'}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMastery(item.id);
          }}
          title={isMastered ? 'Reset to Learning' : 'Mark 20/20 Mastered'}
          className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
            isMastered
              ? 'bg-[#2D5A3C]/15 text-[#2D5A3C] hover:bg-[#2D5A3C]/25'
              : 'bg-[#EFE9DD] text-[#6E665E] hover:bg-[#E2D9C5] hover:text-[#2C2A29]'
          }`}
        >
          {isMastered ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span className="hidden md:inline">20/20</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 hidden" />
              <Check className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mark 20/20</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const WordBankView: React.FC<WordBankViewProps> = ({
  wordBank,
  onToggleMasteryDemo,
  onNavigateToStudy,
}) => {
  const [filterMode, setFilterMode] = useState<FilterState>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedRoots, setRevealedRoots] = useState<Record<string, boolean>>(
    {}
  );
  const [activeAudioWord, setActiveAudioWord] = useState<string | null>(null);

  const { speak } = useSpeechSynthesis();

  const masteredCount = useMemo(
    () =>
      wordBank.filter((w) => w.usageCount >= 20 && w.reviewCount >= 20).length,
    [wordBank]
  );
  const learningCount = wordBank.length - masteredCount;

  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return wordBank
      .filter((item) => {
        const isMastered = item.usageCount >= 20 && item.reviewCount >= 20;
        if (filterMode === 'mastered' && !isMastered) return false;
        if (filterMode === 'learning' && isMastered) return false;

        if (!q) return true;
        return (
          item.arabicWord.toLowerCase().includes(q) ||
          item.normalizedWord.toLowerCase().includes(q) ||
          item.englishMeaning.toLowerCase().includes(q) ||
          item.root.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aScore = a.usageCount + a.reviewCount;
        const bScore = b.usageCount + b.reviewCount;
        return bScore - aScore;
      });
  }, [wordBank, filterMode, searchQuery]);

  const handleToggleRoot = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedRoots((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleSpeak = useCallback(
    (arabicWord: string) => {
      const cleanWord =
        arabicWord.replace(/[.,،؛؟!":«»()[\]]/g, '').trim() || arabicWord;
      setActiveAudioWord(arabicWord);
      speak(cleanWord, 'ar-SA');
      window.setTimeout(() => {
        setActiveAudioWord((prev) => (prev === arabicWord ? null : prev));
      }, 1100);
    },
    [speak]
  );

  const itemData = useMemo<RowData>(
    () => ({
      items: filteredWords,
      revealedRoots,
      activeAudioWord,
      onToggleRoot: handleToggleRoot,
      onSpeak: handleSpeak,
      onToggleMastery: onToggleMasteryDemo,
    }),
    [
      filteredWords,
      revealedRoots,
      activeAudioWord,
      handleToggleRoot,
      handleSpeak,
      onToggleMasteryDemo,
    ]
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-4 pb-24 md:pb-10 flex flex-col h-[calc(100vh-72px)]">
      {/* 1. STICKY FILTER BAR */}
      <div className="sticky top-0 z-10 bg-[#FAF7F2] pt-2 pb-4 border-b border-[#E6DEC8] space-y-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
              Word Bank
            </h1>
            <p className="text-xs text-[#6E665E] mt-0.5 font-mono-tabular">
              {wordBank.length} words · {masteredCount} mastered (20/20)
            </p>
          </div>

          {wordBank.length > 0 && (
            <button
              type="button"
              onClick={onNavigateToStudy}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#C87D28] hover:bg-[#B26D1F] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Study</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Three Toggle Buttons: All, Learning, Mastered */}
          <div
            role="tablist"
            aria-label="Filter vocabulary by mastery state"
            className="flex items-center gap-1.5 p-1 bg-[#EFE9DD] rounded-xl self-start"
          >
            {(
              [
                { id: 'all', label: `All (${wordBank.length})` },
                { id: 'learning', label: `Learning (${learningCount})` },
                { id: 'mastered', label: `Mastered (${masteredCount})` },
              ] as const
            ).map((tab) => {
              const isActive = filterMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilterMode(tab.id)}
                  className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#2C2A29] text-[#FAF7F2] shadow-xs'
                      : 'text-[#6E665E] hover:text-[#2C2A29]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#8C8377] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Arabic, meaning, or root..."
              className="w-full min-h-[40px] pl-10 pr-4 py-1.5 text-sm bg-[#FDFBF7] border border-[#E2D9C5] rounded-xl text-[#2C2A29] placeholder:text-[#9E9587] focus:outline-none focus:border-[#2D5A3C]"
            />
          </div>
        </div>
      </div>

      {/* 2. VIRTUALIZED LIST FILLING REMAINING VERTICAL SPACE */}
      <div className="flex-1 min-h-[420px] mt-4 bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] shadow-xs overflow-hidden flex flex-col">
        {filteredWords.length === 0 ? (
          <div className="h-full flex items-center justify-center p-10 text-center text-sm text-[#7A7267]">
            {wordBank.length === 0
              ? 'Your Word Bank is empty. Write a journal entry to add words.'
              : 'No words match your filter.'}
          </div>
        ) : (
          <div className="relative flex-1 w-full h-full min-h-[420px]">
            <AutoSizer defaultHeight={480} defaultWidth={800}>
              {({ height, width }) => (
                <FixedSizeList
                  height={Math.max(height || 0, 360)}
                  width={Math.max(width || 0, 300)}
                  itemCount={filteredWords.length}
                  itemSize={ROW_HEIGHT}
                  itemData={itemData}
                  className="notebook-scrollbar"
                >
                  {Row}
                </FixedSizeList>
              )}
            </AutoSizer>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordBankView;
