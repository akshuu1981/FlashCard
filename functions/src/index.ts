import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import * as cors from "cors";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Initialize Gemini AI
// FIX: The API key must be obtained from process.env.API_KEY as per the guidelines.
// The API key is sourced from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Types (should be kept in sync with frontend/types.ts)
type Difficulty = "Beginner" | "Intermediate" | "Expert";
type GrammaticalType = "noun" | "verb" | "adjective" | "other";
interface FlashcardData {
  word: string;
  translation: string;
  type: GrammaticalType;
  sentence: string;
  image: string; // base64 data URL
}

const corsHandler = cors({ origin: true });


// Internal function to generate image from Gemini
const _generateImageFromAPI = async (promptWord: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
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
        return "no-image";
    } catch (error) {
        functions.logger.error("Error generating image:", error);
        return "no-image";
    }
};

// Internal function to generate flashcards from Gemini
const _generateFlashcardsFromAPI = async (
    sourceLang: string,
    targetLang: string,
    difficulty: Difficulty,
): Promise<FlashcardData[]> => {
    const prompt = `Generate 10 flashcards for a user learning ${targetLang} from ${sourceLang} at a ${difficulty} level. For each flashcard, provide the word in ${targetLang}, its ${sourceLang} translation, its grammatical type (noun, verb, or adjective), and a simple example sentence in ${targetLang} using the word. The output must be a JSON array of objects.`;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                word: { type: Type.STRING, description: `The word in ${targetLang}` },
                translation: { type: Type.STRING, description: `The ${sourceLang} translation of the word.` },
                type: { type: Type.STRING, description: "The grammatical type: \"noun\", \"verb\", or \"adjective\"." },
                sentence: { type: Type.STRING, description: `An example sentence in ${targetLang} using the word.` },
            },
            required: ["word", "translation", "type", "sentence"],
        },
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    const cardDescriptions = JSON.parse(response.text) as Omit<FlashcardData, "image">[];
    const imageGenerationPromises = cardDescriptions.map((card) => _generateImageFromAPI(card.word));
    const imageResults = await Promise.allSettled(imageGenerationPromises);

    return cardDescriptions.map((card, index) => {
        const imageResult = imageResults[index];
        return {
            ...card,
            type: card.type.toLowerCase() as GrammaticalType,
            image: imageResult.status === "fulfilled" ? imageResult.value : "no-image",
        };
    });
};


// FIX: Removed explicit type annotations to allow TypeScript to infer correct Express types from functions.https.onRequest
export const getFlashcardDeck = functions.https.onRequest((request, response) => {
    corsHandler(request, response, async () => {
        if (request.method !== "POST") {
            response.status(405).send("Method Not Allowed");
            return;
        }
        try {
            const { sourceLang, targetLang, difficulty } = request.body;
            if (!sourceLang || !targetLang || !difficulty) {
                response.status(400).send("Missing required parameters.");
                return;
            }

            const cacheKey = `deck_${sourceLang}_${targetLang}_${difficulty}`.replace(/\s+/g, "_");
            const docRef = db.collection("flashcardDecks").doc(cacheKey);
            const doc = await docRef.get();

            if (doc.exists) {
                functions.logger.info(`[CACHE HIT] Found deck for ${cacheKey}`);
                response.status(200).json(doc.data()?.cards);
                return;
            }

            functions.logger.info(`[CACHE MISS] No deck found for ${cacheKey}. Generating with Gemini...`);
            const newFlashcards = await _generateFlashcardsFromAPI(sourceLang, targetLang, difficulty);

            await docRef.set({ cards: newFlashcards, createdAt: new Date() });
            functions.logger.info(`[CACHE SET] Saved new deck for ${cacheKey} to Firestore.`);

            response.status(200).json(newFlashcards);
        } catch (error) {
            functions.logger.error("Error in getFlashcardDeck:", error);
            response.status(500).send("Internal Server Error while generating flashcards.");
        }
    });
});


// FIX: Removed explicit type annotations to allow TypeScript to infer correct Express types from functions.https.onRequest
export const getSpeechAudio = functions.https.onRequest((request, response) => {
    corsHandler(request, response, async () => {
        if (request.method !== "POST") {
            response.status(405).send("Method Not Allowed");
            return;
        }

        try {
            const { text } = request.body;
            if (!text) {
                response.status(400).send("Missing 'text' parameter.");
                return;
            }
            // Simple sanitization and hashing for a document ID
            const cacheKey = `audio_${text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100)}`;
            const docRef = db.collection("speechAudio").doc(cacheKey);
            const doc = await docRef.get();

            if (doc.exists) {
                functions.logger.info(`[CACHE HIT] Found audio for "${text}"`);
                response.status(200).json({ audioContent: doc.data()?.audioContent });
                return;
            }

            functions.logger.info(`[CACHE MISS] No audio found for "${text}". Generating with Gemini...`);

            const ttsResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Kore" },
                        },
                    },
                },
            });

            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) {
                throw new Error("No audio data received from Gemini API.");
            }

            await docRef.set({ audioContent: base64Audio, createdAt: new Date() });
            functions.logger.info(`[CACHE SET] Saved new audio for "${text}" to Firestore.`);

            response.status(200).json({ audioContent: base64Audio });
        } catch (error) {
            functions.logger.error("Error in getSpeechAudio:", error);
            response.status(500).send("Internal Server Error while generating speech.");
        }
    });
});