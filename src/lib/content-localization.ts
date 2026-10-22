import type { Character } from './types';
import type { HskContent } from './hsk-content';
import reviewed from '../../data/vietnamese-reviewed.json';

export interface VietnameseTranslations { translations: Record<string, string> }

export function vietnameseMeaning(source: string, dictionary: VietnameseTranslations): string {
  if (!source.trim()) return source;
  const result = (reviewed as Record<string, string>)[source] ?? dictionary.translations[source];
  // Build dừng nếu thiếu bản dịch, không gắn nhãn tiếng Việt cho một nghĩa vẫn là tiếng Anh.
  if (!result?.trim()) throw new Error(`Thiếu bản dịch tiếng Việt: ${source}`);
  // Chuẩn hóa ký hiệu từ điển và thuật ngữ lượng từ; không sửa chữ Hán/pinyin tham chiếu.
  const labeled = result.replace(/\bCL:/g, 'Lượng từ: ')
    .replace(/đo (?:lường |các )?từ:/gi, 'lượng từ:');
  return /\bclassifier\b/i.test(source)
    ? labeled.replace(/bộ phân loại|người phân loại|phân loại/gi, 'lượng từ') : labeled;
}

export function localizeCharacter<T extends Character>(character: T, dictionary: VietnameseTranslations): T {
  // Giữ nguyên nghĩa tiếng Việt đã biên soạn, chữ Hán, pinyin và âm Hán Việt.
  if (character.meaningLanguage !== 'en') return character;
  return { ...character, meaning: character.meaning.map(value => vietnameseMeaning(value, dictionary)),
    meaningLanguage: 'vi', meaningTranslation: 'machine' };
}

export function localizeHsk<T extends HskContent>(content: T, dictionary: VietnameseTranslations): T {
  return { ...content, meaningLanguage: 'vi', translationStatus: 'machine', lessons: content.lessons.map(lesson => ({ ...lesson,
    words: lesson.words.map(word => ({ ...word, meaning: vietnameseMeaning(word.meaning, dictionary) })),
    grammar: lesson.grammar.map(grammar => ({ ...grammar, meaning: vietnameseMeaning(grammar.meaning, dictionary),
      translation: vietnameseMeaning(grammar.translation, dictionary) })),
  })) };
}
