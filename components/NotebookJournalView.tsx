import React, { useState, useMemo } from 'react';
import {
  Volume2,
  Feather,
  BookOpen,
  Eye,
  Trash2,
  Layers,
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
  onFastForwardMastery?: (normalizedWord: string) => void;
}

const NOTEBOOK_PROMPTS: Array<{ title: string; text: string }> = [
  {
    title: 'Dawn at the Mosque',
    text: 'I went to the mosque at dawn and recited the Noble Quran in tranquility and quietude.',
  },
  {
    title: 'Morning Coffee & Notebook',
    text: 'In the early morning I drank Arabic coffee and wrote my thoughts in my daily journal to learn Fusha Arabic.',
  },
  {
    title: 'Evening Study in the Garden',
    text: 'Before sunset I sat in the quiet garden, read a chapter of classical Arabic literature, and reflected on my day.',
  },
];

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
  onFastForwardMastery,
}) => {
  const [draftText, setDraftText] = useState<string>('');
  const [isTurningPage, setIsTurningPage] = useState<boolean>(false);
  const [activeAudioWord, setActiveAudioWord] = useState<string | null>(null);
  const [peekedWords, setPeekedWords] = useState<Record<string, boolean>>({});
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>(
    {}
  );

  const { speak, isSpeaking, stop } = useSpeechSynthesis();

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) || entries[0] || null,
    [entries, activeEntryId]
  );

  // Map normalizedWord -> live WordBankItem so 20/20 Mastery reflects latest usage & review counts immediately
  const wordBankLookup = useMemo(() => {
    const map = new Map<string, WordBankItem>();
    wordBank.forEach((item) => {
      map.set(normalizeArabicToken(item.normalizedWord), item);
      map.set(normalizeArabicToken(item.arabicWord), item);
    });
    return map;
  }, [wordBank]);

  const getLiveStatsForToken = (token: WordToken) => {
    const norm =
      normalizeArabicToken(token.normalizedWord) ||
      normalizeArabicToken(token.arabicWord);
    const bankItem = wordBankLookup.get(norm);
    const usageCount = bankItem ? bankItem.usageCount : token.usageCount || 1;
    const reviewCount = bankItem
      ? bankItem.reviewCount
      : token.reviewCount || 0;
    const mastered = isWordMastered({ usageCount, reviewCount });
    return { usageCount, reviewCount, mastered, norm };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim() || isTurningPage) return;

    setIsTurningPage(true);
    try {
      // Smooth calming "Ink & Page Turn" transition while Gemini processes
      const minAnimationDelay = new Promise((resolve) =>
        window.setTimeout(resolve, 1100)
      );
      const [created] = await Promise.all([
        onSubmitJournalEntry(draftText.trim()),
        minAnimationDelay,
      ]);
      if (created) {
        setDraftText('');
        onSelectEntry(created.id);
      }
    } finally {
      setIsTurningPage(false);
    }
  };

  const handleSpeakWord = (arabicWord: string) => {
    setActiveAudioWord(arabicWord);
    speak(arabicWord, 'ar-SA');
    window.setTimeout(() => {
      setActiveAudioWord((prev) => (prev === arabicWord ? null : prev));
    }, 1200);
  };

  const toggleRootReveal = (key: string) => {
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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const wordCount =
    draftText.trim().length === 0 ? 0 : draftText.trim().split(/\s+/).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Top Notebook Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#E6DEC8]">
        <div>
          <p className="text-xs text-[#7A7267] font-medium">{formattedToday}</p>
          <h1 className="font-serif-notebook text-2xl sm:text-3xl font-bold text-[#2C2A29] mt-0.5">
            {isWritingMode || !activeEntry
              ? 'Daily Arabic Acquisition Journal'
              : 'Translated Fusha Notebook Page'}
          </h1>
        </div>

        {/* Mode Switcher between Writing Page and Translated Entry View */}
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
            <span>Write Entry</span>
          </button>

          {activeEntry && (
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
              <span>Translated Page</span>
            </button>
          )}
        </div>
      </div>

      {/* Calming Ink & Page Turn Transition State */}
      {isTurningPage ? (
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-12 sm:p-16 text-center shadow-xs animate-page-turn my-6">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#2D5A3C]/10 text-[#2D5A3C] flex items-center justify-center">
            <Feather className="w-6 h-6 animate-bounce" />
          </div>
          <h2 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
            Turning the Page &amp; Vocalizing into Fusha...
          </h2>
          <p className="text-sm text-[#6E665E] max-w-md mx-auto mt-2 leading-relaxed">
            Inscribing your thoughts in fully vocalized Modern Standard Arabic
            (الْعَرَبِيَّةُ الْفُصْحَى) with Harakat and updating your 20/20
            Word Bank.
          </p>
          <p
            dir="rtl"
            className="font-arabic text-3xl text-[#2D5A3C] mt-6 tracking-wide"
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        </div>
      ) : isWritingMode || !activeEntry ? (
        /* 1. THE WRITING CANVAS ("THE SIMPLE NOTEBOOK") */
        <div className="space-y-8">
          <form
            onSubmit={handleSubmit}
            className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] shadow-xs overflow-hidden"
          >
            {/* Notebook Header Strip */}
            <div className="px-6 sm:px-10 py-4 bg-[#F6F1E6] border-b border-[#E2D9C5] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#6E665E]">
                <span>
                  Write in English (or mix in Arabic words you know)
                </span>
                <span aria-hidden="true"> · </span>
                <span>Translated strictly into vocalized Fusha Arabic</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {NOTEBOOK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.title}
                    type="button"
                    onClick={() => setDraftText(prompt.text)}
                    className="px-2.5 py-1 text-xs font-medium text-[#2D5A3C] bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/15 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {prompt.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Ruled Notebook Paper Area */}
            <div className="relative px-6 sm:px-12 py-6 notebook-ruled min-h-[360px]">
              {/* Subtle vertical notebook margin line */}
              <div
                aria-hidden="true"
                className="hidden sm:block absolute top-0 bottom-0 left-8 w-px bg-[#D9B8A6]/50"
              />
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={8}
                placeholder="Write honestly about your day, your studies, or a quiet moment... When you turn the page, every word will be vocalized in Fusha Arabic and tracked toward your 20/20 mastery."
                className="w-full sm:pl-4 resize-none border-0 bg-transparent focus:outline-none focus:ring-0 font-serif-notebook text-lg sm:text-xl text-[#2C2A29] placeholder:text-[#A39B8E] leading-[40px]"
              />
            </div>

            {/* Notebook Footer Action Bar */}
            <div className="px-6 sm:px-10 py-4 bg-[#F6F1E6] border-t border-[#E2D9C5] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#6E665E] font-mono-tabular">
                <span>
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <span aria-hidden="true"> · </span>
                <span>20 uses + 20 reviews = Direct Arabic Immersion</span>
              </div>

              <div className="flex items-center gap-3">
                {draftText.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftText('')}
                    className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-[#6E665E] hover:text-[#2C2A29] transition-colors"
                  >
                    Clear Page
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!draftText.trim()}
                  className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-[#FDFBF7] bg-[#2D5A3C] hover:bg-[#23472F] rounded-xl transition-all active:scale-[0.99] disabled:opacity-45 flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Feather className="w-4 h-4" />
                  <span>Turn Page &amp; Translate to Fusha</span>
                </button>
              </div>
            </div>
          </form>

          {/* Recent Notebook Pages Index */}
          {entries.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-serif-notebook text-lg font-bold text-[#2C2A29]">
                Previous Notebook Pages ({entries.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.map((entry) => {
                  const dateLabel = new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(entry.createdAt));
                  const masteredInEntry = entry.tokens.filter(
                    (t) => getLiveStatsForToken(t).mastered
                  ).length;

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
                            {dateLabel} · {entry.tokens.length} Fusha words ·{' '}
                            {masteredInEntry} mastered (20/20)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEntry(entry.id);
                            }}
                            aria-label="Delete notebook entry"
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
        /* 2. THE TRANSLATED ENTRY PAGE & THE "20/20 MASTERY RULE" */
        <div className="space-y-8">
          {/* Interlinear Tokenized Notebook Sheet */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-10 shadow-xs space-y-6">
            {/* Sheet Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAE2D1]">
              <div className="text-xs text-[#6E665E]">
                <span className="font-semibold text-[#2C2A29]">
                  Interlinear Fusha Reader
                </span>
                <span aria-hidden="true"> · </span>
                <span>Tap any Arabic word to hear pronunciation</span>
                <span aria-hidden="true"> · </span>
                <span className="text-[#2D5A3C] font-medium">
                  Mastered (20/20) words hide English (hold word to peek)
                </span>
              </div>

              <div className="flex items-center gap-2">
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
                  <span>
                    {isSpeaking ? 'Stop Audio' : 'Listen to Full Passage'}
                  </span>
                </button>
              </div>
            </div>

            {/* INTERLINEAR TOKENIZED DISPLAY (RTL FLOW) */}
            <div
              dir="rtl"
              lang="ar"
              className="flex flex-wrap items-stretch gap-x-3 gap-y-5 py-4"
            >
              {activeEntry.tokens.map((token, idx) => {
                const { usageCount, reviewCount, mastered } =
                  getLiveStatsForToken(token);
                const tokenKey = `${token.arabicWord}-${idx}`;
                const isPeeking = Boolean(peekedWords[tokenKey]);
                const isPlayingThis = activeAudioWord === token.arabicWord;

                return (
                  <div
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
                    className={`group select-none cursor-pointer rounded-xl px-3.5 py-2.5 border transition-all flex flex-col items-center justify-between min-w-[82px] ${
                      isPlayingThis
                        ? 'bg-[#2D5A3C]/15 border-[#2D5A3C] scale-[1.02]'
                        : mastered
                        ? 'bg-[#F4EFE4]/70 border-[#D5CEBE] hover:border-[#2D5A3C]'
                        : 'bg-[#FAF7F2] border-[#E6DEC8] hover:border-[#C87D28]'
                    }`}
                  >
                    {/* Vocalized Fusha Arabic Token */}
                    <span className="font-arabic text-3xl sm:text-4xl text-[#2C2A29] leading-[1.6] tracking-normal">
                      {token.arabicWord}
                    </span>

                    {/* Interlinear English Sub-Gloss OR 20/20 Mastered Immersion State */}
                    <div
                      dir="ltr"
                      className="mt-1.5 pt-1.5 border-t border-[#E6DEC8]/80 w-full text-center"
                    >
                      {mastered && !isPeeking ? (
                        <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-[#2D5A3C]">
                          <Check className="w-3 h-3" />
                          <span>20/20 · Hold to peek</span>
                        </div>
                      ) : (
                        <span className="block text-xs font-medium text-[#5C554D]">
                          {token.englishMeaning}
                        </span>
                      )}
                      <span className="block text-[10px] font-mono-tabular text-[#8C8377] mt-0.5">
                        {usageCount}/20u · {reviewCount}/20r
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Original English Notebook Reflection */}
            <div className="pt-4 border-t border-[#EAE2D1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-[#8C8377] block mb-0.5">
                  Your Original English Reflection:
                </span>
                <p className="font-serif-notebook text-base text-[#4A453E] italic">
                  “{activeEntry.originalText}”
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onNavigateToStudy}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#C87D28] hover:bg-[#B26D1F] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Practice in Contextual Study</span>
                </button>
              </div>
            </div>
          </section>

          {/* BOTTOM WORD LIST (Extracted Words + Subtle [See Root] Option) */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-[#EAE2D1]">
              <div>
                <h2 className="font-serif-notebook text-xl font-bold text-[#2C2A29]">
                  Words from This Entry ({activeEntry.tokens.length})
                </h2>
                <p className="text-xs text-[#6E665E] mt-0.5">
                  Automatically saved &amp; incremented in your Word Bank ·
                  Reach 20 uses and 20 reviews to unlock pure Arabic reading
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToWordBank}
                className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-[#2D5A3C] bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/15 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Open Full Word Bank
              </button>
            </div>

            <div className="divide-y divide-[#EAE2D1]">
              {activeEntry.tokens.map((token, idx) => {
                const { usageCount, reviewCount, mastered, norm } =
                  getLiveStatsForToken(token);
                const rowKey = `${token.arabicWord}-row-${idx}`;
                const isRootOpen = Boolean(expandedRoots[rowKey]);

                return (
                  <div
                    key={rowKey}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => handleSpeakWord(token.arabicWord)}
                        aria-label={`Pronounce ${token.arabicWord}`}
                        className="min-h-[42px] min-w-[42px] p-2 rounded-xl bg-[#F3EDE0] hover:bg-[#E6DEC8] text-[#2C2A29] transition-colors flex items-center justify-center shrink-0 mt-0.5"
                      >
                        <Volume2 className="w-4 h-4 text-[#2D5A3C]" />
                      </button>

                      <div>
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <span
                            dir="rtl"
                            className="font-arabic text-2xl sm:text-3xl font-bold text-[#2C2A29]"
                          >
                            {token.arabicWord}
                          </span>
                          <span className="text-xs italic text-[#7A7267]">
                            ({token.transliteration})
                          </span>
                          <span aria-hidden="true" className="text-[#B8AFA0]">
                            ·
                          </span>
                          <span className="text-sm font-semibold text-[#2C2A29]">
                            {token.englishMeaning}
                          </span>
                          <span aria-hidden="true" className="text-[#B8AFA0]">
                            ·
                          </span>
                          <span className="text-xs text-[#7A7267]">
                            {token.partOfSpeech}
                          </span>
                        </div>

                        <p
                          dir="rtl"
                          className="font-arabic text-lg text-[#5C554D] mt-0.5 text-right sm:text-left"
                        >
                          {token.contextSentenceArabic}
                        </p>
                      </div>
                    </div>

                    {/* Right Side: 20/20 Progress + Subtle [See Root] Toggle */}
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end shrink-0">
                      <div className="text-xs font-mono-tabular text-[#5C554D]">
                        <span>Used: {usageCount}/20</span>
                        <span aria-hidden="true"> · </span>
                        <span>Reviewed: {reviewCount}/20</span>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={
                            mastered
                              ? 'text-[#2D5A3C] font-semibold'
                              : 'text-[#C87D28]'
                          }
                        >
                          {mastered ? 'Mastered (20/20)' : 'Learning'}
                        </span>
                      </div>

                      {/* Subtle [See Root] Button */}
                      <button
                        type="button"
                        onClick={() => toggleRootReveal(rowKey)}
                        className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#5C554D] bg-[#F3EDE0] hover:bg-[#E6DEC8] rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        {isRootOpen ? `Root: ${token.root}` : 'See Root'}
                      </button>

                      {/* Interactive Demo Helper: Test 20/20 Hidden-English Mastery */}
                      {!mastered && onFastForwardMastery && (
                        <button
                          type="button"
                          onClick={() => onFastForwardMastery(norm)}
                          title="Fast-forward this word to 20/20 Mastery to see its English translation hide above"
                          className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#2D5A3C] bg-[#2D5A3C]/10 hover:bg-[#2D5A3C]/20 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Test 20/20</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default NotebookJournalView;
