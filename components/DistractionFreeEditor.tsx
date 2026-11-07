import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Copy,
  Check,
  ArrowRightLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Layers,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  BookMarked,
  X,
} from 'lucide-react';
import {
  ExtractedVocab,
  JournalEntryRecord,
  LanguageCode,
} from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface DistractionFreeEditorProps {
  isOnline: boolean;
  onToggleOfflineSim: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  pendingCount: number;
  isSyncingPending: boolean;
  onSyncPendingNow: () => void;
  onSubmitEntry: (
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ) => Promise<JournalEntryRecord>;
  activeEntry: JournalEntryRecord | null;
  onNavigateToStudy: () => void;
  onNavigateToRoots: () => void;
  dueCardsCount: number;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

const SAMPLE_PROMPTS: Array<{
  label: string;
  sourceLang: LanguageCode;
  text: string;
}> = [
  {
    label: 'Morning Market (EN → AR)',
    sourceLang: 'en',
    text: 'This morning I woke up early, drank a cup of black coffee at the neighborhood cafe, and bought a new book in the market to practice my Arabic writing.',
  },
  {
    label: 'Calligraphy Reflection (AR → EN)',
    sourceLang: 'ar',
    text: 'كتبتُ اليوم في دفتر يومياتي باللغة العربية وشربتُ القهوة في الصباح الباكر قبل أن أذهب إلى المكتبة لقراءة كتاب تاريخي.',
  },
];

const DistractionFreeEditor: React.FC<DistractionFreeEditorProps> = ({
  isOnline,
  onToggleOfflineSim,
  isDarkMode,
  onToggleDarkMode,
  pendingCount,
  isSyncingPending,
  onSyncPendingNow,
  onSubmitEntry,
  activeEntry,
  onNavigateToStudy,
  onNavigateToRoots,
  dueCardsCount,
}) => {
  const [text, setText] = useState<string>('');
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [showExtractionSheet, setShowExtractionSheet] =
    useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedTranslation, setCopiedTranslation] = useState<boolean>(false);
  const typingTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { speak, isSpeaking, stop } = useSpeechSynthesis();

  const targetLang: LanguageCode = sourceLang === 'en' ? 'ar' : 'en';
  const isSourceRtl = sourceLang === 'ar';

  useEffect(() => {
    if (activeEntry) {
      setText(activeEntry.originalText);
      setSourceLang(activeEntry.sourceLanguage);
    }
  }, [activeEntry?.id]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Auto-detect script direction from first non-whitespace character
    const trimmed = val.trimStart();
    if (trimmed.length > 0) {
      const firstCharIsArabic = ARABIC_CHAR_REGEX.test(trimmed[0]);
      const detected: LanguageCode = firstCharIsArabic ? 'ar' : 'en';
      if (detected !== sourceLang) {
        setSourceLang(detected);
      }
    }

    if (!isTyping && val.trim().length > 0) {
      setIsTyping(true);
    }

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 1600);
  };

  const handleToggleLanguagePair = () => {
    setSourceLang((prev) => (prev === 'en' ? 'ar' : 'en'));
    textareaRef.current?.focus();
  };

  const handleSaveAndProcess = async () => {
    if (!text.trim() || isProcessing) return;
    setIsTyping(false);
    setIsProcessing(true);
    try {
      const saved = await onSubmitEntry(text.trim(), sourceLang, targetLang);
      if (saved && (isFocusMode || window.innerWidth < 1024)) {
        setShowExtractionSheet(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyTranslation = (translated: string) => {
    navigator.clipboard.writeText(translated).then(() => {
      setCopiedTranslation(true);
      window.setTimeout(() => setCopiedTranslation(false), 2000);
    });
  };

  const wordCount =
    text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const displayedEntry = activeEntry;
  const extractedVocab: ExtractedVocab[] = displayedEntry?.vocabulary || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16">
      {/* Workspace Toolbar (Dims subtly while actively typing for distraction-free focus) */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-stone-200/80 dark:border-slate-800/80 transition-opacity duration-200 ${
          isTyping ? 'opacity-25 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-200">
            {formattedDate}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {sourceLang === 'en'
              ? 'Native English → Target Arabic'
              : 'Native Arabic → Target English'}
          </span>
          {pendingCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 dark:text-amber-400 font-medium font-mono-tabular">
                {pendingCount} pending sync
              </span>
            </>
          )}
        </div>

        {/* Interactive Workspace Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Pair Toggle */}
          <button
            type="button"
            onClick={handleToggleLanguagePair}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-stone-300/70 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>
              {sourceLang === 'en' ? 'EN → العربية' : 'العربية → EN'}
            </span>
          </button>

          {/* Distraction-Free Focus Canvas Toggle */}
          <button
            type="button"
            onClick={() => setIsFocusMode((prev) => !prev)}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isFocusMode
                ? 'bg-sky-600 text-white'
                : 'bg-stone-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-stone-300/70 dark:hover:bg-slate-700'
            }`}
          >
            {isFocusMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Focus Canvas</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus Mode</span>
              </>
            )}
          </button>

          {/* Offline-First Connectivity Toggle */}
          <button
            type="button"
            onClick={onToggleOfflineSim}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isOnline
                ? 'bg-stone-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-stone-300/70 dark:hover:bg-slate-700'
                : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
            }`}
            title="Toggle offline mode to test local sync_status: pending queue"
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Online (Auto-Sync)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Offline Mode (Local Queue)</span>
              </>
            )}
          </button>

          {pendingCount > 0 && isOnline && (
            <button
              type="button"
              onClick={onSyncPendingNow}
              disabled={isSyncingPending}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isSyncingPending ? 'animate-spin' : ''
                }`}
              />
              <span>Sync {pendingCount} Pending</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle color theme"
            className="min-h-[40px] min-w-[40px] p-2 rounded-lg bg-stone-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-stone-300/70 dark:hover:bg-slate-700 transition-colors flex items-center justify-center shrink-0"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Responsive Split: In Focus Mode, Writing Surface Expands to Centered Editorial Width */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Distraction-Free Writing Surface */}
        <section
          className={`${
            isFocusMode
              ? 'lg:col-span-10 lg:col-start-2'
              : 'lg:col-span-7'
          } flex flex-col justify-between bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6 sm:p-8 min-h-[500px] transition-all`}
        >
          <div>
            {/* Quick Starter Prompts (Fade while typing) */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 mb-4 transition-opacity duration-200 ${
                isTyping ? 'opacity-15 hover:opacity-100' : 'opacity-100'
              }`}
            >
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Write in your native script or load a sample entry:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setSourceLang(sample.sourceLang);
                      setText(sample.text);
                      textareaRef.current?.focus();
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-stone-100 dark:bg-slate-800/80 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dual-Script Distraction-Free Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              dir={isSourceRtl ? 'rtl' : 'ltr'}
              lang={sourceLang}
              rows={isFocusMode ? 13 : 10}
              placeholder={
                isSourceRtl
                  ? 'اكتب يومياتك بحرية باللغة العربية... سيتم استخراج المفردات والجذور تلقائياً.'
                  : 'Write freely about your day... Gemini will translate your thoughts into Arabic and extract conjugated vocabulary + triliteral roots for your SRS deck.'
              }
              className={`w-full resize-none border-0 bg-transparent focus:outline-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-600 ${
                isSourceRtl
                  ? 'font-arabic text-2xl leading-[1.9] text-right'
                  : 'text-xl leading-[1.7] text-left'
              }`}
            />
          </div>

          {/* Floating Glassmorphic Bottom Action Bar */}
          <div className="mt-6 pt-4 px-4 py-3 rounded-xl bg-[#FAF8F5]/90 dark:bg-[#0B0F17]/90 backdrop-blur-md border border-stone-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              <span>
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{isSourceRtl ? 'RTL (العربية)' : 'LTR (English)'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {isOnline ? 'sync_status: live' : 'sync_status: pending'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {displayedEntry && (
                <button
                  type="button"
                  onClick={() => setShowExtractionSheet(true)}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-stone-200/80 dark:bg-slate-800 hover:bg-stone-300/70 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <BookMarked className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>
                    Extraction Sheet ({extractedVocab.length})
                  </span>
                </button>
              )}

              {text.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveAndProcess}
                disabled={!text.trim() || isProcessing}
                className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isProcessing
                  ? 'Extracting Roots...'
                  : isOnline
                  ? 'Translate & Extract Roots'
                  : 'Save Offline (Pending Sync)'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column (5 cols): Translation & Triliteral Root Extraction Output (Hidden when Focus Mode is active) */}
        {!isFocusMode && (
          <section className="lg:col-span-5 space-y-6">
            {!displayedEntry ? (
              <div className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-8 text-center">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  AI Root &amp; Vocabulary Parser
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Write a journal entry and press{' '}
                  <strong className="font-semibold text-slate-900 dark:text-slate-200">
                    Translate &amp; Extract Roots
                  </strong>
                  . Your entry will be translated and parsed into conjugated
                  forms and Arabic triliteral roots (الجذور الثلاثية) for
                  spaced repetition.
                </p>
              </div>
            ) : (
              <>
                {/* Target Language Translation Surface */}
                <div className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-slate-200">
                        {displayedEntry.targetLanguage === 'ar'
                          ? 'Arabic Translation (العربية)'
                          : 'English Translation'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        sync_status: {displayedEntry.syncStatus}
                      </span>
                    </div>

                    {displayedEntry.translatedText && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeaking) {
                              stop();
                            } else {
                              speak(
                                displayedEntry.translatedText,
                                displayedEntry.targetLanguage === 'ar'
                                  ? 'ar-SA'
                                  : 'en-US'
                              );
                            }
                          }}
                          className="min-h-[38px] min-w-[38px] p-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                          aria-label="Listen to translation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyTranslation(displayedEntry.translatedText)
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          {copiedTranslation ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {displayedEntry.syncStatus === 'pending' &&
                  !displayedEntry.translatedText ? (
                    <div className="py-6 text-sm text-amber-800 dark:text-amber-300">
                      Saved locally with{' '}
                      <code className="font-mono-tabular">
                        sync_status: pending
                      </code>
                      . Switch back to Online Mode or click Sync to run Gemini
                      translation and triliteral root extraction.
                    </div>
                  ) : (
                    <p
                      dir={
                        displayedEntry.targetLanguage === 'ar' ? 'rtl' : 'ltr'
                      }
                      lang={displayedEntry.targetLanguage}
                      className={`text-slate-900 dark:text-slate-100 whitespace-pre-wrap ${
                        displayedEntry.targetLanguage === 'ar'
                          ? 'font-arabic text-2xl leading-[1.95] text-right'
                          : 'text-lg leading-relaxed text-left'
                      }`}
                    >
                      {displayedEntry.translatedText}
                    </p>
                  )}
                </div>

                {/* Extracted Vocabulary & Triliteral Roots */}
                <div className="bg-white dark:bg-[#121824] rounded-2xl border border-stone-200/90 dark:border-slate-800/90 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Extracted Vocabulary &amp; Roots
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
                        {extractedVocab.length} items extracted · is_new
                        prioritized in SRS
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onNavigateToRoots}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Root Lexicon
                      </button>
                      <button
                        type="button"
                        onClick={onNavigateToStudy}
                        className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Study ({dueCardsCount})</span>
                      </button>
                    </div>
                  </div>

                  {extractedVocab.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                      Vocabulary roots will appear here once the entry is synced
                      with Gemini.
                    </p>
                  ) : (
                    <div className="divide-y divide-stone-200/70 dark:divide-slate-800/80">
                      {extractedVocab.map((item, idx) => {
                        const isCardTargetArabic =
                          displayedEntry.targetLanguage === 'ar' ||
                          ARABIC_CHAR_REGEX.test(item.word_conjugated);
                        return (
                          <div
                            key={`${item.word_conjugated}-${idx}`}
                            className="py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span
                                  dir={isCardTargetArabic ? 'rtl' : 'ltr'}
                                  className={`font-bold text-slate-900 dark:text-slate-100 ${
                                    isCardTargetArabic
                                      ? 'font-arabic text-xl'
                                      : 'text-base'
                                  }`}
                                >
                                  {item.word_conjugated}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="text-slate-400"
                                >
                                  ·
                                </span>
                                <span className="text-xs font-mono-tabular text-sky-700 dark:text-sky-400 font-medium">
                                  Root: {item.root}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="text-slate-400"
                                >
                                  ·
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.is_new ? 'is_new: true' : 'reviewing'}
                                </span>
                              </div>

                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {item.meaning}
                              </p>

                              {item.context && (
                                <p
                                  dir={isCardTargetArabic ? 'rtl' : 'ltr'}
                                  className={`text-xs text-slate-500 dark:text-slate-400 ${
                                    isCardTargetArabic
                                      ? 'font-arabic text-sm'
                                      : ''
                                  }`}
                                >
                                  “{item.context}”
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                speak(
                                  item.word_conjugated,
                                  isCardTargetArabic ? 'ar-SA' : 'en-US'
                                )
                              }
                              aria-label={`Pronounce ${item.word_conjugated}`}
                              className="min-h-[40px] min-w-[40px] p-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center shrink-0"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* Extraction Bottom Sheet (Glassmorphic Modal Drawer for Focus Mode & Mobile Inspection) */}
      {showExtractionSheet && displayedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Extracted Vocabulary and Translation Sheet"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#FAF8F5] dark:bg-[#121824] rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Translation &amp; Triliteral Root Extraction
                </h2>
                <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                  sync_status: {displayedEntry.syncStatus} ·{' '}
                  {extractedVocab.length} vocabulary roots extracted
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExtractionSheet(false)}
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-stone-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-stone-300 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                aria-label="Close extraction sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {displayedEntry.translatedText && (
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-stone-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {displayedEntry.targetLanguage === 'ar'
                      ? 'Arabic Translation (العربية)'
                      : 'English Translation'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      speak(
                        displayedEntry.translatedText,
                        displayedEntry.targetLanguage === 'ar'
                          ? 'ar-SA'
                          : 'en-US'
                      )
                    }
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                    aria-label="Play translation audio"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p
                  dir={displayedEntry.targetLanguage === 'ar' ? 'rtl' : 'ltr'}
                  className={`text-slate-900 dark:text-slate-100 ${
                    displayedEntry.targetLanguage === 'ar'
                      ? 'font-arabic text-2xl leading-[1.9] text-right'
                      : 'text-lg leading-relaxed text-left'
                  }`}
                >
                  {displayedEntry.translatedText}
                </p>
              </div>
            )}

            <div className="divide-y divide-stone-200/70 dark:divide-slate-800">
              {extractedVocab.map((item, idx) => {
                const isAr =
                  displayedEntry.targetLanguage === 'ar' ||
                  ARABIC_CHAR_REGEX.test(item.word_conjugated);
                return (
                  <div
                    key={`${item.word_conjugated}-${idx}`}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          dir={isAr ? 'rtl' : 'ltr'}
                          className={`font-bold text-slate-900 dark:text-white ${
                            isAr ? 'font-arabic text-xl' : 'text-base'
                          }`}
                        >
                          {item.word_conjugated}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="text-xs font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                          Root: {item.root}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {item.meaning}
                        </span>
                      </div>
                      {item.context && (
                        <p
                          dir={isAr ? 'rtl' : 'ltr'}
                          className={`text-xs text-slate-500 dark:text-slate-400 mt-0.5 ${
                            isAr ? 'font-arabic text-sm' : ''
                          }`}
                        >
                          “{item.context}”
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speak(item.word_conjugated, isAr ? 'ar-SA' : 'en-US')
                      }
                      className="min-h-[38px] min-w-[38px] p-2 rounded-lg bg-stone-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExtractionSheet(false);
                  onNavigateToRoots();
                }}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-stone-200/80 dark:bg-slate-800 rounded-xl"
              >
                Open Root Lexicon
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExtractionSheet(false);
                  onNavigateToStudy();
                }}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl"
              >
                Study SRS Queue ({dueCardsCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistractionFreeEditor;
