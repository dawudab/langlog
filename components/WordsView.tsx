import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Trash2, Volume2, Filter as FilterIcon, Search, Grid, List, BookOpen, Book, FileText, FileQuestion } from 'lucide-react';
import { SavedWord, Flashcard } from '../types'; 
import { SUPPORTED_LANGUAGES, DEFAULT_ORIGINAL_LANGUAGE } from '../constants';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import LoadingSpinner from './LoadingSpinner';
import FlashcardItem from './FlashcardItem';

interface WordsViewProps {
  savedWords: SavedWord[];
  isLoading: boolean;
  onDeleteWord: (wordId: string) => void;
  setNotification: (notification: { type: 'success' | 'error'; message: string } | null) => void;
}

const WordsView: React.FC<WordsViewProps> = ({ savedWords, isLoading, onDeleteWord }) => {
  const { speak } = useSpeechSynthesis();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'flashcards'>('flashcards');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [categories, setCategories] = useState<{name: string; count: number}[]>([]);

  // Filter and sort words
  const filteredWords = useMemo(() => {
    return savedWords
      .filter(word => {
        const searchLower = searchTerm.toLowerCase();
        return (
          word.original.toLowerCase().includes(searchLower) ||
          word.translation.toLowerCase().includes(searchLower) ||
          (word.category || 'Uncategorized').toLowerCase().includes(searchLower)
        );
      })
      .filter(word => categoryFilter === 'all' || (word.category || 'Uncategorized') === categoryFilter)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [savedWords, searchTerm, categoryFilter]);

  // Group words by part of speech
  const wordsByCategory = useMemo(() => {
    const groups: Record<string, SavedWord[]> = {
      'Nouns': [],
      'Verbs': [],
      'Adjectives': [],
      'Adverbs': [],
      'Phrases': [],
      'Other': []
    };

    // Helper function to detect part of speech
    const detectPartOfSpeech = (word: SavedWord): string => {
      const lowerWord = word.original.toLowerCase();
      
      // Check for common verb endings
      if (/(ing|ed|s|es|ies)$/.test(lowerWord) || 
          ['to ', 'can ', 'will ', 'should ', 'could '].some(prefix => 
            word.englishEquivalent?.toLowerCase().startsWith(prefix))) {
        return 'Verbs';
      }
      
      // Check for common noun endings
      if (/(tion|ment|ness|ity|ence|ance|ship|hood|dom|ism|ist|er|or|ess|ion)$/.test(lowerWord) ||
          ['the ', 'a ', 'an '].some(article => 
            word.englishEquivalent?.toLowerCase().startsWith(article))) {
        return 'Nouns';
      }
      
      // Check for common adjective endings
      if (/(ous|ful|ish|less|able|ible|ic|ical|ive|ous|y|ary|some)$/.test(lowerWord) ||
          word.englishEquivalent?.toLowerCase().includes(' is ') ||
          word.englishEquivalent?.toLowerCase().includes(' are ')) {
        return 'Adjectives';
      }
      
      // Check for common adverb endings
      if (/(ly|wise|ward|wards)$/.test(lowerWord) ||
          word.englishEquivalent?.toLowerCase().includes('ly ')) {
        return 'Adverbs';
      }
      
      // Check for phrases (multiple words)
      if (word.original.includes(' ') || word.englishEquivalent?.includes(' ')) {
        return 'Phrases';
      }
      
      return 'Other';
    };

    // Categorize each word
    filteredWords.forEach(word => {
      const category = word.category || detectPartOfSpeech(word);
      const targetCategory = Object.keys(groups).includes(category) ? category : 'Other';
      groups[targetCategory].push(word);
    });

    // Filter out empty categories and sort them
    const sortedCategories = Object.entries(groups)
      .filter(([_, words]) => words.length > 0)
      .sort(([catA], [catB]) => catA.localeCompare(catB));

    // Update categories state for the tabs
    const categoryList = sortedCategories.map(([category, words]) => ({
      name: category,
      count: words.length
    }));
    
    setCategories(categoryList);
    
    // Return sorted categories with words
    return Object.fromEntries(sortedCategories);
  }, [filteredWords]);

  // Get current category name
  const currentCategory = useMemo(() => {
    return categories[currentCategoryIndex]?.name || 'Uncategorized';
  }, [categories, currentCategoryIndex]);

  // Get words for current category
  const currentCategoryWords = useMemo(() => {
    return wordsByCategory[currentCategory] || [];
  }, [wordsByCategory, currentCategory]);

  // Convert current category words to flashcards
  useEffect(() => {
    const newFlashcards = currentCategoryWords.map(word => ({
      front: word.original,
      back: word.translation,
      isFlipped: false,
      id: word.id,
      category: word.category || 'Uncategorized',
      targetLangCode: word.targetLangCode
    }));
    setFlashcards(newFlashcards);
    setCurrentCardIndex(0);
  }, [currentCategoryWords]);

  // Navigation handlers
  const handleFlip = useCallback(() => {
    setFlashcards(prev => {
      const newFlashcards = [...prev];
      if (newFlashcards[currentCardIndex]) {
        newFlashcards[currentCardIndex] = {
          ...newFlashcards[currentCardIndex],
          isFlipped: !newFlashcards[currentCardIndex].isFlipped
        };
      }
      return newFlashcards;
    });
  }, [currentCardIndex]);

  const handleNextCard = useCallback(() => {
    setFlashcards(prev => {
      const newFlashcards = [...prev];
      if (newFlashcards[currentCardIndex]) {
        newFlashcards[currentCardIndex] = {
          ...newFlashcards[currentCardIndex],
          isFlipped: false
        };
      }
      return newFlashcards;
    });

    if (currentCardIndex >= currentCategoryWords.length - 1) {
      // Go to next category if available
      if (currentCategoryIndex < categories.length - 1) {
        setCurrentCategoryIndex(prev => prev + 1);
        setCurrentCardIndex(0);
      } else {
        // Loop back to first card
        setCurrentCardIndex(0);
      }
    } else {
      setCurrentCardIndex(prev => prev + 1);
    }
  }, [currentCardIndex, currentCategoryWords.length, currentCategoryIndex, categories.length]);

  const handlePrevCard = useCallback(() => {
    setFlashcards(prev => {
      const newFlashcards = [...prev];
      if (newFlashcards[currentCardIndex]) {
        newFlashcards[currentCardIndex] = {
          ...newFlashcards[currentCardIndex],
          isFlipped: false
        };
      }
      return newFlashcards;
    });

    if (currentCardIndex <= 0) {
      // Go to previous category if available
      if (currentCategoryIndex > 0) {
        const prevCategoryIndex = currentCategoryIndex - 1;
        const prevCategoryName = categories[prevCategoryIndex]?.name || 'Uncategorized';
        const prevCategoryWords = wordsByCategory[prevCategoryName] || [];
        setCurrentCategoryIndex(prevCategoryIndex);
        setCurrentCardIndex(prevCategoryWords.length - 1);
      } else {
        // Loop to last card
        setCurrentCardIndex(currentCategoryWords.length - 1);
      }
    } else {
      setCurrentCardIndex(prev => prev - 1);
    }
  }, [currentCardIndex, currentCategoryIndex, categories, wordsByCategory, currentCategoryWords.length]);

  // Speech handlers
  const handleSpeakFront = useCallback(() => {
    if (currentCardIndex < currentCategoryWords.length) {
      const word = currentCategoryWords[currentCardIndex];
      speak(word.original, DEFAULT_ORIGINAL_LANGUAGE.speechCode);
    }
  }, [currentCardIndex, currentCategoryWords, speak]);

  const handleSpeakBack = useCallback(() => {
    if (currentCardIndex < currentCategoryWords.length) {
      const word = currentCategoryWords[currentCardIndex];
      speak(word.translation, word.targetLangCode);
    }
  }, [currentCardIndex, currentCategoryWords, speak]);

  // Loading state
  if (isLoading && savedWords.length === 0) {
    return (
      <div className="text-center p-10 flex flex-col items-center justify-center">
        <LoadingSpinner size={12} />
        <p className="mt-4 text-slate-300">Loading saved words...</p>
      </div>
    );
  }

  // Empty state
  if (!isLoading && savedWords.length === 0) {
    return (
      <div className="max-w-3xl mx-auto bg-slate-800 p-8 rounded-xl shadow-2xl text-center">
        <BookOpen className="h-16 w-16 text-sky-400 mx-auto mb-4" />
        <h2 className="text-3xl font-semibold text-sky-400 mb-4">No Vocabulary Yet!</h2>
        <p className="text-slate-400">
          No words saved yet. Head over to the Journal, process an entry, and save new vocabulary you learn!
        </p>
      </div>
    );
  }

  // Get all available categories from words
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    savedWords.forEach(word => {
      const category = word.category || 'Uncategorized';
      cats.add(category);
    });
    return Array.from(cats).sort();
  }, [savedWords]);

  // Render category tabs
  const renderCategoryTabs = useCallback(() => (
    <div className="mb-6 overflow-x-auto">
      <div className="flex space-x-1 pb-2">
        {categories.map((category, index) => (
          <button
            key={category.name}
            onClick={() => {
              setCurrentCategoryIndex(index);
              setCurrentCardIndex(0);
            }}
            className={`px-4 py-2 rounded-t-lg flex items-center space-x-2 transition-colors ${
              index === currentCategoryIndex
                ? 'bg-slate-700 text-sky-400'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {category.name === 'Nouns' && <Book size={16} />}
              {category.name === 'Verbs' && <FileText size={16} />}
              {category.name === 'Adjectives' && <FileText size={16} />}
              {category.name === 'Adverbs' && <FileText size={16} />}
              {category.name === 'Phrases' && <List size={16} />}
              {category.name === 'Other' && <FileQuestion size={16} />}
            <span>{category.name}</span>
            <span className="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded-full">
              {category.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  ), [categories, currentCategoryIndex]);

  // Render flashcard view
  const renderFlashcardView = useCallback(() => (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-sky-300 flex items-center">
          <BookOpen className="mr-2" size={20} />
          {currentCategory}
        </h3>
        <div className="text-slate-400">
          Card {currentCategoryWords.length > 0 ? currentCardIndex + 1 : 0} of {currentCategoryWords.length}
        </div>
      </div>
      
      {categories.length > 1 && renderCategoryTabs()}
      
      {currentCategoryWords.length > 0 ? (
        <div className="relative">
          <div className="perspective w-full max-w-md h-64 mx-auto">
            <FlashcardItem 
              flashcard={flashcards[currentCardIndex] || { front: '', back: '', isFlipped: false }}
              onFlip={handleFlip}
              onSpeakFront={handleSpeakFront}
              onSpeakBack={handleSpeakBack}
            />
          </div>
          
          <div className="flex justify-between mt-6">
            <button
              onClick={handlePrevCard}
              disabled={currentCategoryWords.length <= 1}
              className={`px-4 py-2 rounded-lg ${
                currentCategoryWords.length <= 1
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNextCard}
              disabled={currentCategoryWords.length <= 1}
              className={`px-4 py-2 rounded-lg ${
                currentCategoryWords.length <= 1
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-600 text-white hover:bg-sky-500'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 bg-slate-800/50 rounded-xl">
          {categories.length === 0 
            ? 'No words match your search. Try adjusting your filters.'
            : `No words found in ${currentCategory}.`}
        </div>
      )}
    </div>
  ), [currentCategory, currentCategoryWords, currentCardIndex, categories, renderCategoryTabs, 
      flashcards, handleFlip, handleSpeakFront, handleSpeakBack, handlePrevCard, handleNextCard]);

  // Render word list view
  const renderWordList = useCallback(() => (
    <div className="space-y-4">
      {filteredWords.map((word) => (
        <div key={word.id} className="bg-slate-750 p-4 rounded-lg shadow-md hover:bg-slate-700 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center">
                <span className="font-bold text-lg text-white">{word.original}</span>
                <button
                  onClick={() => speak(word.original, DEFAULT_ORIGINAL_LANGUAGE.speechCode)}
                  className="ml-2 p-1 text-slate-400 hover:text-sky-400 transition-colors"
                  aria-label="Speak word"
                >
                  <Volume2 size={16} />
                </button>
              </div>
              <p className="text-sky-300 mt-1">{word.translation}</p>
              <div className="flex items-center mt-2">
                <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded-full">
                  {word.category || 'Uncategorized'}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  {SUPPORTED_LANGUAGES.find(lang => lang.code === word.targetLangCode)?.name || word.targetLangCode}
                </span>
              </div>
            </div>
            <button
              onClick={() => onDeleteWord(word.id)}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              aria-label="Delete word"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  ), [filteredWords, onDeleteWord, speak]);

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 p-6 rounded-xl shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-sky-400">
            {viewMode === 'flashcards' ? 'Flashcards' : 'Saved Words'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {viewMode === 'flashcards' 
              ? `Showing ${currentCategoryWords.length} words in ${currentCategory}`
              : `Showing ${filteredWords.length} of ${savedWords.length} words`}
          </p>
        </div>
        
        <div className="flex space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search words..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-10 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 text-slate-100"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>
          
          {viewMode !== 'flashcards' && (
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 pl-10 bg-slate-700 border border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-sky-500 text-slate-100 pr-8"
              >
                <option value="all">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <FilterIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            </div>
          )}
          
          <div className="flex bg-slate-700 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${
                viewMode === 'list' 
                  ? 'bg-slate-600 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="List view"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('flashcards')}
              className={`p-2 rounded-md ${
                viewMode === 'flashcards' 
                  ? 'bg-slate-600 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="Flashcard view"
            >
              <Grid size={20} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'flashcards' ? renderFlashcardView() : renderWordList()}
    </div>
  );
};

export default WordsView;
