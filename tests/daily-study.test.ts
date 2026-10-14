import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyRecommendation, studyGroups } from '../src/lib/daily-study';
import type { Character, LearnedCharacter } from '../src/lib/types';

// Các chữ cùng nghĩa chủ đề nhưng khác bộ thủ bảo vệ việc phân biệt hai cách nhóm.
const characters = [...'一二三四五六七八九十日月明天山水火木林森'].map((id, index): Character => ({
  id, pinyin: [], hanViet: [], meaning: [], strokes: 1, components: [], hsk: 1,
  freq: index + 1, mnemonic: '', examples: [], source: [],
  radicalNumber: ['木', '林', '森'].includes(id) ? 75 : ['一', '三', '七'].includes(id) ? 1 : undefined,
  radical: ['木', '林', '森'].includes(id) ? '木' : ['一', '三', '七'].includes(id) ? '一' : undefined,
}));
const now = new Date(2026, 9, 12, 9);
const learned = (id: string, introducedAt: Date): LearnedCharacter => ({ id, introducedAt, mnemonic: '', updatedAt: introducedAt.getTime() });
const settings = { order: 'hsk' as const, newPerDay: 3 };

test('Đề xuất đúng số chữ cùng chủ đề hoặc bộ và ổn định sau khi học/lưu/tải lại trong ngày', () => {
  const before = [learned('一', new Date(2026, 9, 11))];
  const initial = dailyRecommendation(characters, before, settings, now);
  assert.equal(initial.characters.length, 3);
  assert.ok(!initial.characters.some(character => character.id === '一'));
  const source = studyGroups(characters, 'hsk').find(group => group.id === initial.id);
  assert.ok(source);
  assert.ok(initial.characters.every(character => source.characters.some(entry => entry.id === character.id)));
  // Chữ đã lưu hôm nay vẫn nằm trong preview, nhưng UI loại khỏi hàng đợi chữ mới.
  const progress = [...before, learned(initial.characters[0].id, now)];
  assert.deepEqual(dailyRecommendation(characters, progress, settings, new Date(2026, 9, 12, 23)), initial);
});

test('Ngày mới xoay nhóm đề xuất và loại chữ đã học ngày trước', () => {
  const initial = dailyRecommendation(characters, [], settings, now);
  const tomorrow = new Date(2026, 9, 13, 9);
  const progress = initial.characters.map(character => learned(character.id, now));
  const next = dailyRecommendation(characters, progress, settings, tomorrow);
  assert.notEqual(next.id, initial.id);
  assert.ok(next.characters.length > 0);
  assert.ok(next.characters.every(character => !progress.some(entry => entry.id === character.id)));
});

test('Cùng chủ đề không bị nhầm là cùng bộ; chữ mới theo thứ tự HSK/tần suất đã chọn', () => {
  const groups = studyGroups(characters, 'hsk');
  assert.equal(groups.find(group => group.id === 'topic:numbers')?.characters.length, 10);
  assert.deepEqual(groups.find(group => group.id === 'radical:75')?.characters.map(character => character.id), ['木', '林', '森']);
  const mixed = characters.map((character, index) => ({ ...character, hsk: index === 0 ? 2 : 1 }));
  assert.equal(studyGroups(mixed, 'freq').find(group => group.id === 'topic:numbers')?.characters[0].id, '一');
  assert.equal(studyGroups(mixed, 'hsk').find(group => group.id === 'topic:numbers')?.characters[0].id, '二');
});

test('Bộ ít chữ, chữ không có nhóm và từ điển đã học hết đều có kết quả hợp lệ', () => {
  assert.equal(dailyRecommendation(characters.slice(0, 2), [], { ...settings, newPerDay: 5 }, now).characters.length, 2);
  const ungrouped = { ...characters[0], id: '乙', radicalNumber: undefined, radical: undefined };
  assert.deepEqual(dailyRecommendation([ungrouped], [], settings, now).characters, [ungrouped]);
  assert.deepEqual(dailyRecommendation(characters, characters.map(character => learned(character.id, new Date(2026, 9, 11))), settings, now).characters, []);
});

test('Người mới ưu tiên chữ biên soạn có nghĩa Việt, không thêm chữ mở rộng chỉ để đủ số lượng', () => {
  const mixed = characters.map((character, index) => ({ ...character, readingSource: index < 2 ? 'curated' as const : 'unihan' as const }));
  const suggested = dailyRecommendation(mixed, [], { ...settings, newPerDay: 5 }, now);
  assert.equal(suggested.characters.length, 2);
  assert.ok(suggested.characters.every(character => character.readingSource === 'curated'));
  // Khi kho cơ bản đã học hết, đề xuất tiếp tục dùng chữ mở rộng thay vì tạo bộ trống.
  const progress = mixed.slice(0, 2).map(character => learned(character.id, new Date(2026, 9, 11)));
  const advanced = dailyRecommendation(mixed, progress, settings, now);
  assert.ok(advanced.characters.length > 0);
  assert.ok(advanced.characters.every(character => character.readingSource === 'unihan'));
});
