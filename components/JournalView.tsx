import React, { useState, useEffect } from 'react';
import { Edit3, Save, Archive, Send, ChevronDown } from 'lucide-react';
import { ProcessedEntryData, VocabularyItem, AppView, JournalEntryData, NotificationMessage, Language } from '../types';
import { DEFAULT_ORIGINAL_LANGUAGE, SUPPORTED_LANGUAGES } from '../constants';
import * as geminiService from '../services/geminiService';
import OutputDisplay from './OutputDisplay';
import LoadingSpinner from './LoadingSpinner';

interface JournalViewProps {
  setNotification: (notification: NotificationMessage | null) => void;
  setCurrentView: (view: AppView) => void;
  savedEntriesCount: number;
  onSaveFullEntry: (entryData: Omit<JournalEntryData, 'id' | 'createdAt'>) => void;
  onSaveWord: (word: VocabularyItem) => void;
  savedWords: VocabularyItem[];
  entryToLoad: JournalEntryData | null;
  onEntryLoaded: () => void;
}

const JournalView: React.FC<JournalViewProps> = ({
  setNotification,
  setCurrentView,
  savedEntriesCount,
  onSaveFullEntry,
  onSaveWord,
  savedWords,
  entryToLoad,
  onEntryLoaded,
}) => {
  const [journalEntry, setJournalEntry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedEntryData | null>(null);
  const [inputLanguage, setInputLanguage] = useState<Language>(DEFAULT_ORIGINAL_LANGUAGE);
  const [outputLanguage, setOutputLanguage] = useState<Language>(
    SUPPORTED_LANGUAGES.find(lang => lang.code === 'ar') || SUPPORTED_LANGUAGES[1]
  );

  useEffect(() => {
    if (entryToLoad) {
      setJournalEntry(entryToLoad.originalEntry);
      setProcessedData({
          translation: entryToLoad.translatedText,
          vocabulary: entryToLoad.vocabularyList,
          exampleSentences: entryToLoad.exampleSentences,
          flashcards: entryToLoad.flashcardWords,
      });
      setNotification({type: 'success', message: 'Entry loaded from saved entries.'});
      onEntryLoaded(); // Signal back to App that the entry has been processed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryToLoad, onEntryLoaded, setNotification]);

  const handleCorrectGrammar = async () => {
    if (!journalEntry.trim()) {
      setNotification({ type: 'error', message: 'Please write something to correct.' });
      return;
    }
    setIsSubmitting(true);
    setNotification(null);
    try {
      const correctedText = await geminiService.correctGrammar(journalEntry);
      setJournalEntry(correctedText);
      setNotification({ type: 'success', message: 'Spelling and grammar corrected!' });
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message || 'Failed to correct grammar.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessEntry = async () => {
    if (!journalEntry.trim()) return;
    
    setIsLoading(true);
    setNotification(null);
    
    try {
      const result = await geminiService.processJournalEntry(
        journalEntry, 
        inputLanguage.name, 
        outputLanguage.name
      );
      setProcessedData(result);
      setNotification({ type: 'success', message: 'Entry processed successfully!' });
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message || 'Failed to process entry.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveJournalEntry = () => {
    if (!processedData || !journalEntry) {
      setNotification({ type: 'error', message: 'No processed data to save. Process an entry first.' });
      return;
    }

    onSaveFullEntry({
      originalEntry: journalEntry,
      targetLanguageCode: outputLanguage.code,
      targetLanguageName: outputLanguage.name,
      originalLanguageCode: inputLanguage.code,
      originalLanguageName: inputLanguage.name,
      translatedText: processedData.translation,
      vocabularyList: processedData.vocabulary,
      exampleSentences: processedData.exampleSentences,
      flashcardWords: processedData.flashcards,
    });
    setNotification({ type: 'success', message: 'Journal entry saved!' });
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => setNotification({ type: 'success', message: `${type} copied to clipboard!` }))
      .catch(() => setNotification({ type: 'error', message: `Failed to copy ${type}.` }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 max-w-7xl mx-auto">
      <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl space-y-6">
        <h2 className="text-2xl font-semibold text-sky-400 border-b border-slate-700 pb-3 mb-4">Your Journal</h2>
        
        {/* Language Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-language" className="block text-sm font-medium text-slate-300 mb-1">
              Input Language
            </label>
            <div className="relative">
              <select
                id="input-language"
                value={inputLanguage.code}
                onChange={(e) => {
                  const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value) || inputLanguage;
                  setInputLanguage(lang);
                }}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={`in-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          
          <div>
            <label htmlFor="output-language" className="block text-sm font-medium text-slate-300 mb-1">
              Output Language
            </label>
            <div className="relative">
              <select
                id="output-language"
                value={outputLanguage.code}
                onChange={(e) => {
                  const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value) || outputLanguage;
                  setOutputLanguage(lang);
                }}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none"
              >
                {SUPPORTED_LANGUAGES
                  .filter(lang => lang.code !== inputLanguage.code) // Don't allow same input and output languages
                  .map((lang) => (
                    <option key={`out-${lang.code}`} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <textarea
              id="journal-entry"
              rows={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-left"
              placeholder={`Type your journal entry in ${inputLanguage.name}...`}
              value={journalEntry}
              onChange={(e) => setJournalEntry(e.target.value)}
              dir={inputLanguage.code === 'ar' ? 'rtl' : 'ltr'}
              lang={inputLanguage.code}
            />
          </div>
        </div>

        <button
          onClick={handleCorrectGrammar}
          disabled={isSubmitting || isLoading || !journalEntry.trim()}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center transition-colors disabled:opacity-60"
        >
          {isSubmitting ? <LoadingSpinner size={4} className="mr-2" /> : <Edit3 size={16} className="mr-1.5" />}
          Correct Grammar & Spelling
        </button>

        <div className="text-sm font-medium text-slate-300 mb-4">
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleProcessEntry}
            disabled={isLoading || isSubmitting || !journalEntry.trim()}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            {isLoading && !isSubmitting ? <LoadingSpinner size={5} className="mr-2" /> : <Send size={18} className="mr-2" />}
            Process Entry
          </button>
          <button
            onClick={handleSaveJournalEntry}
            disabled={isLoading || isSubmitting || !processedData}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            <Save size={18} className="mr-2" />
            Save Entry
          </button>
        </div>
         <button 
            onClick={() => setCurrentView('savedEntries')}
            className="w-full mt-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-colors"
          >
            <Archive size={18} className="mr-2" /> View Saved Entries ({savedEntriesCount})
          </button>
      </div>

      <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl min-h-[400px]">
        <h2 className="text-2xl font-semibold text-sky-400 border-b border-slate-700 pb-3 mb-4">Entry Breakdown</h2>
        <OutputDisplay
          processedData={processedData}
          isLoading={isLoading && !isSubmitting}
          targetLanguage={outputLanguage}
          originalLanguage={inputLanguage}
          onSaveWord={onSaveWord}
          onCopy={copyToClipboard}
          savedWords={savedWords}
        />
      </div>
    </div>
  );
};

export default JournalView;
