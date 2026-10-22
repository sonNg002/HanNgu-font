import type { WritingAssessment, WritingResult } from './writing';
import type { Card as FSRSCard, ReviewLog as FSRSLog } from 'ts-fsrs';

export type CardType = 'recognize' | 'write' | 'recall-hv';
export type RatingValue = 1 | 2 | 3 | 4;
export interface Example { text: string; translation: string; pinyin?: string; source: string }
export interface Character {
  id: string; pinyin: string[]; hanViet: string[]; meaning: string[];
  // Bộ thủ chính dùng để phân nhóm; biến thể giữ riêng để hiện đúng thành phần chữ.
strokes: number; radical?: string; radicalNumber?: number; radicalVariant?: string;
  readingSource?: 'curated' | 'unihan'; meaningLanguage?: 'vi' | 'en'; components: string[]; decomposition?: string; etymology?: string;
  meaningTranslation?: 'machine';
  hsk?: number; freq: number; mnemonic: string; examples: Example[]; source: string[];
}
export interface Word { id: string; simplified: string; pinyin: string; meaning: string[]; chars: string[] }
export interface Content { characters: Character[]; words: Word[]; version: string }
// dirty dùng số vì IndexedDB không lập index được trên boolean.
export interface SyncFields { updatedAt: number; revision: string; dirty: 0 | 1 }
export interface StudyCard extends SyncFields {
  id: string; targetId: string; type: CardType; fsrsState: FSRSCard;
  mnemonic: string; introducedAt: Date;
}
export interface LearnedCharacter { id: string; introducedAt: Date; mnemonic: string; updatedAt: number }
export interface ReviewLog extends SyncFields {
  id: string; cardId: string; targetId: string; type: CardType; rating: RatingValue;
  reviewedAt: Date; durationMs: number; fsrsLog: FSRSLog; writing?: WritingAssessment;
}
export interface Settings extends SyncFields { id: 'main'; newPerDay: number; order: 'hsk' | 'freq' }
export interface SyncMeta { id: string; value: number }
// Bài dở thuộc kho riêng trên thiết bị, không phải thẻ đã học hoặc dữ liệu đồng bộ.
export interface LessonDraft {
  id: string; contentVersion: string; updatedAt: number; step: 0 | 1 | 2 | 3;
  // hanViet chỉ còn ở bài dở cũ; bài học không hỏi âm Hán Việt nữa.
  mnemonic: string; pinyin: string; hanViet?: string; writing?: WritingResult; applied: boolean;
}
// 'recall-hv' giữ trong CardType để đọc và đồng bộ thẻ cũ, nhưng không tạo hoặc ôn nữa.
export const CARD_TYPES: CardType[] = ['recognize', 'write'];
export const isActiveCardType = (type: CardType) => CARD_TYPES.includes(type);
export const TYPE_LABELS: Record<CardType, string> = {
  recognize: 'Nhận mặt chữ', write: 'Tập viết', 'recall-hv': 'Nhớ Hán Việt',
};
