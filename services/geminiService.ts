import { FlashcardData, Difficulty } from '../types';

// ======================================================================
// Note: This service now acts as a client to our own backend API,
// which is running as a Firebase Cloud Function. The actual calls to
// the Gemini API and the caching logic now live securely on the server.
// ======================================================================

/**
 * Fetches a deck of flashcards from our backend service.
 * The backend will either retrieve it from its Firestore cache or generate a new one.
 * @param sourceLang The source language name (e.g., "English").
 * @param targetLang The target language name (e.g., "French").
 * @param difficulty The selected difficulty level.
 * @returns A promise that resolves to an array of FlashcardData.
 */
export const generateFlashcards = async (
    sourceLang: string,
    targetLang: string,
    difficulty: Difficulty
): Promise<FlashcardData[]> => {
    console.log(`Requesting deck from backend: ${sourceLang} -> ${targetLang} (${difficulty})`);
    try {
        // The '/api/getFlashcardDeck' path is rewritten by firebase.json to the cloud function.
        const response = await fetch('/api/getFlashcardDeck', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourceLang, targetLang, difficulty }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch flashcards from server: ${response.status} ${errorBody}`);
        }
        
        const data = await response.json();
        console.log("Received deck from backend.");
        return data as FlashcardData[];

    } catch (error) {
        console.error("Error communicating with backend service:", error);
        throw new Error("Could not connect to the server to get flashcards. Please try again later.");
    }
};


/**
 * Fetches a base64 encoded audio string for a given text from our backend service.
 * The backend will either retrieve it from its Firestore cache or generate a new one.
 * @param text The text to be converted to speech.
 * @returns A promise that resolves to a base64 encoded audio string.
 */
export const generateSpeech = async (text: string): Promise<string> => {
    console.log(`Requesting audio for "${text}" from backend...`);
     try {
        // The '/api/getSpeechAudio' path is rewritten by firebase.json to the cloud function.
        const response = await fetch('/api/getSpeechAudio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch speech from server: ${response.status} ${errorBody}`);
        }

        const { audioContent } = await response.json();
        console.log(`Received audio for "${text}" from backend.`);
        return audioContent;

    } catch (error) {
        console.error("Error communicating with speech service:", error);
        throw new Error("Could not connect to the server to get audio.");
    }
};
