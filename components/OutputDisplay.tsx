import React, { useState } from 'react';
import { Volume2, Copy, Star, PlusCircle, CheckCircle, ThumbsUp, ThumbsDown, Shuffle, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { ProcessedEntryData, VocabularyItem, Flashcard, Language } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import FlashcardItem from './FlashcardItem';
import LoadingSpinner from './LoadingSpinner';

interface OutputDisplayProps {
  processedData: ProcessedEntryData | null;
  isLoading: boolean;
  targetLanguage: Language;
  originalLanguage: Language;
  onSaveWord: (word: VocabularyItem) => void;
  onCopy: (text: string, type: string) => void;
  savedWords: VocabularyItem[];
}

// Type icon as React.ReactElement that accepts className
interface OutputSectionProps {
    title: string;
    icon: React.ReactElement<{ className?: string }>;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const OutputSection: React.FC<OutputSectionProps> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="bg-slate-700/50 p-4 rounded-lg">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left mb-2">
        <h3 className="text-lg font-semibold text-sky-300 flex items-center">
          {React.cloneElement(icon, { className: "h-5 w-5 mr-2"})}
          {title}
        </h3>
        {isOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronLeftIcon className="h-5 w-5 text-slate-400" />}
      </button>
      {isOpen && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  );
};

// Using actual Lucide ChevronLeft as ChevronLeftIcon for consistency.
const ChevronLeftIcon: React.FC<{className?: string}> = ({className}) => <ChevronLeft className={className} />;
const ChevronDown: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"></polyline></svg>;


const OutputDisplay: React.FC<OutputDisplayProps> = ({
  processedData,
  isLoading,
  targetLanguage,
  originalLanguage,
  onSaveWord,
  onCopy,
  savedWords
}) => {
  const { 
    speak, 
    isSpeaking, 
    isPaused, 
    currentText, 
    progress,
    stop: stopSpeech
  } = useSpeechSynthesis();
  const [currentFlashcardDeck, setCurrentFlashcardDeck] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardReview, setShowFlashcardReview] = useState(false);
  const [reviewStats, setReviewStats] = useState({ correct: 0, incorrect: 0 });

  React.useEffect(() => {
    if (processedData?.flashcards) {
      setCurrentFlashcardDeck(processedData.flashcards.map(fc => ({ ...fc, isFlipped: false })));
      setCurrentFlashcardIndex(0);
      setShowFlashcardReview(false); 
      setReviewStats({ correct: 0, incorrect: 0 });
    }
  }, [processedData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] bg-slate-800 p-6 rounded-xl shadow-2xl space-y-4">
        <LoadingSpinner size={10} />
        <p className="text-slate-300">AI is processing your entry...</p>
      </div>
    );
  }

  if (!processedData) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl shadow-2xl min-h-[200px] flex items-center justify-center">
        <p className="text-slate-400 text-center">Your processed entry results will appear here.</p>
      </div>
    );
  }
  
  const { translation, vocabulary, exampleSentences } = processedData;

  const handleFlashcardFlip = (index: number) => {
    setCurrentFlashcardDeck(prev => 
      prev.map((card, i) => i === index ? { ...card, isFlipped: !card.isFlipped } : card)
    );
  };

  const startFlashcardReview = () => {
    if (currentFlashcardDeck.length === 0) return;
    setCurrentFlashcardDeck(prev => shuffleArray([...prev]).map(card => ({ ...card, isFlipped: false })));
    setCurrentFlashcardIndex(0);
    setReviewStats({ correct: 0, incorrect: 0 });
    setShowFlashcardReview(true);
  };

  const handleFlashcardNavigation = (direction: 'next' | 'prev') => {
    setCurrentFlashcardIndex(prev => {
      const newIndex = direction === 'next' ? prev + 1 : prev - 1;
      if (newIndex >= 0 && newIndex < currentFlashcardDeck.length) {
        // Ensure the card is not flipped when navigating
        setCurrentFlashcardDeck(deck => deck.map((card, i) => i === newIndex ? { ...card, isFlipped: false } : card));
        return newIndex;
      }
      return prev; 
    });
  };

  const handleFlashcardAnswer = (isCorrect: boolean) => {
    setReviewStats(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
    }));
    // Automatically move to the next card
    if (currentFlashcardIndex < currentFlashcardDeck.length - 1) {
      handleFlashcardNavigation('next');
    } else {
      // Optionally, show summary or end review automatically
      // For now, user can click "End Review"
      setNotification({type:'success', message: `Review finished! Correct: ${reviewStats.correct + (isCorrect ? 1:0)}, Incorrect: ${reviewStats.incorrect + (!isCorrect ? 1:0)}`});
    }
  };
  
  const shuffleArray = <T,>(array: T[]): T[] => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };
  
  const setNotification = (notification: { type: 'success' | 'error'; message: string } | null) => {
    // This is a placeholder if OutputDisplay needs to show its own notifications.
    // Usually, notifications are handled at App level.
    // For now, this won't do anything unless OutputDisplay has its own notification state.
    console.log("Notification from OutputDisplay:", notification);
  };


  const currentCardData = showFlashcardReview && currentFlashcardDeck.length > 0 ? currentFlashcardDeck[currentFlashcardIndex] : null;


  return (
    <div className="space-y-6">
      {showFlashcardReview && currentCardData ? (
        <OutputSection title="Flashcard Review" icon={<Star />}>
          <FlashcardItem
            flashcard={currentCardData}
            onFlip={() => handleFlashcardFlip(currentFlashcardIndex)}
            onSpeakFront={() => speak(currentCardData.front, originalLanguage.speechCode)}
            onSpeakBack={() => speak(currentCardData.back, targetLanguage.speechCode)}
          />
          <div className="flex justify-between items-center mt-4">
            <button 
              onClick={() => handleFlashcardNavigation('prev')} 
              disabled={currentFlashcardIndex === 0}
              className="p-2 bg-slate-600 hover:bg-slate-500 rounded-md disabled:opacity-50 text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex space-x-2">
                <button 
                    onClick={() => handleFlashcardAnswer(false)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-400 rounded-md text-white flex items-center"
                >
                    <ThumbsDown size={18} className="mr-1.5"/> Incorrect
                </button>
                <button 
                    onClick={() => handleFlashcardAnswer(true)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-400 rounded-md text-white flex items-center"
                >
                    <ThumbsUp size={18} className="mr-1.5"/> Correct
                </button>
            </div>
            <button 
              onClick={() => handleFlashcardNavigation('next')} 
              disabled={currentFlashcardIndex === currentFlashcardDeck.length - 1}
              className="p-2 bg-slate-600 hover:bg-slate-500 rounded-md disabled:opacity-50 text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="text-center text-sm text-slate-300 mt-2">
            Card {currentFlashcardIndex + 1} of {currentFlashcardDeck.length} | 
            Correct: {reviewStats.correct}, Incorrect: {reviewStats.incorrect}
          </div>
           <button 
              onClick={() => setShowFlashcardReview(false)} 
              className="mt-4 w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-white flex items-center justify-center"
            >
              <XCircle size={18} className="mr-1.5" /> End Review
            </button>
        </OutputSection>
      ) : (
        <>
          {translation && (
            <OutputSection title="Translation" icon={<Volume2 />}>
              <div className="p-3 bg-slate-600/70 rounded-lg text-slate-200 whitespace-pre-wrap text-sm md:text-base">
                {translation}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (currentText === translation && (isSpeaking || isPaused)) {
                        if (isPaused) {
                          speak(translation, targetLanguage.speechCode);
                        } else {
                          stopSpeech();
                        }
                      } else {
                        speak(translation, targetLanguage.speechCode);
                      }
                    }}
                    disabled={isSpeaking && currentText !== translation}
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      currentText === translation && isSpeaking 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-sky-500 hover:bg-sky-600'
                    } text-white transition-colors disabled:opacity-50`}
                  >
                    {currentText === translation && isSpeaking ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <Volume2 size={16} />
                    )}
                  </button>
                  
                  {currentText === translation && (
                    <div className="flex-1 flex items-center space-x-2">
                      <div className="h-2 bg-slate-700 rounded-full flex-1 overflow-hidden">
                        <div 
                          className="h-full bg-sky-500 transition-all duration-100 ease-out"
                          style={{ 
                            width: `${Math.round(progress * 100)}%`,
                            opacity: currentText === translation ? 1 : 0.5
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-10 text-right">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => onCopy(translation, 'Translation')}
                    className="ml-2 flex items-center text-xs sm:text-sm py-2 px-3 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors"
                  >
                    <Copy size={16} className="mr-1.5" /> Copy
                  </button>
                </div>
              </div>
            </OutputSection>
          )}

          {vocabulary.length > 0 && (
            <OutputSection title="Key Vocabulary" icon={<Star />}>
              <div className="max-h-96 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vocabulary.map((item, index) => {
                    const isSaved = savedWords.some(sw => sw.original.toLowerCase() === item.original.toLowerCase() && sw.translation.toLowerCase() === item.translation.toLowerCase());
                    return (
                      <div key={index} className="p-3 bg-slate-600/70 rounded-md">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-sky-300">{item.original}</div>
                            <div className="text-emerald-300 text-sm mt-1">{item.translation}</div>
                            <span className="text-xs text-slate-400">{item.category}</span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => speak(item.translation, targetLanguage.speechCode)}
                              disabled={isSpeaking}
                              className="p-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-md transition-colors disabled:opacity-70"
                              aria-label="Play vocabulary translation"
                            >
                              <Volume2 size={14} />
                            </button>
                            <button
                              onClick={() => onSaveWord({...item, isSaved: true})}
                              disabled={isSaved}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-md transition-colors disabled:opacity-70 disabled:bg-emerald-700"
                              aria-label={isSaved ? "Word saved" : "Save word"}
                            >
                              {isSaved ? <CheckCircle size={14} /> : <PlusCircle size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </OutputSection>
          )}

          {exampleSentences.length > 0 && (
            <OutputSection title="Example Sentences" icon={<Volume2 />}>
              <ul className="space-y-2">
                {exampleSentences.map((sentence, index) => (
                  <li key={index} className="p-3 bg-slate-600/70 rounded-md">
                    <p className="text-slate-200">{sentence}</p>
                    <div className="mt-1.5 flex space-x-2">
                        <button
                          onClick={() => speak(sentence, targetLanguage.speechCode)}
                          disabled={isSpeaking}
                          className="flex items-center text-xs py-1 px-2 bg-sky-500 hover:bg-sky-400 text-white rounded-md transition-colors disabled:opacity-70"
                        >
                            <Volume2 size={14} className="mr-1" /> Play
                        </button>
                         <button
                          onClick={() => onCopy(sentence, 'Example Sentence')}
                          className="flex items-center text-xs py-1 px-2 bg-slate-500 hover:bg-slate-400 text-white rounded-md transition-colors"
                        >
                          <Copy size={14} className="mr-1" /> Copy
                        </button>
                    </div>
                  </li>
                ))}
              </ul>
            </OutputSection>
          )}

          {currentFlashcardDeck.length > 0 && !showFlashcardReview && (
            <OutputSection title="Flashcards" icon={<Star />} defaultOpen={false}>
               <button 
                  onClick={startFlashcardReview}
                  className="w-full mb-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-md text-white font-semibold flex items-center justify-center"
                >
                  <Shuffle size={18} className="mr-2" /> Start Review Session ({currentFlashcardDeck.length} cards)
                </button>
              <div className="relative">
                <div className="flex overflow-x-auto pb-4 -mx-2 px-2 hide-scrollbar">
                  <div className="flex space-x-4">
                    {currentFlashcardDeck.map((flashcard, index) => (
                      <div key={index} className="flex-shrink-0 w-64">
                        <FlashcardItem
                          flashcard={flashcard}
                          onFlip={() => handleFlashcardFlip(index)}
                          onSpeakFront={() => speak(flashcard.front, originalLanguage.speechCode)}
                          onSpeakBack={() => speak(flashcard.back, targetLanguage.speechCode)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-slate-900/80 pointer-events-none"></div>
              </div>
              <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .hide-scrollbar {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
              `}</style>
            </OutputSection>
          )}
        </>
      )}
    </div>
  );
};

export default OutputDisplay;
