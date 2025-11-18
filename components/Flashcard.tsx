import React, { useState } from 'react';
import { FlashcardData } from '../types';
import PlaceholderImage from './PlaceholderImage';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';
import { SpeakerIcon, SpinnerIcon } from './icons';

interface FlashcardProps {
  cardData: FlashcardData;
  isFlipped: boolean;
  onFlip: () => void;
  sourceLangName: string;
  targetLangName: string;
}

// Create a single, lazy-initialized AudioContext instance for performance.
let audioContext: AudioContext | null = null;
const getAudioContext = () => {
    if (!audioContext || audioContext.state === 'closed') {
        // FIX: Cast window to `any` to allow for vendor-prefixed `webkitAudioContext` for older browsers.
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContext;
};


const Flashcard: React.FC<FlashcardProps> = ({ cardData, isFlipped, onFlip, sourceLangName, targetLangName }) => {
  const { word, translation, type, sentence, image } = cardData;
  const [audioLoading, setAudioLoading] = useState<'word' | 'sentence' | 'translation' | null>(null);

  const playAudio = async (text: string, type: 'word' | 'sentence' | 'translation') => {
      if (audioLoading) return; // Prevent multiple requests
      setAudioLoading(type);
      try {
          const base64Audio = await generateSpeech(text);
          const ctx = getAudioContext();
          const audioBuffer = await decodeAudioData(
              decode(base64Audio),
              ctx,
              24000,
              1,
          );
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.start();
      } catch (error) {
          console.error("Failed to play audio:", error);
          // TODO: Optionally show an error toast to the user
      } finally {
          setAudioLoading(null);
      }
  };

  const cardSideClasses = "absolute w-full h-full backface-hidden rounded-2xl shadow-lg overflow-hidden flex flex-col";

  const handleAudioButtonClick = (e: React.MouseEvent, text: string, type: 'word' | 'sentence' | 'translation') => {
    e.stopPropagation(); // Prevent the card from flipping when clicking the button
    playAudio(text, type);
  }

  return (
    <div className="w-full max-w-md h-96 perspective-1000" onClick={onFlip}>
      <div
        className={`relative w-full h-full transform-style-3d transition-transform duration-700 ${isFlipped ? 'rotate-y-180' : ''}`}
      >
        {/* Front of the card */}
        <div className={`${cardSideClasses} bg-white dark:bg-gray-800`}>
          <div className="w-full h-2/3">
            {image === 'no-image' ? (
              <PlaceholderImage />
            ) : (
              <img src={image} alt={word} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="p-4 flex-grow flex flex-col justify-center items-center text-center">
             <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-primary-600 dark:text-primary-400">{word}</h2>
                <button onClick={(e) => handleAudioButtonClick(e, word, 'word')} disabled={!!audioLoading} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
                    {audioLoading === 'word' ? <SpinnerIcon className="w-6 h-6 text-primary-500"/> : <SpeakerIcon className="w-6 h-6 text-gray-500 dark:text-gray-400"/>}
                </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-gray-600 dark:text-gray-400 italic">"{sentence}"</p>
               <button onClick={(e) => handleAudioButtonClick(e, sentence, 'sentence')} disabled={!!audioLoading} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
                    {audioLoading === 'sentence' ? <SpinnerIcon className="w-5 h-5 text-primary-500"/> : <SpeakerIcon className="w-5 h-5 text-gray-500 dark:text-gray-400"/>}
                </button>
            </div>
          </div>
           <div className="absolute bottom-2 right-4 text-xs text-gray-400">{targetLangName}</div>
        </div>

        {/* Back of the card */}
        <div className={`${cardSideClasses} bg-primary-500 dark:bg-primary-700 text-white rotate-y-180 flex flex-col justify-center items-center text-center p-6`}>
           <div className="flex items-center gap-3">
              <h2 className="text-4xl font-bold">{translation}</h2>
              <button onClick={(e) => handleAudioButtonClick(e, translation, 'translation')} disabled={!!audioLoading} className="p-1 rounded-full hover:bg-white/20 disabled:opacity-50 transition-colors">
                  {audioLoading === 'translation' ? <SpinnerIcon className="w-7 h-7 text-white"/> : <SpeakerIcon className="w-7 h-7 text-white"/>}
              </button>
            </div>
          <span className="mt-4 px-3 py-1 bg-white/20 rounded-full text-sm font-semibold capitalize">{type}</span>
          <div className="absolute bottom-2 right-4 text-xs text-primary-200">{sourceLangName}</div>
        </div>
      </div>
    </div>
  );
};

// Custom Tailwind utilities for 3D transform (to be used with a JIT compiler, but here as comments for reference)
// In a real project, you would add these to tailwind.config.js
// .perspective-1000 { perspective: 1000px; }
// .transform-style-3d { transform-style: preserve-3d; }
// .rotate-y-180 { transform: rotateY(180deg); }
// .backface-hidden { backface-visibility: hidden; }
// Adding inline styles for the demo environment since config cannot be modified.
const CustomStyles = () => (
    <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .backface-hidden { backface-visibility: hidden; }
    `}</style>
);


export default React.memo(Flashcard);
export { CustomStyles };