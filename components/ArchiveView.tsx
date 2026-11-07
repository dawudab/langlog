import React, { useState, useMemo } from 'react';
import {
  Search,
  Volume2,
  BookOpen,
  Trash2,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { JournalEntryRecord, SM2Flashcard } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface ArchiveViewProps {
  entries: JournalEntryRecord[];
  cards: SM2Flashcard[];
  isOnline: boolean;
  isSyncingPending: boolean;
  onSyncPendingNow: () => void;
  onSelectEntry: (entry: JournalEntryRecord) => void;
  onDeleteEntry: (entryId: string) => void;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

const ArchiveView: React.FC<ArchiveViewProps> = ({
  entries,
  cards,
  isOnline,
  isSyncingPending,
  onSyncPendingNow,
  onSelectEntry,
  onDeleteEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'synced' | 'pending'
  >('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const { speak } = useSpeechSynthesis();

  // Build 14-day interactive timeline strip
  const recentDays = useMemo(() => {
    const days: Array<{
      dateKey: string;
      dayName: string;
      dayNumber: string;
      hasEntries: boolean;
    }> = [];
    const entryDateKeys = new Set(
      entries.map((e) => e.createdAt.slice(0, 10))
    );

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayName = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
      }).format(d);
      const dayNumber = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
      }).format(d);
      days.push({
        dateKey,
        dayName,
        dayNumber,
        hasEntries: entryDateKeys.has(dateKey),
      });
    }
    return days;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return entries
      .filter((entry) => {
        if (statusFilter !== 'all' && entry.syncStatus !== statusFilter) {
          return false;
        }
        if (
          selectedDateKey &&
          entry.createdAt.slice(0, 10) !== selectedDateKey
        ) {
          return false;
        }
        if (!q) return true;
        const inOriginal = entry.originalText.toLowerCase().includes(q);
        const inTrans = (entry.translatedText || '').toLowerCase().includes(q);
        const inRoots = (entry.vocabulary || []).some(
          (v) =>
            v.word_conjugated.toLowerCase().includes(q) ||
            v.root.toLowerCase().includes(q) ||
            v.meaning.toLowerCase().includes(q)
        );
        return inOriginal || inTrans || inRoots;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries, searchQuery, statusFilter, selectedDateKey]);

  const pendingCount = entries.filter((e) => e.syncStatus === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-12">
      {/* Header & Sync Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-stone-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Journal Timeline &amp; Offline Sync Archive
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {entries.length} entries · {cards.length} extracted roots ·{' '}
            {pendingCount} pending offline sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedDateKey && (
            <button
              type="button"
              onClick={() => setSelectedDateKey(null)}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-stone-200/70 dark:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Showing {selectedDateKey} · Reset</span>
            </button>
          )}

          {pendingCount > 0 && isOnline && (
            <button
              type="button"
              onClick={onSyncPendingNow}
              disabled={isSyncingPending}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isSyncingPending ? 'animate-spin' : ''
                }`}
              />
              <span>Sync {pendingCount} Pending</span>
            </button>
          )}
        </div>
      </div>

      {/* 14-Day Horizontal Date Strip */}
      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setSelectedDateKey(null)}
            className={`min-h-[54px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors shrink-0 ${
              selectedDateKey === null
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white dark:bg-[#121824] text-slate-600 dark:text-slate-400 border-stone-200 dark:border-slate-800 hover:border-slate-400'
            }`}
          >
            All Dates
          </button>
          {recentDays.map((day) => {
            const isSelected = selectedDateKey === day.dateKey;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() =>
                  setSelectedDateKey((prev) =>
                    prev === day.dateKey ? null : day.dateKey
                  )
                }
                className={`min-w-[56px] min-h-[54px] px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600'
                    : day.hasEntries
                    ? 'bg-white dark:bg-[#121824] text-slate-900 dark:text-white border-sky-500/40 dark:border-sky-500/40'
                    : 'bg-white/60 dark:bg-[#121824]/60 text-slate-400 dark:text-slate-500 border-stone-200/70 dark:border-slate-800/70'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider">
                  {day.dayName}
                </span>
                <span className="text-sm font-bold font-mono-tabular mt-0.5">
                  {day.dayNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Arabic/English entries, triliteral roots (ش ر ي), or meanings..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#121824] border border-stone-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-slate-800 rounded-xl self-start">
          {(['all', 'synced', 'pending'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === status
                  ? 'bg-white dark:bg-[#141B29] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No journal entries match your current filter.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSrcRtl = entry.sourceLanguage === 'ar';
            const isTgtRtl = entry.targetLanguage === 'ar';
            const formattedDate = new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(entry.createdAt));

            return (
              <article
                key={entry.id}
                className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6 transition-colors"
              >
                {/* Clean Unboxed Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-stone-100 dark:border-slate-800/70">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                    <span>{formattedDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {entry.sourceLanguage.toUpperCase()} →{' '}
                      {entry.targetLanguage.toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        entry.syncStatus === 'pending'
                          ? 'text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      sync_status: {entry.syncStatus}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.vocabulary.length} roots</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry)}
                      className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open in Editor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label="Delete entry"
                      className="min-h-[38px] min-w-[38px] p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dual-Language Prose Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block mb-1.5">
                      Original (
                      {entry.sourceLanguage === 'ar' ? 'العربية' : 'English'})
                    </span>
                    <p
                      dir={isSrcRtl ? 'rtl' : 'ltr'}
                      className={`text-slate-800 dark:text-slate-200 ${
                        isSrcRtl
                          ? 'font-arabic text-xl leading-[1.85] text-right'
                          : 'text-base leading-relaxed text-left'
                      }`}
                    >
                      {entry.originalText}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Translation (
                        {entry.targetLanguage === 'ar' ? 'العربية' : 'English'})
                      </span>
                      {entry.translatedText && (
                        <button
                          type="button"
                          onClick={() =>
                            speak(
                              entry.translatedText,
                              isTgtRtl ? 'ar-SA' : 'en-US'
                            )
                          }
                          aria-label="Play translation audio"
                          className="p-1 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {entry.translatedText ? (
                      <p
                        dir={isTgtRtl ? 'rtl' : 'ltr'}
                        className={`text-slate-900 dark:text-slate-100 ${
                          isTgtRtl
                            ? 'font-arabic text-xl leading-[1.85] text-right'
                            : 'text-base leading-relaxed text-left'
                        }`}
                      >
                        {entry.translatedText}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Awaiting online connectivity to translate &amp; extract
                        roots.
                      </p>
                    )}
                  </div>
                </div>

                {/* Inline Extracted Roots Summary */}
                {entry.vocabulary.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-400 dark:text-slate-500">
                      Extracted Roots:
                    </span>
                    {entry.vocabulary.map((v, i) => {
                      const isAr = ARABIC_CHAR_REGEX.test(v.word_conjugated);
                      return (
                        <span key={`${v.word_conjugated}-${i}`}>
                          <strong
                            className={`${
                              isAr ? 'font-arabic' : ''
                            } font-semibold text-slate-900 dark:text-slate-200`}
                          >
                            {v.word_conjugated}
                          </strong>{' '}
                          <span className="font-mono-tabular text-sky-700 dark:text-sky-400">
                            ({v.root})
                          </span>{' '}
                          — {v.meaning}
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ArchiveView;
