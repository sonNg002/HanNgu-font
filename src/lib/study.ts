import { validateWriting, type WritingAssessment, type WritingResult } from './writing';
import { createEmptyCard, fsrs, type Grade } from 'ts-fsrs';
import { db, DEFAULT_SETTINGS, type StudyDatabase } from './db';
import { CARD_TYPES, isActiveCardType, type Character, type RatingValue, type Settings, type StudyCard } from './types';
import { startOfDay } from './time';
import { changed } from './sync-state';

// Tắt fuzz để khoảng hẹn hiển thị trùng với lịch lưu trong IndexedDB.
export const scheduler = fsrs({ enable_fuzz: false });
export function orderedCharacters(characters: Character[], order: Settings['order']): Character[] {
  return [...characters].sort((a, b) =>
    (order === 'hsk' ? (a.hsk ?? 99) - (b.hsk ?? 99) : 0) || a.freq - b.freq || a.id.localeCompare(b.id));
}
export function dueCards(cards: StudyCard[], now = new Date()): StudyCard[] {
  return cards.filter(card => isActiveCardType(card.type) && card.fsrsState.due.getTime() <= now.getTime()).sort((a, b) =>
    Number(a.fsrsState.reps === 0) - Number(b.fsrsState.reps === 0) ||
    a.fsrsState.due.getTime() - b.fsrsState.due.getTime() || a.id.localeCompare(b.id));
}
export function writingRating(mistakes: number, usedHint = false): RatingValue {
  if (!Number.isInteger(mistakes) || mistakes < 0) throw new Error('Số lần sai không hợp lệ.');
  const rating = mistakes === 0 ? 4 : mistakes <= 2 ? 3 : mistakes <= 5 ? 2 : 1;
  // Xem gợi ý trong bài kiểm tra cần ôn lại sớm, không được tự tính như nhớ hoàn toàn.
  return (usedHint ? Math.min(2, rating) : rating) as RatingValue;
}
export async function introduceCharacter(character: Character, mnemonic: string, now = new Date(), database: StudyDatabase = db, writing?: WritingResult) {
  if (mnemonic.length > 2000) throw new Error('Mẹo nhớ tối đa 2000 ký tự.');
  if (writing) {
    validateWriting(writing);
    if (writing.character !== character.id || writing.strokeCount !== character.strokes
      || !Number.isFinite(writing.durationMs) || writing.durationMs < 0) throw new Error('Kết quả không khớp chữ đang học.');
  }
  // Một transaction kiểm hạn mức và tạo đủ các kỹ năng, kể cả khi hai tab cùng thao tác.
  await database.transaction('rw', database.cards, database.learned, database.settings, database.reviews, database.lessonDrafts, async () => {
    if (await database.learned.get(character.id)) throw new Error('Chữ này đã có trong bộ học.');
    const settings = await database.settings.get('main') ?? DEFAULT_SETTINGS;
    if (await database.learned.where('introducedAt').aboveOrEqual(startOfDay(now)).count() >= settings.newPerDay) {
      throw new Error('Bạn đã đạt mục tiêu chữ mới hôm nay.');
    }
    // Thẻ ôn được giữ nguyên lịch, nhưng không chặn học tiếp chữ khác trong bộ hôm nay.
    // Giao diện cho học viên mở phiên ôn riêng thay vì ép tự chấm ngay sau mỗi bài viết.
    const sync = changed(undefined, now.getTime());
    await database.learned.add({ id: character.id, introducedAt: now, mnemonic: mnemonic.trim(), updatedAt: sync.updatedAt });
    const cards = CARD_TYPES.map(type => ({
      id: `${type}:${character.id}`, targetId: character.id, type, fsrsState: createEmptyCard(now),
      mnemonic: mnemonic.trim(), introducedAt: now, ...sync,
    }));
    if (writing) {
      // Bài tự viết lúc học chữ mới cũng là lần ôn đầu: lưu cùng transaction, không bắt viết lại ngay.
      const card = cards.find(entry => entry.type === 'write')!;
      const rating = writingRating(writing.totalMistakes, writing.usedHint);
      const result = scheduler.next(card.fsrsState, now, rating);
      card.fsrsState = result.card;
      await database.reviews.add({
        id: crypto.randomUUID(), cardId: card.id, targetId: character.id, type: 'write', rating,
        reviewedAt: now, durationMs: Math.round(writing.durationMs), fsrsLog: result.log, ...changed(undefined, now.getTime()),
        writing: { strokeCount: writing.strokeCount, totalMistakes: writing.totalMistakes, usedHint: writing.usedHint },
      });
    }
    await database.cards.bulkAdd(cards);
    // Xóa bài dở trong cùng commit, tránh tải lại rồi thấy bài đã học vẫn hiện như chưa hoàn thành.
    await database.lessonDrafts.delete(character.id);
  });
}
export async function gradeCard(
  cardId: string, rating: RatingValue, durationMs: number, attemptId: string, expectedReps: number,
  now = new Date(), database: StudyDatabase = db, writing?: WritingAssessment,
) {
  if (![1, 2, 3, 4].includes(rating) || !Number.isFinite(durationMs)) throw new Error('Điểm hoặc thời gian ôn không hợp lệ.');
  if (writing) validateWriting(writing);
  // ID lần chấm là khóa idempotency: retry/click kép không tăng reps hai lần.
  await database.transaction('rw', database.cards, database.reviews, async () => {
    if (await database.reviews.get(attemptId)) return;
    const card = await database.cards.get(cardId);
    if (!card) throw new Error('Không tìm thấy thẻ.');
    if (writing && (card.type !== 'write' || rating !== writingRating(writing.totalMistakes, writing.usedHint))) {
      throw new Error('Điểm ôn không khớp kết quả viết.');
    }
    if (card.fsrsState.reps !== expectedReps) throw new Error('Thẻ đã thay đổi ở tab khác. Hãy mở lại phiên ôn.');
    if (card.fsrsState.due > now) throw new Error('Thẻ này chưa đến hạn.');
    const result = scheduler.next(card.fsrsState, now, rating as Grade);
    await database.cards.put({ ...card, fsrsState: result.card, ...changed(card, now.getTime()) });
    await database.reviews.add({
      id: attemptId, cardId, targetId: card.targetId, type: card.type, rating,
      reviewedAt: now, durationMs: Math.max(0, Math.round(durationMs)), fsrsLog: result.log,
      ...changed(undefined, now.getTime()), ...(writing ? { writing } : {}),
    });
  });
}
export async function saveSettings(newPerDay: number, order: Settings['order'], database: StudyDatabase = db) {
  if (!Number.isInteger(newPerDay) || newPerDay < 1 || newPerDay > 50 || !['hsk', 'freq'].includes(order)) {
    throw new Error('Mục tiêu cần là số nguyên từ 1 đến 50.');
  }
  await database.transaction('rw', database.settings, async () => {
    const previous = await database.settings.get('main');
    await database.settings.put({ id: 'main', newPerDay, order, ...changed(previous) });
  });
}
export async function saveMnemonic(targetId: string, mnemonic: string, database: StudyDatabase = db) {
  if (mnemonic.length > 2000) throw new Error('Mẹo nhớ tối đa 2000 ký tự.');
  // Nhúng mẹo nhớ vào các thẻ để thiết bị mới khôi phục được cả learned lẫn mnemonic.
  await database.transaction('rw', database.cards, database.learned, async () => {
    const cards = await database.cards.where('targetId').equals(targetId).toArray();
    if (!cards.length) throw new Error('Chữ chưa có trong bộ học.');
    const updatedAt = Math.max(Date.now(), ...cards.map(card => card.updatedAt + 1));
    for (const card of cards) await database.cards.put({ ...card, mnemonic: mnemonic.trim(), ...changed(card, updatedAt) });
    await database.learned.update(targetId, { mnemonic: mnemonic.trim(), updatedAt });
  });
}
