import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Dexie from 'dexie';
import { createEmptyCard } from 'ts-fsrs';
import { StudyDatabase } from '../src/lib/db';
import { restoreLessonDraft, saveLessonDraft } from '../src/lib/lesson-draft';
import { introduceCharacter } from '../src/lib/study';
import type { Character, LessonDraft } from '../src/lib/types';

const character: Character = { id: '一', pinyin: ['yī'], hanViet: ['nhất'], meaning: ['một'], strokes: 1, components: [], freq: 1, mnemonic: '', examples: [], source: [] };
const draft: LessonDraft = { id: '一', contentVersion: 'content-v1', updatedAt: 100, step: 1, mnemonic: 'Một nét ngang.', pinyin: 'yi1', hanViet: 'nhất', applied: false };
const writing = { character: '一', strokeCount: 1, totalMistakes: 0, usedHint: false, durationMs: 1000 };

test('Tải lại giữ câu trả lời/bước học, giữ kết quả viết hoàn tất và không cho bỏ qua bước còn sai', () => {
  assert.deepEqual(restoreLessonDraft(character, draft, 'content-v1'), { ...draft, writing: undefined });
  assert.equal(restoreLessonDraft(character, { ...draft, step: 2, writing }, 'content-v1')?.step, 3);
  assert.equal(restoreLessonDraft(character, { ...draft, step: 3, writing, applied: true }, 'content-v1')?.applied, true);
  assert.equal(restoreLessonDraft(character, { ...draft, step: 3, writing, pinyin: 'yi2' }, 'content-v1')?.step, 1);
  assert.equal(restoreLessonDraft(character, { ...draft, step: 3, writing: { ...writing, strokeCount: 2 } }, 'content-v1')?.step, 2);
  assert.equal(restoreLessonDraft(character, draft, 'content-v2'), undefined);
});

test('Lưu bài học xóa bản dở cùng transaction; autosave trễ không tạo lại bài đã hoàn thành', async () => {
  const database = new StudyDatabase(`draft-test:${crypto.randomUUID()}`);
  try {
    assert.equal(await saveLessonDraft(database, { ...draft, step: 3, writing, applied: true }), true);
    await introduceCharacter(character, draft.mnemonic, new Date(2026, 9, 12, 9), database, writing);
    assert.equal(await database.lessonDrafts.get(character.id), undefined);
    assert.equal(await saveLessonDraft(database, draft), false);
    assert.equal(await database.lessonDrafts.count(), 0);
    assert.equal(await database.learned.count(), 1);
    assert.equal(await database.reviews.count(), 1);
  } finally { await database.delete(); }
});

test('Nâng cấp IndexedDB v2 lên v3 giữ nguyên tiến độ và hàng đợi đồng bộ', async () => {
  const name = `migration-test:${crypto.randomUUID()}`;
  const previous = new Dexie(name);
  previous.version(2).stores({ cards: 'id, targetId, type, fsrsState.due, dirty', learned: 'id, introducedAt', reviews: 'id, cardId, reviewedAt, targetId, dirty', settings: 'id, dirty', syncMeta: 'id' });
  const now = new Date(2026, 9, 11, 9);
  await previous.table('learned').put({ id: '一', introducedAt: now, mnemonic: 'cũ', updatedAt: 100 });
  await previous.table('cards').put({ id: 'recognize:一', targetId: '一', type: 'recognize', introducedAt: now, mnemonic: 'cũ', fsrsState: createEmptyCard(now), dirty: 1, updatedAt: 100, revision: 'original' });
  previous.close();
  const database = new StudyDatabase(name);
  try {
    // Mở class mới phải thêm bảng bài dở mà không chạy lại quá trình chuẩn hóa v1/v2.
    await database.open();
    assert.equal((await database.learned.get('一'))?.mnemonic, 'cũ');
    const card = await database.cards.get('recognize:一');
    assert.equal(card?.revision, 'original');
    assert.equal(card?.dirty, 1);
    assert.equal(card?.fsrsState.due.getTime(), now.getTime());
    assert.equal(await saveLessonDraft(database, { ...draft, id: '二' }), true);
    assert.equal(await database.lessonDrafts.count(), 1);
  } finally { await database.delete(); }
});

test('Bài dở của các kho tài khoản được lưu riêng', async () => {
  const first = new StudyDatabase(`account-a:${crypto.randomUUID()}`);
  const second = new StudyDatabase(`account-b:${crypto.randomUUID()}`);
  try {
    await saveLessonDraft(first, draft);
    assert.equal((await first.lessonDrafts.get('一'))?.pinyin, 'yi1');
    assert.equal(await second.lessonDrafts.get('一'), undefined);
  } finally { await first.delete(); await second.delete(); }
});
