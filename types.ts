
export type Difficulty = 'Beginner' | 'Intermediate' | 'Expert';

export interface Language {
  code: string;
  name: string;
}

export type GrammaticalType = 'noun' | 'verb' | 'adjective' | 'other';

export interface FlashcardData {
  word: string;
  translation: string;
  type: GrammaticalType;
  sentence: string;
  image: string; // base64 data URL or a placeholder string
}
