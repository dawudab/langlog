import React, { useState, useMemo } from 'react';
import {
  Search,
  Volume2,
  Plus,
  Sparkles,
  Layers,
  Trash2,
  X,
} from 'lucide-react';
import { LanguageCode, SM2Flashcard } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface RootLexiconViewProps {
  cards: SM2Flashcard[];
  onAddCustomCard: (cardInput: {
    wordConjugated: string;
    root: string;
    meaning: string;
    context: string;
    targetLanguage: LanguageCode;
  }) => Promise<void>;
  onPrioritizeCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onNavigateToStudy: () => void;
  dueCardsCount: number;
}

interface RootFamilyGroup {
  root: string;
  targetLanguage: LanguageCode;
  derivatives: SM2Flashcard[];
  newCount: number;
  averageEase: number;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

const RootLexiconView: React.FC<RootLexiconViewProps> = ({
  cards,
  onAddCustomCard,
  onPrioritizeCard,
  onDeleteCard,
  onNavigateToStudy,
  dueCardsCount,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [langFilter, setLangFilter] = useState<'all' | 'ar' | 'en'>('all');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Custom root/vocabulary form state
  const [wordConjugated, setWordConjugated] = useState<string>('');
  const [rootInput, setRootInput] = useState<string>('');
  const [meaningInput, setMeaningInput] = useState<string>('');
  const [contextInput, setContextInput] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ar');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { speak } = useSpeechSynthesis();

  // Group vocabulary flashcards by Arabic triliteral root or English base lemma
  const rootFamilies = useMemo<RootFamilyGroup[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = cards.filter((card) => {
      if (langFilter !== 'all' && card.targetLanguage !== langFilter) {
        return false;
      }
      if (!q) return true;
      return (
        card.root.toLowerCase().includes(q) ||
        card.wordConjugated.toLowerCase().includes(q) ||
        card.meaning.toLowerCase().includes(q) ||
        card.context.toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, SM2Flashcard[]>();
    filtered.forEach((card) => {
      const normalizedRoot = card.root.trim() || card.wordConjugated.trim();
      const existing = groups.get(normalizedRoot) || [];
      existing.push(card);
      groups.set(normalizedRoot, existing);
    });

    return Array.from(groups.entries())
      .map(([root, derivatives]) => {
        const newCount = derivatives.filter((d) => d.isNew).length;
        const averageEase =
          derivatives.reduce((acc, d) => acc + d.easeFactor, 0) /
          Math.max(1, derivatives.length);
        const firstLang = derivatives[0]?.targetLanguage || 'ar';
        return {
          root,
          targetLanguage: firstLang,
          derivatives,
          newCount,
          averageEase,
        };
      })
      .sort((a, b) => {
        if (a.newCount !== b.newCount) return b.newCount - a.newCount;
        return b.derivatives.length - a.derivatives.length;
      });
  }, [cards, searchQuery, langFilter]);

  const handleCreateCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordConjugated.trim() || !meaningInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddCustomCard({
        wordConjugated: wordConjugated.trim(),
        root: rootInput.trim() || wordConjugated.trim(),
        meaning: meaningInput.trim(),
        context: contextInput.trim(),
        targetLanguage,
      });
      setWordConjugated('');
      setRootInput('');
      setMeaningInput('');
      setContextInput('');
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalNewWords = useMemo(
    () => cards.filter((c) => c.isNew).length,
    [cards]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-12">
      {/* Header & Primary Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-stone-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Triliteral Root &amp; Vocabulary Lexicon
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {rootFamilies.length} root families · {cards.length} conjugated
            forms · {totalNewWords} prioritized (is_new: true)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-stone-200/80 dark:bg-slate-800 hover:bg-stone-300/70 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {showAddForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Root</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNavigateToStudy}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Study SRS Queue ({dueCardsCount})</span>
          </button>
        </div>
      </div>

      {/* Collapsible Custom Root & Word Entry Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleCreateCustomCard}
          className="mb-8 bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Add Custom Vocabulary &amp; Root to SRS Deck
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                New entries are automatically marked with is_new: true for
                priority spaced repetition.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-slate-800 rounded-xl">
              {(['ar', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setTargetLanguage(lang)}
                  className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    targetLanguage === lang
                      ? 'bg-white dark:bg-[#141B29] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'ar' ? 'Target: العربية' : 'Target: English'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Conjugated Word ({targetLanguage === 'ar' ? 'العربية' : 'EN'})
              </label>
              <input
                type="text"
                required
                dir={targetLanguage === 'ar' ? 'rtl' : 'ltr'}
                value={wordConjugated}
                onChange={(e) => {
                  const val = e.target.value;
                  setWordConjugated(val);
                  if (ARABIC_CHAR_REGEX.test(val)) {
                    setTargetLanguage('ar');
                  }
                }}
                placeholder={
                  targetLanguage === 'ar' ? 'e.g. اشتريتُ' : 'e.g. reflection'
                }
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#0B0F17] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 ${
                  targetLanguage === 'ar' ? 'font-arabic text-lg' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Triliteral Root / Base Form
              </label>
              <input
                type="text"
                dir={targetLanguage === 'ar' ? 'rtl' : 'ltr'}
                value={rootInput}
                onChange={(e) => setRootInput(e.target.value)}
                placeholder={
                  targetLanguage === 'ar' ? 'e.g. ش ر ي' : 'e.g. reflect'
                }
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#0B0F17] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 ${
                  targetLanguage === 'ar' ? 'font-arabic text-lg' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Native Meaning
              </label>
              <input
                type="text"
                required
                value={meaningInput}
                onChange={(e) => setMeaningInput(e.target.value)}
                placeholder="e.g. I bought / purchased"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#0B0F17] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Context Phrase (Optional)
              </label>
              <input
                type="text"
                dir={targetLanguage === 'ar' ? 'rtl' : 'ltr'}
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder={
                  targetLanguage === 'ar'
                    ? 'اشتريتُ كتاباً جديداً في السوق'
                    : 'Short phrase from your journal'
                }
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#0B0F17] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 ${
                  targetLanguage === 'ar' ? 'font-arabic text-base' : ''
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                !wordConjugated.trim() || !meaningInput.trim() || isSubmitting
              }
              className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors disabled:opacity-50"
            >
              Save to Root Lexicon &amp; SRS Queue
            </button>
          </div>
        </form>
      )}

      {/* Search & Language Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by triliteral root (ش ر ي), conjugated word, or meaning..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#121824] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-slate-800 rounded-xl self-start">
          {(
            [
              { id: 'all', label: 'All Roots' },
              { id: 'ar', label: 'Arabic Roots (العربية)' },
              { id: 'en', label: 'English Lemmas' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLangFilter(tab.id)}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                langFilter === tab.id
                  ? 'bg-white dark:bg-[#141B29] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Root Family Grid */}
      {rootFamilies.length === 0 ? (
        <div className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No triliteral roots or vocabulary match your current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rootFamilies.map((family) => {
            const isArabicRoot =
              family.targetLanguage === 'ar' ||
              ARABIC_CHAR_REGEX.test(family.root);

            return (
              <section
                key={family.root}
                className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Root Header */}
                  <div className="flex items-baseline justify-between gap-4 pb-4 mb-4 border-b border-stone-100 dark:border-slate-800/80">
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                        Root
                      </span>
                      <h2
                        dir={isArabicRoot ? 'rtl' : 'ltr'}
                        className={`font-bold text-sky-700 dark:text-sky-400 ${
                          isArabicRoot
                            ? 'font-arabic text-2xl tracking-wide'
                            : 'text-xl font-mono-tabular'
                        }`}
                      >
                        {family.root}
                      </h2>
                    </div>

                    <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                      <span>
                        {family.derivatives.length}{' '}
                        {family.derivatives.length === 1 ? 'form' : 'forms'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>EF {family.averageEase.toFixed(2)}</span>
                      {family.newCount > 0 && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-sky-600 dark:text-sky-400 font-semibold">
                            {family.newCount} new
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Derivatives List */}
                  <div className="divide-y divide-stone-100 dark:divide-slate-800/60">
                    {family.derivatives.map((card) => {
                      const isCardArabic =
                        card.targetLanguage === 'ar' ||
                        ARABIC_CHAR_REGEX.test(card.wordConjugated);

                      return (
                        <div
                          key={card.id}
                          className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span
                                dir={isCardArabic ? 'rtl' : 'ltr'}
                                className={`font-bold text-slate-900 dark:text-slate-100 ${
                                  isCardArabic
                                    ? 'font-arabic text-xl'
                                    : 'text-base'
                                }`}
                              >
                                {card.wordConjugated}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-slate-400"
                              >
                                ·
                              </span>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {card.meaning}
                              </span>
                            </div>

                            {card.context && (
                              <p
                                dir={isCardArabic ? 'rtl' : 'ltr'}
                                className={`text-xs text-slate-500 dark:text-slate-400 ${
                                  isCardArabic ? 'font-arabic text-sm' : ''
                                }`}
                              >
                                “{card.context}”
                              </p>
                            )}

                            <p className="text-[11px] font-mono-tabular text-slate-400 dark:text-slate-500">
                              {card.isNew
                                ? 'is_new: true (Priority Queue)'
                                : `Interval: ${card.interval}d · Reps: ${card.repetitions} · EF: ${card.easeFactor.toFixed(2)}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!card.isNew && (
                              <button
                                type="button"
                                onClick={() => onPrioritizeCard(card.id)}
                                title="Prioritize in daily study queue (is_new: true)"
                                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Prioritize</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                speak(
                                  card.wordConjugated,
                                  isCardArabic ? 'ar-SA' : 'en-US'
                                )
                              }
                              aria-label={`Pronounce ${card.wordConjugated}`}
                              className="min-h-[36px] min-w-[36px] p-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCard(card.id)}
                              aria-label={`Remove ${card.wordConjugated}`}
                              className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RootLexiconView;
