
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FlashcardData, Difficulty, Language } from './types';
import { LANGUAGES, DIFFICULTIES } from './constants';
import { generateFlashcards } from './services/geminiService';
import Flashcard, { CustomStyles } from './components/Flashcard';
import Spinner from './components/Spinner';
import { SwapIcon, ChevronLeftIcon, ChevronRightIcon } from './components/icons';

const App: React.FC = () => {
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [sourceLang, setSourceLang] = useState<Language>(LANGUAGES[1]); // English
    const [targetLang, setTargetLang] = useState<Language>(LANGUAGES[0]); // French
    
    const [cards, setCards] = useState<FlashcardData[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // State for swipe gestures
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [isSwiping, setIsSwiping] = useState<boolean>(false);
    const [swipeOffset, setSwipeOffset] = useState<number>(0);

    const fetchCards = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setCards([]);
        setCurrentIndex(0);
        setIsFlipped(false);
        try {
            const generatedCards = await generateFlashcards(sourceLang.name, targetLang.name, difficulty);
            setCards(generatedCards);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [difficulty, sourceLang, targetLang]);
    
    useEffect(() => {
        fetchCards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [difficulty, sourceLang, targetLang]);

    const handleNext = () => {
        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setIsFlipped(false);
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleFlip = () => {
        if (cards.length > 0) {
            setIsFlipped(!isFlipped);
        }
    };

    const handleSwapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isLoading || !cards.length) return;
        // Prevent swipe from starting on interactive elements like buttons
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        setTouchStartX(e.targetTouches[0].clientX);
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX === null || isLoading || !cards.length) return;
        const currentX = e.targetTouches[0].clientX;
        const deltaX = currentX - touchStartX;
        
        // Add resistance at the edges for a bouncier feel
        if ((currentIndex === 0 && deltaX > 0) || (currentIndex === cards.length - 1 && deltaX < 0)) {
            setSwipeOffset(deltaX / 4);
        } else {
            setSwipeOffset(deltaX);
        }
    };

    const handleTouchEnd = () => {
        if (touchStartX === null || isLoading || !cards.length) return;
        
        const minSwipeDistance = 75; // Minimum pixels for a swipe to be registered

        if (swipeOffset < -minSwipeDistance && currentIndex < cards.length - 1) {
            handleNext();
        } else if (swipeOffset > minSwipeDistance && currentIndex > 0) {
            handlePrev();
        }

        // Reset with a smooth transition
        setIsSwiping(false);
        setSwipeOffset(0);
        setTouchStartX(null);
    };


    const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);
    
    const renderSelect = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {value: string, label: string}[], label: string) => (
        <div className="flex flex-col">
            <label htmlFor={label} className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <select
                id={label}
                value={value}
                onChange={onChange}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );
    
    return (
        <div className="min-h-screen flex flex-col p-4 sm:p-6 lg:p-8">
            <CustomStyles />
            <header className="text-center mb-6">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-500">
                    LingoFlip AI
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">AI-Powered Flashcards for Language Learning</p>
            </header>

            <div className="w-full max-w-4xl mx-auto bg-gray-200 dark:bg-gray-800/50 p-4 rounded-xl shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="flex items-end gap-2">
                        {renderSelect(sourceLang.code, e => setSourceLang(LANGUAGES.find(l => l.code === e.target.value)!), LANGUAGES.map(l => ({value: l.code, label: l.name})), "From")}
                        <button onClick={handleSwapLanguages} className="p-2 rounded-md bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm border border-gray-300 dark:border-gray-600">
                            <SwapIcon className="w-6 h-6 text-gray-600 dark:text-gray-300"/>
                        </button>
                        {renderSelect(targetLang.code, e => setTargetLang(LANGUAGES.find(l => l.code === e.target.value)!), LANGUAGES.map(l => ({value: l.code, label: l.name})), "To")}
                    </div>
                     {renderSelect(difficulty, e => setDifficulty(e.target.value as Difficulty), DIFFICULTIES.map(d => ({value: d, label: d})), "Difficulty")}
                     <button onClick={fetchCards} disabled={isLoading} className="w-full sm:w-auto justify-self-stretch sm:justify-self-end h-10 px-6 font-semibold rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:bg-primary-300 disabled:cursor-not-allowed shadow-sm">
                        {isLoading ? 'Generating...' : 'New Deck'}
                    </button>
                </div>
            </div>

            <main className="flex-grow flex flex-col items-center justify-center py-6">
                {isLoading && <Spinner />}
                {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">{error}</p>}
                <div 
                    className="w-full max-w-md h-96 flex justify-center items-center"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {!isLoading && !error && cards.length > 0 && currentCard ? (
                        <div
                            style={{ transform: `translateX(${swipeOffset}px)` }}
                            // When swiping, we want instant transform. On release, we want a smooth transition back.
                            className={`w-full transition-transform ${isSwiping ? '' : 'duration-300'} ease-out`}
                        >
                            <Flashcard 
                                cardData={currentCard} 
                                isFlipped={isFlipped}
                                onFlip={handleFlip}
                                sourceLangName={sourceLang.name}
                                targetLangName={targetLang.name}
                            />
                        </div>
                    ) : (
                        !isLoading && !error && (
                             <div className="text-center text-gray-500">
                                <p>Welcome! Select your preferences and click 'New Deck' to start.</p>
                            </div>
                        )
                    )}
                </div>
            </main>

            <footer className="sticky bottom-0 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm py-4">
                <div className="w-full max-w-md mx-auto flex items-center justify-between">
                    <button onClick={handlePrev} disabled={currentIndex === 0 || isLoading} className="p-3 rounded-full bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        {cards.length > 0 ? `${currentIndex + 1} / ${cards.length}` : '0 / 0'}
                    </div>
                    <button onClick={handleNext} disabled={currentIndex === cards.length - 1 || isLoading} className="p-3 rounded-full bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default App;
