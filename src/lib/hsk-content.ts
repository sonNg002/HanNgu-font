import type { Character } from './types';
export interface HskWord { text: string; pinyin: string; meaning: string }
export interface HskGrammar { pattern: string; meaning: string; example: string; pinyin: string; translation: string }
export interface HskLesson { id: string; bookId: string; number: number; words: HskWord[]; grammar: HskGrammar[] }
export interface HskContent { source: string; license: string; lessons: HskLesson[]; meaningLanguage?: string; translationStatus?: 'machine' }
let loading: Promise<HskContent> | undefined;
export function loadHskContent(): Promise<HskContent> {
  // Một request dùng chung; lỗi xóa promise để nút thử lại có thể tải lại khi có mạng.
  return loading ??= fetch('/data/hsk-standard.json').then(async response => {
    if (!response.ok) throw new Error('Chưa tải được giáo trình. Hãy kết nối mạng và thử lại.');
    return await response.json() as HskContent;
  }).catch(error => { loading = undefined; throw error; });
}
export function hskCharacters(lesson: HskLesson, characters: Character[]) {
  const lookup = new Map(characters.map(character => [character.id, character]));
  // Từ ghép và một chữ là hai đối tượng khác nhau: chỉ tách chữ cho nút luyện viết bổ trợ.
  const ids = [...new Set(lesson.words.flatMap(word => [...word.text].filter(id => /\p{Script=Han}/u.test(id))))];
  return { characters: ids.flatMap(id => lookup.has(id) ? [lookup.get(id)!] : []), missing: ids.filter(id => !lookup.has(id)) };
}
