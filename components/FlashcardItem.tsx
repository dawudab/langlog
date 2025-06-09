import React from 'react';
import { Volume2 } from 'lucide-react';
import { Flashcard } from '../types';

interface FlashcardItemProps {
  flashcard: Flashcard;
  onFlip: () => void;
  onSpeakFront: () => void;
  onSpeakBack: () => void;
}

const FlashcardItem: React.FC<FlashcardItemProps> = ({ flashcard, onFlip, onSpeakFront, onSpeakBack }) => {
  return (
    <div className="perspective w-full max-w-md h-64 mx-auto">
      <div 
        className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-700 ease-in-out ${flashcard.isFlipped ? 'rotate-y-180' : ''}`}
        onClick={onFlip}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full backface-hidden bg-sky-700 rounded-xl shadow-xl p-6 flex flex-col justify-between items-center cursor-pointer">
          <div className="text-center">
            <p className="text-xs text-sky-200 mb-2">Original</p>
            <p className="text-2xl sm:text-3xl font-bold text-white break-words">{flashcard.front}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSpeakFront(); }}
            className="p-2 rounded-full bg-sky-500 hover:bg-sky-400 text-white transition-colors"
            aria-label="Speak front of card"
          >
            <Volume2 size={20} />
          </button>
        </div>
        {/* Back of the card */}
        <div className="absolute w-full h-full backface-hidden bg-emerald-600 rounded-xl shadow-xl p-6 flex flex-col justify-between items-center rotate-y-180 cursor-pointer">
          <div className="text-center">
            <p className="text-xs text-emerald-100 mb-2">Translation</p>
            <p className="text-2xl sm:text-3xl font-bold text-white break-words">{flashcard.back}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSpeakBack(); }}
            className="p-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-white transition-colors"
            aria-label="Speak back of card"
          >
            <Volume2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardItem;

// Add this to your global styles or a <style> tag in index.html for the perspective effect
// .perspective { perspective: 1000px; }
// Already added to index.html
