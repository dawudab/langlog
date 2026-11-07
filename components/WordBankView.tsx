import React, { useState, useMemo } from 'react';
import {
  Search,
  Volume2,
  Layers,
  Check,
  RotateCcw,
} from 'lucide-react';
import { WordBankItem, isWordMastered } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface WordBankViewProps {
  wordBank: WordBankItem[];
  onToggleMasteryDemo: (wordId: string) => void;
  onNavigateToStudy: () => void;
}

const WordBankView: React.FC<WordBankViewProps> = ({
  wordBank,
  onToggleMasteryDemo,
  onNavigateToStudy,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'learning' | 'mastered'>(
    'all'
  );
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [revealedRoots, setRevealedRoots] = useState<Record<string, boolean>>(
    {}
  );

  const { speak } = useSpeechSynthesis();

  const masteredCount = useMemo(
    () => wordBank.filter((w) => isWordMastered(w)).length,
    [wordBank]
  );
  const learningCount = wordBank.length - masteredCount;

  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return wordBank
      .filter((item) => {
        const mastered = isWordMastered(item);
        if (filterMode === 'learning' && mastered) return false;
        if (filterMode === 'mastered' && !mastered) return false;
        if (!q) return true;
        return (
          item.arabicWord.toLowerCase().includes(q) ||
          item.normalizedWord.toLowerCase().includes(q) ||
          item.englishMeaning.toLowerCase().includes(q) ||
          item.transliteration.toLowerCase().includes(q) ||
          item.contextSentenceArabic.toLowerCase().includes(q) ||
          item.contextSentenceEnglish.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aScore = a.usageCount + a.reviewCount;
        const bScore = b.usageCount + b.reviewCount;
        return bScore - aScore;
      });
  }, [wordBank, searchQuery, filterMode]);

  const handleToggleRoot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedRoots((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Notebook Index Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-[#E6DEC8]">
        <div>
          <h1 className="font-serif-notebook text-2xl sm:text-3xl font-bold text-[#2C2A29]">
            Fusha Word Bank &amp; 20/20 Index
          </h1>
          <p className="text-xs text-[#6E665E] mt-1 font-mono-tabular">
            {wordBank.length} total words · {masteredCount} Mastered (20/20) ·{' '}
            {learningCount} Learning
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToStudy}
          className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#C87D28] hover:bg-[#B26D1F] rounded-xl transition-colors flex items-center gap-1.5 self-start md:self-auto whitespace-nowrap shrink-0"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Review in Contextual Flashcards</span>
        </button>
      </div>

      {/* Search & Learning / Mastered (20/20) Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8377] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Arabic word, transliteration, or English meaning..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm bg-[#FDFBF7] border border-[#E2D9C5] rounded-xl text-[#2C2A29] placeholder:text-[#9E9587] focus:outline-none focus:border-[#2D5A3C]"
          />
        </div>

        {/* Interactive Segmented Filter Control */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DD] rounded-xl self-start">
          {(
            [
              { id: 'all', label: `All (${wordBank.length})` },
              { id: 'learning', label: `Learning (${learningCount})` },
              { id: 'mastered', label: `Mastered 20/20 (${masteredCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterMode === tab.id
                  ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                  : 'text-[#6E665E] hover:text-[#2C2A29]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Word Bank Notebook List */}
      <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] divide-y divide-[#EAE2D1] shadow-xs">
        {filteredWords.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#7A7267]">
            No Fusha words match your current search or mastery filter.
          </div>
        ) : (
          filteredWords.map((item) => {
            const mastered = isWordMastered(item);
            const isExpanded = selectedWordId === item.id;
            const isRootShown = Boolean(revealedRoots[item.id]);
            const usagePct = Math.min(
              100,
              Math.round((item.usageCount / 20) * 100)
            );
            const reviewPct = Math.min(
              100,
              Math.round((item.reviewCount / 20) * 100)
            );

            return (
              <div
                key={item.id}
                onClick={() => {
                  speak(item.arabicWord, 'ar-SA');
                  setSelectedWordId((prev) =>
                    prev === item.id ? null : item.id
                  );
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    speak(item.arabicWord, 'ar-SA');
                    setSelectedWordId((prev) =>
                      prev === item.id ? null : item.id
                    );
                  }
                }}
                className="p-5 sm:p-6 hover:bg-[#F7F2E7]/70 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Vocalized Word, Meaning & Audio */}
                  <div className="flex items-start gap-3.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(item.arabicWord, 'ar-SA');
                      }}
                      aria-label={`Pronounce ${item.arabicWord}`}
                      className="min-h-[42px] min-w-[42px] p-2.5 rounded-xl bg-[#F3EDE0] hover:bg-[#E6DEC8] text-[#2D5A3C] transition-colors flex items-center justify-center shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <span
                          dir="rtl"
                          className="font-arabic text-3xl font-bold text-[#2C2A29]"
                        >
                          {item.arabicWord}
                        </span>
                        <span className="text-xs italic text-[#7A7267]">
                          ({item.transliteration})
                        </span>
                        <span aria-hidden="true" className="text-[#B8AFA0]">
                          ·
                        </span>
                        <span className="text-base font-semibold text-[#2C2A29]">
                          {item.englishMeaning}
                        </span>
                        <span aria-hidden="true" className="text-[#B8AFA0]">
                          ·
                        </span>
                        <span className="text-xs text-[#7A7267]">
                          {item.partOfSpeech}
                        </span>
                      </div>

                      <p className="text-xs text-[#7A7267] mt-0.5">
                        Tap row to play audio &amp; inspect journal context
                      </p>
                    </div>
                  </div>

                  {/* Right: 20/20 Progress Indicators & Subtle [See Root] */}
                  <div className="flex flex-wrap items-center gap-4 sm:justify-end shrink-0">
                    {/* Usage & Review Bars */}
                    <div className="flex items-center gap-4 text-xs font-mono-tabular text-[#5C554D]">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span>Used: {item.usageCount}/20</span>
                        </div>
                        <div className="w-24 h-1.5 bg-[#EAE2D1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2D5A3C] transition-all"
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span>Reviewed: {item.reviewCount}/20</span>
                        </div>
                        <div className="w-24 h-1.5 bg-[#EAE2D1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#C87D28] transition-all"
                            style={{ width: `${reviewPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subtle [See Root] Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleRoot(item.id, e)}
                      className="min-h-[34px] px-3 py-1 text-xs font-medium text-[#5C554D] bg-[#F3EDE0] hover:bg-[#E6DEC8] rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      {isRootShown ? `Root: ${item.root}` : 'See Root'}
                    </button>

                    {/* Mastery Status Indicator */}
                    <span
                      className={`text-xs font-semibold font-mono-tabular ${
                        mastered ? 'text-[#2D5A3C]' : 'text-[#C87D28]'
                      }`}
                    >
                      {mastered ? 'Mastered (20/20)' : 'Learning'}
                    </span>
                  </div>
                </div>

                {/* Expanded Context Sentence Drawer */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 pt-4 border-t border-[#EAE2D1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF7F2] rounded-xl p-4"
                  >
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[#7A7267]">
                        Journal Context Sentence:
                      </span>
                      <p
                        dir="rtl"
                        className="font-arabic text-2xl text-[#2C2A29] text-right sm:text-left"
                      >
                        {item.contextSentenceArabic}
                      </p>
                      <p className="font-serif-notebook text-sm text-[#5C554D] italic">
                        “{item.contextSentenceEnglish}”
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          speak(item.contextSentenceArabic, 'ar-SA')
                        }
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#2D5A3C] bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/20 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Play Sentence</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleMasteryDemo(item.id)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#5C554D] bg-[#EFE9DD] hover:bg-[#E2D9C5] rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {mastered ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset to Learning</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#2D5A3C]" />
                            <span>Simulate 20/20 Mastery</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WordBankView;
