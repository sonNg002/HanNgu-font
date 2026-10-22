import type { HskLesson } from './hsk-content';
import { textbookComplete, type TextbookProgress } from './textbook';

export type CourseStatus = 'all' | 'new' | 'started' | 'complete';

function normalize(value: string) {
  // Bỏ dấu thanh để người học có thể gõ pinyin bằng bàn phím thông thường.
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

export function courseLessonMatches(number: number, content: HskLesson | undefined,
  progress: TextbookProgress | undefined, query: string, status: CourseStatus): boolean {
  const complete = textbookComplete(progress);
  const started = !!progress?.tasks.length;
  if (status === 'complete' && !complete || status === 'new' && started || status === 'started' && (!started || complete)) return false;
  const term = normalize(query);
  if (!term) return true;
  // Số bài khớp chính xác, tránh tìm bài 1 lại trả cả bài 10–19.
  if (/^\d+$/.test(term)) return number === Number(term);
  const text = [ `bai ${number}`, ...(content?.words.flatMap(word => [word.text, word.pinyin, word.meaning]) ?? []),
    ...(content?.grammar.flatMap(item => [item.pattern, item.meaning, item.example, item.pinyin, item.translation]) ?? []) ];
  return text.some(value => normalize(value).includes(term));
}
