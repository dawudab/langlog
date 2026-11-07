import React, { useState, useMemo } from 'react';
import {
  Volume2,
  Feather,
  BookOpen,
  Trash2,
  Layers,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  JournalEntry,
  WordBankItem,
  WordToken,
  isWordMastered,
  normalizeArabicToken,
} from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface NotebookJournalViewProps {
  entries: JournalEntry[];
  wordBank: WordBankItem[];
  activeEntryId: string | null;
  isWritingMode: boolean;
  onSelectEntry: (entryId: string) => void;
  onStartWriting: () => void;
  onSubmitJournalEntry: (text: string) => Promise<JournalEntry>;
  onDeleteEntry: (entryId: string) => void;
  onNavigateToStudy: () => void;
  onNavigateToWordBank: () => void;
}

type WordCategoryTab =
  | 'all'
  | 'nouns'
  | 'verbs'
  | 'adjectivesParticles'
  | 'previouslyUsed';

interface CategorizedTokenItem {
  token: WordToken;
  key: string;
  usageCount: number;
  reviewCount: number;
  mastered: boolean;
  isPreviouslyUsed: boolean;
  category: 'nouns' | 'verbs' | 'adjectivesParticles';
}

const NotebookJournalView: React.FC<NotebookJournalViewProps> = ({
  entries,
  wordBank,
  activeEntryId,
  isWritingMode,
  onSelectEntry,
  onStartWriting,
  onSubmitJournalEntry,
  onDeleteEntry,
  onNavigateToStudy,
  onNavigateToWordBank,
}) => {
  const [draftText, setDraftText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeAudioWord, setActiveAudioWord] = useState<string | null>(null);
  const [peekedWords, setPeekedWords] = useState<Record<string, boolean>>({});
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>(
    {}
  );
  const [activeCategoryTab, setActiveCategoryTab] =
    useState<WordCategoryTab>('all');

  const { speak, isSpeaking, stop } = useSpeechSynthesis();

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) || entries[0] || null,
    [entries, activeEntryId]
  );

  const wordBankLookup = useMemo(() => {
    const map = new Map<string, WordBankItem>();
    wordBank.forEach((item) => {
      map.set(normalizeArabicToken(item.normalizedWord), item);
      map.set(normalizeArabicToken(item.arabicWord), item);
    });
    return map;
  }, [wordBank]);

  const getTokenLearningState = (token: WordToken) => {
    const norm =
      normalizeArabicToken(token.normalizedWord) ||
      normalizeArabicToken(token.arabicWord);
    const bankItem = wordBankLookup.get(norm);
    const usageCount = bankItem ? bankItem.usageCount : token.usageCount || 1;
    const reviewCount = bankItem
      ? bankItem.reviewCount
      : token.reviewCount || 0;
    const mastered = isWordMastered({ usageCount, reviewCount });
    const isPreviouslyUsed = Boolean(
      token.isPreviouslyUsed || mastered || usageCount > 1 || reviewCount > 0
    );
    return { usageCount, reviewCount, mastered, isPreviouslyUsed };
  };

  // Parse unique entry words with POS category and `isPreviouslyUsed` status
  const parsedEntryWords = useMemo(() => {
    if (!activeEntry) return [] as CategorizedTokenItem[];

    const seen = new Set<string>();
    const list: CategorizedTokenItem[] = [];

    activeEntry.tokens.forEach((token, idx) => {
      const normKey =
        normalizeArabicToken(token.normalizedWord) ||
        normalizeArabicToken(token.arabicWord) ||
        `${token.arabicWord}-${idx}`;

      if (seen.has(normKey)) return;
      seen.add(normKey);

      const state = getTokenLearningState(token);
      const pos = (token.partOfSpeech || '').toLowerCase();

      let category: 'nouns' | 'verbs' | 'adjectivesParticles' =
        'adjectivesParticles';
      if (pos.includes('noun')) {
        category = 'nouns';
      } else if (pos.includes('verb')) {
        category = 'verbs';
      }

      list.push({
        token,
        key: `${normKey}-${idx}`,
        ...state,
        category,
      });
    });

    return list;
  }, [activeEntry, wordBankLookup]);

  const categoryCounts = useMemo(() => {
    return {
      all: parsedEntryWords.length,
      nouns: parsedEntryWords.filter(
        (w) => !w.isPreviouslyUsed && w.category === 'nouns'
      ).length,
      verbs: parsedEntryWords.filter(
        (w) => !w.isPreviouslyUsed && w.category === 'verbs'
      ).length,
      adjectivesParticles: parsedEntryWords.filter(
        (w) => !w.isPreviouslyUsed && w.category === 'adjectivesParticles'
      ).length,
      previouslyUsed: parsedEntryWords.filter((w) => w.isPreviouslyUsed).length,
    };
  }, [parsedEntryWords]);

  const filteredCategoryWords = useMemo(() => {
    switch (activeCategoryTab) {
      case 'nouns':
        return parsedEntryWords.filter(
          (w) => !w.isPreviouslyUsed && w.category === 'nouns'
        );
      case 'verbs':
        return parsedEntryWords.filter(
          (w) => !w.isPreviouslyUsed && w.category === 'verbs'
        );
      case 'adjectivesParticles':
        return parsedEntryWords.filter(
          (w) => !w.isPreviouslyUsed && w.category === 'adjectivesParticles'
        );
      case 'previouslyUsed':
        return parsedEntryWords.filter((w) => w.isPreviouslyUsed);
      case 'all':
      default:
        return parsedEntryWords;
    }
  }, [parsedEntryWords, activeCategoryTab]);

  const wordCount =
    draftText.trim().length === 0 ? 0 : draftText.trim().split(/\s+/).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim() || isLoading) return;

    if (wordCount > 250) {
      setSubmitError('Please keep your entry within 250 words.');
      return;
    }

    setIsLoading(true);
    setSubmitError(null);
    try {
      const created = await onSubmitJournalEntry(draftText.trim());
      if (created) {
        setDraftText('');
        setActiveCategoryTab('all');
        onSelectEntry(created.id);
      }
    } catch (error: any) {
      setSubmitError(
        error?.message || 'Could not translate entry. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakWord = (arabicWord: string) => {
    setActiveAudioWord(arabicWord);
    speak(arabicWord, 'ar-SA');
    window.setTimeout(() => {
      setActiveAudioWord((prev) => (prev === arabicWord ? null : prev));
    }, 1100);
  };

  const toggleRootReveal = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRoots((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const togglePeekMastered = (key: string, show?: boolean) => {
    setPeekedWords((prev) => ({
      ...prev,
      [key]: show !== undefined ? show : !prev[key],
    }));
  };

  const formattedToday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const renderWordChip = (item: CategorizedTokenItem) => {
    const { token, key, mastered, isPreviouslyUsed } = item;
    const isPlayingThis = activeAudioWord === token.arabicWord;
    const isRootOpen = Boolean(expandedRoots[key]);

    return (
      <div
        key={key}
        onClick={() => handleSpeakWord(token.arabicWord)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSpeakWord(token.arabicWord);
          }
        }}
        className={`group inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
          isPlayingThis
            ? 'bg-[#2D5A3C]/12 border-[#2D5A3C] shadow-xs'
            : isPreviouslyUsed
            ? 'bg-[#F4EFE4]/85 border-[#DDD4C0] hover:border-[#2D5A3C]/60 hover:bg-[#EFE8D8]'
            : 'bg-[#FAF7F2] border-[#E5DEC9] hover:border-[#C87D28] hover:bg-[#F5EFE2]'
        }`}
      >
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
            isPlayingThis
              ? 'bg-[#2D5A3C] text-[#FDFBF7]'
              : 'bg-[#EDE6D6] text-[#2D5A3C] group-hover:bg-[#2D5A3C] group-hover:text-[#FDFBF7]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
        </span>

        <div className="flex items-baseline gap-2.5">
          <span
            dir="rtl"
            className="font-arabic text-2xl font-bold text-[#2C2A29] leading-none"
          >
            {token.arabicWord}
          </span>
          <span className="text-xs font-semibold text-[#5C554D]">
            {token.englishMeaning}
          </span>
        </div>

        {mastered && (
          <span
            title="Mastered (20/20)"
            className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#2D5A3C]/15 text-[#2D5A3C]"
          >
            <Check className="w-3 h-3" />
          </span>
        )}

        {token.root && token.root !== '—' && (
          <button
            type="button"
            onClick={(e) => toggleRootReveal(key, e)}
            className="min-h-[26px] px-2 py-0.5 text-[11px] font-medium text-[#6E665E] bg-[#EFE9DD] hover:bg-[#E2D9C5] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {isRootOpen ? token.root : 'Root'}
          </button>
        )}
      </div>
    );
  };

  const categoryTabs: Array<{ id: WordCategoryTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: categoryCounts.all },
    { id: 'nouns', label: 'Nouns', count: categoryCounts.nouns },
    { id: 'verbs', label: 'Verbs', count: categoryCounts.verbs },
    {
      id: 'adjectivesParticles',
      label: 'Adjectives & Particles',
      count: categoryCounts.adjectivesParticles,
    },
    {
      id: 'previouslyUsed',
      label: 'Previously Used',
      count: categoryCounts.previouslyUsed,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#E6DEC8]">
        <div>
          <p className="text-xs text-[#7A7267]">{formattedToday}</p>
          <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29] mt-0.5">
            {isWritingMode || !activeEntry ? 'Notebook' : 'Translated Entry'}
          </h1>
        </div>

        {activeEntry && (
          <div className="flex items-center gap-1 p-1 bg-[#EFE9DD] rounded-xl">
            <button
              type="button"
              onClick={onStartWriting}
              className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isWritingMode
                  ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                  : 'text-[#6E665E] hover:text-[#2C2A29]'
              }`}
            >
              <Feather className="w-3.5 h-3.5 text-[#2D5A3C]" />
              <span>Write</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectEntry(activeEntry.id)}
              className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                !isWritingMode
                  ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                  : 'text-[#6E665E] hover:text-[#2C2A29]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#C87D28]" />
              <span>Reading View</span>
            </button>
          </div>
        )}
      </div>

      {isWritingMode || !activeEntry ? (
        /* 1. CLEAN WRITING CANVAS */
        <div className="space-y-8">
          <form
            onSubmit={handleSubmit}
            className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] shadow-xs overflow-hidden"
          >
            {submitError && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Ruled Notebook Paper Area */}
            <div className="relative px-6 sm:px-12 py-6 notebook-ruled min-h-[340px]">
              <div
                aria-hidden="true"
                className="hidden sm:block absolute top-0 bottom-0 left-8 w-px bg-[#D9B8A6]/50"
              />
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isLoading}
                rows={8}
                placeholder="Write your journal entry..."
                className="w-full sm:pl-4 resize-none border-0 bg-transparent focus:outline-none focus:ring-0 font-serif-notebook text-lg sm:text-xl text-[#2C2A29] placeholder:text-[#A39B8E] leading-[40px] disabled:opacity-60"
              />
            </div>

            {/* Footer Action Bar */}
            <div className="px-6 sm:px-10 py-4 bg-[#F6F1E6] border-t border-[#E2D9C5] flex flex-wrap items-center justify-between gap-4">
              <div
                className={`text-xs font-mono-tabular ${
                  wordCount > 250 ? 'text-red-700 font-semibold' : 'text-[#6E665E]'
                }`}
              >
                <span>{wordCount} / 250 words</span>
              </div>

              <div className="flex items-center gap-3">
                {draftText.trim().length > 0 && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setDraftText('')}
                    className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-[#6E665E] hover:text-[#2C2A29] transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!draftText.trim() || isLoading || wordCount > 250}
                  className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-[#FDFBF7] bg-[#2D5A3C] hover:bg-[#23472F] rounded-xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Translating...</span>
                    </>
                  ) : (
                    <>
                      <Feather className="w-4 h-4" />
                      <span>Translate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Past Entries List */}
          {entries.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-serif-notebook text-lg font-bold text-[#2C2A29]">
                Entries ({entries.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.map((entry) => {
                  const dateLabel = new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(entry.createdAt));

                  return (
                    <div
                      key={entry.id}
                      onClick={() => onSelectEntry(entry.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectEntry(entry.id);
                        }
                      }}
                      className="text-left bg-[#FDFBF7] hover:bg-[#F6F1E6] rounded-xl border border-[#E2D9C5] p-5 transition-colors cursor-pointer flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2 font-mono-tabular">
                          <span>
                            {dateLabel} · {entry.tokens.length} words
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEntry(entry.id);
                            }}
                            aria-label="Delete entry"
                            className="p-1 text-[#9E9587] hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p
                          dir="rtl"
                          className="font-arabic text-2xl text-[#2C2A29] line-clamp-2 text-right"
                        >
                          {entry.fullArabicTranslation}
                        </p>
                      </div>
                      <p className="text-xs text-[#6E665E] line-clamp-1 font-serif-notebook italic">
                        “{entry.originalText}”
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* 2. TRANSLATED ENTRY PAGE & NATURAL INTERLINEAR READER (NO BOXES, NO STATS) */
        <div className="space-y-8">
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-10 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAE2D1]">
              <span className="text-xs text-[#6E665E]">
                Tap any word for audio · Hold mastered words to peek
              </span>

              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) {
                    stop();
                  } else {
                    speak(activeEntry.fullArabicTranslation, 'ar-SA');
                  }
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/20 text-xs font-semibold text-[#2D5A3C] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-4 h-4" />
                <span>{isSpeaking ? 'Stop' : 'Listen All'}</span>
              </button>
            </div>

            {/* Natural Flowing Interlinear Paragraph (No Bounding Boxes, No Stats) */}
            <div
              dir="rtl"
              lang="ar"
              className="flex flex-wrap items-baseline gap-x-5 gap-y-6 py-4 leading-relaxed"
            >
              {activeEntry.tokens.map((token, idx) => {
                const { mastered } = getTokenLearningState(token);
                const tokenKey = `${token.arabicWord}-${idx}`;
                const isPeeking = Boolean(peekedWords[tokenKey]);
                const isPlayingThis = activeAudioWord === token.arabicWord;

                return (
                  <span
                    key={tokenKey}
                    onClick={() => handleSpeakWord(token.arabicWord)}
                    onPointerDown={() => {
                      if (mastered) togglePeekMastered(tokenKey, true);
                    }}
                    onPointerUp={() => {
                      if (mastered) togglePeekMastered(tokenKey, false);
                    }}
                    onPointerLeave={() => {
                      if (mastered && isPeeking)
                        togglePeekMastered(tokenKey, false);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSpeakWord(token.arabicWord);
                      }
                    }}
                    className="inline-flex flex-col items-center select-none cursor-pointer group"
                  >
                    <span
                      className={`font-arabic text-3xl sm:text-4xl leading-[1.6] transition-colors ${
                        isPlayingThis
                          ? 'text-[#2D5A3C]'
                          : 'text-[#2C2A29] group-hover:text-[#2D5A3C]'
                      }`}
                    >
                      {token.arabicWord}
                    </span>

                    {(!mastered || isPeeking) && (
                      <span
                        dir="ltr"
                        className="mt-0.5 text-xs font-medium text-[#6E665E] text-center"
                      >
                        {token.englishMeaning}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#EAE2D1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="font-serif-notebook text-base text-[#4A453E] italic">
                “{activeEntry.originalText}”
              </p>

              <button
                type="button"
                onClick={onNavigateToStudy}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#C87D28] hover:bg-[#B26D1F] rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Study Words</span>
              </button>
            </div>
          </section>

          {/* 3. SCROLLABLE, CATEGORIZED WORD LIST WITH FILTER TABS */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif-notebook text-xl font-bold text-[#2C2A29]">
                  Entry Vocabulary ({parsedEntryWords.length})
                </h2>
                <p className="text-xs text-[#7A7267] mt-0.5">
                  Tap any word chip for ElevenLabs Fusha audio · Tap Root to inspect its triliteral root
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToWordBank}
                className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-[#2D5A3C] bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/15 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Word Bank
              </button>
            </div>

            {/* Category Tabs: All, Nouns, Verbs, Adjectives & Particles, Previously Used */}
            <div
              role="tablist"
              aria-label="Vocabulary categories"
              className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFE9DD] rounded-xl"
            >
              {categoryTabs.map((tab) => {
                const isActive = activeCategoryTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategoryTab(tab.id)}
                    className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-xs'
                        : 'text-[#6E665E] hover:text-[#2C2A29]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] font-mono-tabular ${
                        isActive ? 'text-[#2D5A3C]' : 'text-[#8C8377]'
                      }`}
                    >
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fixed-Height Scrollable Word List Container */}
            <div className="max-h-64 overflow-y-auto border-t border-b border-stone-200 py-4 notebook-scrollbar">
              {filteredCategoryWords.length === 0 ? (
                <p className="text-xs text-[#7A7267] text-center py-8">
                  No words in this category for this entry.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5 pr-1">
                  {filteredCategoryWords.map((item) => renderWordChip(item))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default NotebookJournalView;
