import React from 'react';
import { ArrowLeft, Volume2, Copy, CheckCircle } from 'lucide-react';
import { JournalEntryData, Language } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { SUPPORTED_LANGUAGES } from '../constants';

interface EntryDetailViewProps {
  entry: JournalEntryData;
  onBack: () => void;
  onSaveWord: (word: any) => void;
  savedWords: any[];
}

const EntryDetailView: React.FC<EntryDetailViewProps> = ({
  entry,
  onBack,
  onSaveWord,
  savedWords
}) => {
  const { speak, isSpeaking } = useSpeechSynthesis();
  const targetLang = SUPPORTED_LANGUAGES.find(lang => lang.code === entry.targetLanguageCode);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show some feedback if needed
      });
  };

  const isWordSaved = (word: string, translation: string) => {
    return savedWords.some(w => 
      w.original.toLowerCase() === word.toLowerCase() && 
      w.translation.toLowerCase() === translation.toLowerCase()
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 p-6 rounded-xl shadow-2xl">
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-slate-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="mr-2" size={18} />
        Back to Entries
      </button>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-sky-400 mb-4">Original Entry</h2>
        <div className="bg-slate-700/50 p-4 rounded-lg">
          <p className="whitespace-pre-wrap">{entry.originalEntry}</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-sky-400">Translation</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => speak(entry.translatedText, targetLang?.speechCode || '')}
              disabled={isSpeaking}
              className="p-2 bg-sky-600 hover:bg-sky-500 rounded-md text-white disabled:opacity-50"
            >
              <Volume2 size={18} />
            </button>
            <button
              onClick={() => copyToClipboard(entry.translatedText)}
              className="p-2 bg-slate-600 hover:bg-slate-500 rounded-md text-white"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>
        <div className="bg-slate-700/50 p-4 rounded-lg">
          <p className="whitespace-pre-wrap">{entry.translatedText}</p>
        </div>
      </div>

      {entry.vocabularyList && entry.vocabularyList.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-sky-400 mb-3">Vocabulary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entry.vocabularyList.map((word, index) => (
              <div key={index} className="bg-slate-700/50 p-3 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sky-300">{word.original}</p>
                    <p className="text-emerald-300">{word.translation}</p>
                    <span className="text-xs text-slate-400">{word.category}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => speak(word.translation, targetLang?.speechCode || '')}
                      disabled={isSpeaking}
                      className="p-1.5 bg-sky-600 hover:bg-sky-500 rounded-md text-white disabled:opacity-50"
                    >
                      <Volume2 size={14} />
                    </button>
                    <button
                      onClick={() => onSaveWord(word)}
                      disabled={isWordSaved(word.original, word.translation)}
                      className={`p-1.5 rounded-md ${
                        isWordSaved(word.original, word.translation) 
                          ? 'bg-emerald-700 text-emerald-300' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isWordSaved(word.original, word.translation) ? (
                        <CheckCircle size={14} />
                      ) : (
                        <span>+</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.exampleSentences && entry.exampleSentences.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-sky-400 mb-3">Example Sentences</h3>
          <div className="space-y-3">
            {entry.exampleSentences.map((sentence, index) => (
              <div key={index} className="bg-slate-700/50 p-3 rounded-lg">
                <p className="whitespace-pre-wrap">{sentence}</p>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => speak(sentence, targetLang?.speechCode || '')}
                    disabled={isSpeaking}
                    className="p-1.5 bg-sky-600 hover:bg-sky-500 rounded-md text-white text-xs flex items-center disabled:opacity-50"
                  >
                    <Volume2 size={12} className="mr-1" /> Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntryDetailView;
