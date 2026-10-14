import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contextChoices, lessonExample, matchesHanViet, matchesPinyin } from '../src/lib/lesson';
import type { Character, Word } from '../src/lib/types';

const character = (id: string): Character => ({
  id, pinyin: ['míng'], hanViet: ['minh'], meaning: ['sáng'], strokes: 8,
  components: ['日', '月'], freq: 1, mnemonic: '', examples: [], source: [],
});

test('Pinyin nhận dấu/số thanh và Unicode; thanh sai hoặc bị bỏ phải bị từ chối', () => {
  // Những lỗi làm đổi cách đọc phải đi qua cùng hàm chấm mà form bài học sử dụng.
  for (const answer of ['míng', 'ming2', ' MING2 ', 'mi\u0301ng']) assert.ok(matchesPinyin(answer, ['míng']));
  for (const answer of ['ming', 'ming1', 'mìng', 'míng3', 'ming9', 'mííng', '']) assert.ok(!matchesPinyin(answer, ['míng']));
  assert.ok(matchesPinyin('shuǐ', ['shuǐ']));
  assert.ok(matchesPinyin('shui3', ['shuǐ']));
  assert.ok(!matchesPinyin('shui', ['shuǐ']));
});

test('Pinyin phân biệt ü/u, nhận v/u: và thanh nhẹ; chấp nhận cách đọc thay thế', () => {
  for (const answer of ['nǚ', 'nü3', 'nv3', 'nu:3']) assert.ok(matchesPinyin(answer, ['nǚ']));
  assert.ok(!matchesPinyin('nu3', ['nǚ']));
  for (const answer of ['ma', 'ma0', 'ma5']) assert.ok(matchesPinyin(answer, ['ma']));
  assert.ok(!matchesPinyin('ma4', ['ma']));
  assert.ok(matchesPinyin('yue4', ['lè', 'yuè']));
});

test('Hán Việt giữ dấu tiếng Việt, nhận khoảng trắng/hoa thường và các cách đọc trong kho', () => {
  assert.ok(matchesHanViet(' NHẬT ', ['nhật']));
  assert.ok(matchesHanViet('nhâ\u0301t', ['nhất']));
  assert.ok(matchesHanViet('lạc', ['nhạc', 'lạc']));
  assert.ok(matchesHanViet('thuỷ', ['thủy']));
  assert.ok(matchesHanViet('hoà', ['hòa']));
  assert.ok(!matchesHanViet('mọc', ['mộc']));
  assert.ok(!matchesHanViet('thúy', ['thủy']));
  assert.ok(!matchesHanViet('nhat', ['nhật']));
  assert.ok(!matchesHanViet('', ['nhật']));
});

test('Bài điền từ chỉ lấy ví dụ thật chứa chữ và có nghĩa; không tự bịa khi thiếu dữ liệu', () => {
  const target = character('明');
  const word: Word = { id: '明天', simplified: '明天', chars: ['明', '天'], pinyin: 'míng tiān', meaning: ['ngày mai'] };
  assert.deepEqual(lessonExample(target, [word]), { text: '明天', translation: 'ngày mai', pinyin: 'míng tiān', source: 'Từ điển của bộ học' });
  assert.equal(lessonExample(target, []), undefined);
  target.examples = [
    { text: '今天', translation: 'hôm nay', source: 'fixture' },
    { text: '明天见', translation: 'Hẹn gặp ngày mai', source: 'fixture' },
  ];
  assert.equal(lessonExample(target, [word])?.text, '明天见');
});

test('Lựa chọn điền từ có đáp án đúng đúng một lần, không lặp chữ và giữ ổn định', () => {
  const target = character('明');
  const peers = ['明', '日', '日', '月', '天'].map(character);
  const choices = contextChoices(target, peers);
  assert.equal(choices.length, 3);
  assert.equal(choices.filter(id => id === '明').length, 1);
  assert.equal(new Set(choices).size, 3);
  assert.deepEqual(contextChoices(target, peers), choices);
  assert.deepEqual(contextChoices(target, []), ['明']);
});
