import type { StudyDatabase } from './db';
import { matchesPinyin } from './lesson';
import type { Character, LessonDraft } from './types';
import { validateWriting } from './writing';

export function restoreLessonDraft(character: Character, draft: LessonDraft | undefined, contentVersion: string): LessonDraft | undefined {
  if (!draft || draft.id !== character.id || draft.contentVersion !== contentVersion
    || !Number.isInteger(draft.step) || draft.step < 0 || draft.step > 3
    || typeof draft.mnemonic !== 'string' || draft.mnemonic.length > 2000
    || typeof draft.pinyin !== 'string') return undefined;
  // Bài dở cũ có thêm âm Hán Việt vẫn mở được; chỉ Pinyin quyết định đã nhớ âm.
  const recalled = matchesPinyin(draft.pinyin, character.pinyin);
  let writing = draft.writing;
  if (writing) {
    try {
      validateWriting(writing);
      if (writing.character !== character.id || writing.strokeCount !== character.strokes
        || !Number.isFinite(writing.durationMs) || writing.durationMs < 0) writing = undefined;
    } catch { writing = undefined; }
  }
  // Khôi phục ở bước còn hợp lệ; kết quả viết đã xong chuyển thẳng sang dùng từ, không bắt viết lại.
  const step = draft.step >= 2 && !recalled ? 1 : draft.step >= 2 && writing ? 3 : draft.step === 3 ? 2 : draft.step;
  return { ...draft, step, writing: recalled ? writing : undefined, applied: step === 3 && !!draft.applied };
}

export async function saveLessonDraft(database: StudyDatabase, draft: LessonDraft): Promise<boolean> {
  // Transaction kiểm tra chữ đã học để một autosave đang chờ không tạo lại bản dở sau khi lưu hoàn tất.
  return database.transaction('rw', database.learned, database.lessonDrafts, async () => {
    if (await database.learned.get(draft.id)) return false;
    await database.lessonDrafts.put(draft);
    return true;
  });
}
