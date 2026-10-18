import type { StudyDatabase } from './db';

export const HSK_SERIES_SOURCE = 'https://www.blcup.com/EnSeriesBook/index/8';
// Metadata lộ trình tách khỏi nội dung sách: không suy ra từ vựng của một bài từ nhãn HSK trên chữ.
export const HSK_BOOKS = [
  { id: '1', level: 1, label: 'HSK 1', first: 1, count: 15, source: 'https://www.hskstandardcourse.com/hsk-standard-course-level-1/hsk-standard-course-1-textbook/' },
  { id: '2', level: 2, label: 'HSK 2', first: 1, count: 15, source: 'https://www.blcup.com/EnPInfo/index/75' },
  { id: '3', level: 3, label: 'HSK 3', first: 1, count: 20, source: 'https://www.hskstandardcourse.com/hsk-standard-course-level-3/hsk-standard-course-3-textbook/' },
  { id: '4a', level: 4, label: 'HSK 4 · Quyển A', first: 1, count: 10, source: 'https://www.blcup.com/EnPInfo/index/7663' },
  { id: '4b', level: 4, label: 'HSK 4 · Quyển B', first: 11, count: 10, source: HSK_SERIES_SOURCE },
  { id: '5a', level: 5, label: 'HSK 5 · Quyển A', first: 1, count: 18, source: 'https://www.blcup.com/EnPInfo/index/8078' },
  { id: '5b', level: 5, label: 'HSK 5 · Quyển B', first: 19, count: 18, source: 'https://www.blcup.com/EnPInfo/index/8212' },
  { id: '6a', level: 6, label: 'HSK 6 · Quyển A', first: 1, count: 20, source: 'https://www.blcup.com/EnPInfo/index/10584' },
  { id: '6b', level: 6, label: 'HSK 6 · Quyển B', first: 21, count: 20, source: HSK_SERIES_SOURCE },
] as const;
export type TextbookTask = 'listen' | 'recall' | 'practice' | 'review';
export const TEXTBOOK_TASKS: { id: TextbookTask; label: string }[] = [
  { id: 'listen', label: 'Đã nghe và đọc bài trong sách' },
  { id: 'recall', label: 'Đã tự nhớ lại từ vựng khi che đáp án' },
  { id: 'practice', label: 'Đã làm bài tập và tự đặt câu' },
  { id: 'review', label: 'Đã ôn lại bài ở một buổi sau' },
];
export interface TextbookProgress {
  id: string; bookId: string; lesson: number; tasks: TextbookTask[]; updatedAt: number;
}
export function textbookLessons(bookId: string) {
  const book = HSK_BOOKS.find(item => item.id === bookId);
  return book ? Array.from({ length: book.count }, (_, index) => ({ id: `standard:${book.id}:${book.first + index}`, number: book.first + index })) : [];
}
export function textbookComplete(progress?: TextbookProgress) {
  return TEXTBOOK_TASKS.every(task => progress?.tasks.includes(task.id));
}
export async function saveTextbookTask(database: StudyDatabase, bookId: string, lesson: number, task: TextbookTask, checked: boolean) {
  const found = textbookLessons(bookId).find(item => item.number === lesson);
  if (!found || !TEXTBOOK_TASKS.some(item => item.id === task) || typeof checked !== 'boolean') throw new Error('Bài học hoặc bước học không hợp lệ.');
  // Đọc-sửa-ghi nguyên tử để hai tab không ghi đè checklist; bảng thuộc DB riêng của từng tài khoản.
  await database.transaction('rw', database.textbookProgress, async () => {
    const old = await database.textbookProgress.get(found.id);
    const tasks = new Set(old?.tasks ?? []);
    if (checked) tasks.add(task); else tasks.delete(task);
    await database.textbookProgress.put({ id: found.id, bookId, lesson, tasks: [...tasks], updatedAt: Date.now() });
  });
}
