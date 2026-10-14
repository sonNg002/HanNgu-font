import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StudyDatabase } from '../src/lib/db';
import { dueCards, gradeCard, introduceCharacter } from '../src/lib/study';
import type { Character } from '../src/lib/types';

const character = (id: string): Character => ({
  id, pinyin: [], hanViet: [], meaning: [], strokes: 1, components: [],
  freq: 1, mnemonic: '', examples: [], source: [],
});
const now = new Date(2026, 9, 12, 9);
const writing = (id: string) => ({ character: id, strokeCount: 1, totalMistakes: 0, usedHint: false, durationMs: 1000 });

test('Lưu bài viết xong vẫn học được chữ tiếp theo dù có thẻ nhận mặt và Hán Việt đến hạn', async () => {
  // Dùng IndexedDB giả với Dexie thật để tái hiện đúng transaction và hàng đợi của ứng dụng.
  const database = new StudyDatabase(`test-study:${crypto.randomUUID()}`);
  try {
    await introduceCharacter(character('一'), '', now, database, writing('一'));
    const cards = await database.cards.toArray();
    assert.deepEqual(dueCards(cards, now).map(card => card.type).sort(), ['recall-hv', 'recognize']);
    assert.equal((await database.reviews.toArray())[0].type, 'write');
    await introduceCharacter(character('乙'), '', now, database, writing('乙'));
    assert.equal(await database.learned.count(), 2);
    assert.equal(await database.cards.count(), 6);
  } finally { await database.delete(); }
});

test('Học liên tục vẫn giữ hạn mức ngày, chống lưu trùng và không chấm viết hai lần', async () => {
  const database = new StudyDatabase(`test-study:${crypto.randomUUID()}`);
  try {
    // Mục tiêu một chữ giúp kiểm tra guard hạn mức vẫn hoạt động sau khi bỏ guard thẻ đến hạn.
    await database.settings.put({ id: 'main', newPerDay: 1, order: 'hsk', updatedAt: 0, revision: 'test', dirty: 0 });
    await introduceCharacter(character('一'), '', now, database, writing('一'));
    await assert.rejects(introduceCharacter(character('一'), '', now, database, writing('一')), /đã có/);
    await assert.rejects(introduceCharacter(character('乙'), '', now, database, writing('乙')), /mục tiêu/);
    assert.equal(await database.reviews.count(), 1);
    const card = await database.cards.get('recognize:一');
    assert.ok(card);
    const attempt = crypto.randomUUID();
    await gradeCard(card.id, 3, 1000, attempt, 0, now, database);
    await gradeCard(card.id, 3, 1000, attempt, 0, now, database);
    assert.equal((await database.cards.get(card.id))?.fsrsState.reps, 1);
    assert.equal(await database.reviews.count(), 2);
  } finally { await database.delete(); }
});
