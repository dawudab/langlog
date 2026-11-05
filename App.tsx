import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import JournalView from './components/JournalView';
import WordsView from './components/WordsView';
import SavedEntriesView from './components/SavedEntriesView';
import EntryDetailView from './components/EntryDetailView';
import Notification from './components/Notification';
import { AppView, JournalEntryData, SavedWord, VocabularyItem, NotificationMessage } from './types';
import { DEFAULT_TARGET_LANGUAGE_CODE } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('journal');
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [targetLangCode, setTargetLangCode] = useState<string>(DEFAULT_TARGET_LANGUAGE_CODE);
  const [savedEntries, setSavedEntries] = useState<JournalEntryData[]>([]);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [entryToLoadInJournal, setEntryToLoadInJournal] = useState<JournalEntryData | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryData | null>(null);

  useEffect(() => {
    const storedEntries = localStorage.getItem('enArJournalEntries');
    if (storedEntries) {
      try {
        setSavedEntries(JSON.parse(storedEntries).map((e: any) => ({...e, createdAt: new Date(e.createdAt)})));
      } catch (e) { console.error("Failed to parse stored entries", e); }
    }
    const storedWords = localStorage.getItem('enArJournalWords');
    if (storedWords) {
       try {
        setSavedWords(JSON.parse(storedWords).map((w: any) => ({...w, savedAt: new Date(w.savedAt)})));
       } catch (e) { console.error("Failed to parse stored words", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('enArJournalEntries', JSON.stringify(savedEntries));
  }, [savedEntries]);

  useEffect(() => {
    localStorage.setItem('enArJournalWords', JSON.stringify(savedWords));
  }, [savedWords]);

  const handleSaveFullEntry = useCallback((entryData: Omit<JournalEntryData, 'id' | 'createdAt'>) => {
    const newEntry: JournalEntryData = {
      ...entryData,
      id: Date.now().toString(), 
      createdAt: new Date(),
    };
    setSavedEntries(prev => [newEntry, ...prev]);
    setNotification({ type: 'success', message: 'Entry saved successfully!' });
  }, []);

  const handleSaveWord = useCallback((wordToSave: VocabularyItem) => {
    const isAlreadySaved = savedWords.some(
      sw => sw.original.toLowerCase() === wordToSave.original.toLowerCase() && 
            sw.translation.toLowerCase() === wordToSave.translation.toLowerCase() &&
            sw.targetLangCode === targetLangCode 
    );

    if (isAlreadySaved) {
      setNotification({ type: 'error', message: 'This word is already saved.'});
      return;
    }

    const newWord: SavedWord = {
      ...wordToSave,
      id: `${wordToSave.original}-${Date.now()}`,
      targetLangCode: targetLangCode, 
      englishEquivalent: wordToSave.original, 
      savedAt: new Date(),
    };
    setSavedWords(prev => [newWord, ...prev]);
    setNotification({ type: 'success', message: `"${wordToSave.original}" saved to your words!` });
  }, [savedWords, targetLangCode]);

  const handleDeleteSavedWord = useCallback((wordId: string) => {
    setSavedWords(prev => prev.filter(word => word.id !== wordId));
  }, []);
  
  const handleLoadEntryInJournal = (entry: JournalEntryData) => {
    setTargetLangCode(entry.targetLanguageCode);
    setEntryToLoadInJournal(entry);
    setCurrentView('journal');
    setNotification({type: 'success', message: 'Entry loaded into Journal view.'});
  };

  const handleViewEntryDetail = (entry: JournalEntryData) => {
    setSelectedEntry(entry);
    setCurrentView('entryDetail');
  };

  const handleBackFromEntryDetail = () => {
    setCurrentView('savedEntries');
    setSelectedEntry(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-sky-950 text-slate-100 font-sans flex flex-col">
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <main className="flex-grow p-4 md:p-6 lg:p-8">
        {currentView === 'journal' && (
          <JournalView
            setNotification={setNotification}
            setCurrentView={setCurrentView}
            savedEntriesCount={savedEntries.length}
            onSaveFullEntry={handleSaveFullEntry}
            onSaveWord={handleSaveWord}
            savedWords={savedWords}
            entryToLoad={entryToLoadInJournal}
            onEntryLoaded={() => setEntryToLoadInJournal(null)}
          />
        )}
        
        {currentView === 'words' && (
          <WordsView
            savedWords={savedWords}
            isLoading={false} 
            onDeleteWord={handleDeleteSavedWord}
            setNotification={setNotification}
          />
        )}
        
        {currentView === 'savedEntries' && (
          <SavedEntriesView
            savedEntries={savedEntries}
            isLoading={false}
            loadJournalEntry={handleLoadEntryInJournal}
            onViewEntryDetail={handleViewEntryDetail}
            setCurrentView={setCurrentView}
            setNotification={setNotification}
          />
        )}
        
        {currentView === 'entryDetail' && selectedEntry && (
          <EntryDetailView
            entry={selectedEntry}
            onBack={handleBackFromEntryDetail}
            onSaveWord={handleSaveWord}
            savedWords={savedWords}
          />
        )}
      </main>
      
      <footer className="text-center py-4 text-sm text-slate-500 border-t border-slate-700/50">
        LinguaJournal AI &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
