import React, { useState } from 'react';
import { Archive as ArchiveIcon, BookOpen, Volume2, CalendarDays, Filter as FilterIcon, Search } from 'lucide-react';
import { JournalEntryData } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import LoadingSpinner from './LoadingSpinner';

interface SavedEntriesViewProps {
  savedEntries: JournalEntryData[];
  isLoading: boolean;
  loadJournalEntry: (entry: JournalEntryData) => void;
  onViewEntryDetail?: (entry: JournalEntryData) => void;
  setCurrentView?: (view: 'journal') => void; 
  setNotification?: (notification: { type: 'success' | 'error'; message: string } | null) => void;
}

const SavedEntriesView: React.FC<SavedEntriesViewProps> = ({ 
    savedEntries, 
    isLoading, 
    loadJournalEntry, 
    onViewEntryDetail,
}) => {
  const { speak, isSpeaking } = useSpeechSynthesis();
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  const targetLanguages = React.useMemo(() => {
    const langs = new Set<string>();
    savedEntries.forEach(entry => langs.add(entry.targetLanguageName));
    return Array.from(langs);
  }, [savedEntries]);

  const filteredEntries = React.useMemo(() => {
    return savedEntries
      .filter(entry => {
        const searchLower = searchTerm.toLowerCase();
        return (
          entry.originalEntry.toLowerCase().includes(searchLower) ||
          entry.translatedText.toLowerCase().includes(searchLower) ||
          entry.targetLanguageName.toLowerCase().includes(searchLower) ||
          new Date(entry.createdAt).toLocaleDateString().includes(searchLower)
        );
      })
      .filter(entry => languageFilter === 'all' || entry.targetLanguageName === languageFilter)
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); 
  }, [savedEntries, searchTerm, languageFilter]);


  if (isLoading && savedEntries.length === 0) {
    return (
      <div className="text-center p-10 flex flex-col items-center justify-center">
        <LoadingSpinner size={12} />
        <p className="mt-4 text-slate-300">Loading saved entries...</p>
      </div>
    );
  }

  if (!isLoading && savedEntries.length === 0) {
    return (
      <div className="max-w-3xl mx-auto bg-slate-800 p-8 rounded-xl shadow-2xl text-center">
        <ArchiveIcon className="h-16 w-16 text-sky-400 mx-auto mb-4" />
        <h2 className="text-3xl font-semibold text-sky-400 mb-4">No Entries Saved Yet</h2>
        <p className="text-slate-400">
          Your saved journal entries will appear here. Go to the Journal tab to write and save new entries.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 p-6 rounded-xl shadow-2xl">
      <h2 className="text-3xl font-semibold text-sky-400 mb-6 text-center">
        Saved Journal Entries ({filteredEntries.length} / {savedEntries.length})
      </h2>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 text-slate-100"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
        <div className="relative">
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-full p-3 pl-10 bg-slate-700 border border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-sky-500 text-slate-100 pr-8"
          >
            <option value="all">All Target Languages</option>
            {targetLanguages.map(langName => (
              <option key={langName} value={langName}>{langName}</option>
            ))}
          </select>
          <FilterIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
      </div>
      
      {filteredEntries.length === 0 && (searchTerm || languageFilter !== 'all') && (
         <p className="text-center text-slate-400 my-6">No entries match your current search/filter.</p>
      )}

      <ul className="space-y-4">
        {filteredEntries.map(entry => (
          <li key={entry.id} className="p-4 bg-slate-700/70 rounded-lg shadow hover:bg-slate-600/50 transition-colors">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-2">
              <div>
                <p className="text-sm text-slate-400 flex items-center">
                  <CalendarDays size={14} className="mr-1.5 text-amber-400" />
                  {new Date(entry.date || entry.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-amber-300 mt-0.5">
                  {entry.originalLanguageName} to {entry.targetLanguageName}
                </p>
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {onViewEntryDetail && (
                  <button
                    onClick={() => onViewEntryDetail(entry)}
                    className="bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium py-1.5 px-3 rounded-md flex items-center transition-colors"
                  >
                    View Details
                  </button>
                )}
                <button
                  onClick={() => {
                    // Ensure we include the date field when loading the entry
                    loadJournalEntry({
                      ...entry,
                      date: entry.date || new Date(entry.createdAt).toISOString().split('T')[0]
                    });
                  }}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium py-1.5 px-3 rounded-md flex items-center transition-colors"
                >
                  <BookOpen size={14} className="mr-1.5" /> Load to Journal
                </button>
              </div>
            </div>

            <details className="group">
              <summary className="text-slate-300 cursor-pointer hover:text-sky-300 text-sm list-none py-1">
                <span className="font-medium">Original ({entry.originalLanguageName}):</span> {entry.originalEntry.substring(0, 80)}...
                <span className="text-sky-400 group-open:hidden ml-1 text-xs">(Show more)</span>
                <span className="text-sky-400 hidden group-open:inline ml-1 text-xs">(Show less)</span>
              </summary>
              <p className="mt-1 text-slate-200 text-sm bg-slate-600/50 p-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">{entry.originalEntry}</p>
            </details>

            <div className="mt-3">
              <h4 className="text-md font-semibold text-sky-300 mb-1">Translated Entry ({entry.targetLanguageName}):</h4>
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => {
                      const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === entry.targetLanguageCode);
                      if (targetLang) speak(entry.translatedText, targetLang.speechCode);
                  }}
                  disabled={isSpeaking}
                  className="bg-sky-500 hover:bg-sky-400 text-white font-medium py-1.5 px-3 rounded-lg text-xs flex items-center transition-colors disabled:opacity-60"
                >
                  <Volume2 size={14} className="mr-1" /> Play Translation
                </button>
              </div>
              <p className="p-3 bg-slate-600/80 rounded-lg text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto text-sm">
                {entry.translatedText}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SavedEntriesView;
