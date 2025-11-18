import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FlashcardData, Difficulty, GrammaticalType } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateImage = async (promptWord: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `A clean, simple, icon-style image of a ${promptWord}` }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        return 'no-image'; // Return placeholder if no image data found
    } catch (error) {
        console.error("Error generating image:", error);
        return 'no-image'; // Return placeholder on error
    }
};


export const generateFlashcards = async (
    sourceLang: string,
    targetLang: string,
    difficulty: Difficulty
): Promise<FlashcardData[]> => {
    
    const prompt = `Generate 10 flashcards for a user learning ${targetLang} from ${sourceLang} at a ${difficulty} level. For each flashcard, provide the word in ${targetLang}, its ${sourceLang} translation, its grammatical type (noun, verb, or adjective), and a simple example sentence in ${targetLang} using the word. The output must be a JSON array of objects.`;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                word: { type: Type.STRING, description: `The word in ${targetLang}` },
                translation: { type: Type.STRING, description: `The English translation of the word.` },
                type: { type: Type.STRING, description: 'The grammatical type: "noun", "verb", or "adjective".' },
                sentence: { type: Type.STRING, description: `An example sentence in ${targetLang} using the word.` }
            },
            required: ['word', 'translation', 'type', 'sentence']
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const cardDescriptions = JSON.parse(response.text) as Omit<FlashcardData, 'image'>[];

        const imageGenerationPromises = cardDescriptions.map(card => generateImage(card.word));
        const imageResults = await Promise.allSettled(imageGenerationPromises);

        const flashcards: FlashcardData[] = cardDescriptions.map((card, index) => {
            const imageResult = imageResults[index];
            return {
                ...card,
                type: card.type.toLowerCase() as GrammaticalType,
                image: imageResult.status === 'fulfilled' ? imageResult.value : 'no-image',
            };
        });

        return flashcards;
    } catch (error) {
        console.error("Error generating flashcards:", error);
        throw new Error("Failed to generate flashcards. Please check your API key and try again.");
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate speech.");
    }
};
