import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyCard } from 'ts-fsrs';
import { niceMax, rate, summarizeProgress } from '../src/lib/progress';
import type { CardType, LearnedCharacter, RatingValue, ReviewLog, StudyCard } from '../src/lib/types';

const now = new Date(2026, 9, 15, 20);
const at = (daysAgo: number, hour = 9) => new Date(2026, 9, 15 - daysAgo, hour);
const learned = (id: string, daysAgo: number): LearnedCharacter => ({ id, introducedAt: at(daysAgo), mnemonic: '', updatedAt: 0 });
let sequence = 0;
const review = (targetId: string, type: CardType, rating: RatingValue, reviewedAt: Date): ReviewLog => ({
  id: `review-${++sequence}`, cardId: `${type}:${targetId}`, targetId, type, rating, reviewedAt, durationMs: 1000,
  fsrsLog: {} as ReviewLog['fsrsLog'], updatedAt: 0, revision: 'r', dirty: 0,
});
const card = (targetId: string, type: CardType, due: Date, stability = 0): StudyCard => ({
  id: `${type}:${targetId}`, targetId, type, fsrsState: { ...createEmptyCard(due), stability }, mnemonic: '',
  introducedAt: at(10), updatedAt: 0, revision: 'r', dirty: 0,
});

test('Tỷ lệ nhớ bỏ lượt trong phiên học, chia theo khoảng cách từ lần gặp trước và theo kỹ năng', () => {
  const summary = summarizeProgress({ now, cards: [], learned: [learned('一', 40)], reviews: [
    review('一', 'write', 3, at(40, 9)), // Bài viết lúc học: cách 0 giờ, không tính.
    review('一', 'recognize', 3, at(39)), // 1 ngày sau khi học.
    review('一', 'recognize', 1, at(34)), // 5 ngày sau lần trước.
    review('一', 'recognize', 4, at(4)), // 30 ngày sau lần trước.
    review('一', 'recall-hv', 2, at(39)),
  ] });
  assert.deepEqual(summary.retention, { recalled: 3, total: 4 });
  assert.deepEqual(summary.byInterval, { day: { recalled: 2, total: 2 }, week: { recalled: 0, total: 1 }, month: { recalled: 1, total: 1 } });
  assert.deepEqual(summary.bySkill, { recognize: { recalled: 2, total: 3 }, write: { recalled: 0, total: 0 }, 'recall-hv': { recalled: 1, total: 1 } });
  assert.equal(rate(summary.retention), 0.75);
  assert.equal(rate(summary.bySkill.write), undefined);
});

test('Lượt ôn ngoài cửa sổ 90 ngày vẫn làm mốc khoảng cách nhưng không được tính tỷ lệ', () => {
  const summary = summarizeProgress({ now, cards: [], learned: [learned('一', 120)], reviews: [
    review('一', 'recognize', 1, at(110)), review('一', 'recognize', 3, at(80)),
  ] });
  assert.deepEqual(summary.retention, { recalled: 1, total: 1 });
  assert.deepEqual(summary.byInterval.month, { recalled: 1, total: 1 });
});

test('Chuỗi ngày học giữ đến hết hôm nay; chuỗi dài nhất tính cả học chữ mới và ôn tập', () => {
  const reviews = [at(1), at(2), at(3), at(10), at(11), at(12), at(13)].map(date => review('一', 'recognize', 3, date));
  const notYet = summarizeProgress({ now, cards: [], learned: [learned('一', 14)], reviews });
  assert.deepEqual(notYet.streak, { current: 3, longest: 5, activeToday: false });
  const today = summarizeProgress({ now, cards: [], learned: [learned('一', 14), learned('二', 0)], reviews });
  assert.deepEqual(today.streak, { current: 4, longest: 5, activeToday: true });
  assert.equal(summarizeProgress({ now, cards: [], learned: [], reviews: [review('一', 'recognize', 3, at(2))] }).streak.current, 0);
});

test('Hoạt động theo ngày và dự báo đến hạn; thẻ quá hạn tính vào hôm nay', () => {
  const summary = summarizeProgress({ now, activityDays: 3, forecastDays: 3, learned: [learned('一', 0), learned('二', 5)],
    reviews: [review('一', 'write', 3, at(0)), review('二', 'recognize', 3, at(1)), review('二', 'recognize', 3, at(1, 21))],
    cards: [card('一', 'recognize', at(3)), card('一', 'write', at(0, 23)), card('一', 'recall-hv', at(-2)), card('二', 'write', at(-5))] });
  assert.deepEqual(summary.activity.map(day => [day.day.getDate(), day.reviews, day.introduced]), [[13, 0, 0], [14, 2, 0], [15, 1, 1]]);
  assert.deepEqual(summary.forecast.map(day => [day.day.getDate(), day.cards]), [[15, 2], [16, 0], [17, 1]]);
});

test('Chữ vững cần đủ ba kỹ năng ổn định; chữ hay quên xếp theo số lần quên', () => {
  const summary = summarizeProgress({ now, learned: [learned('一', 60), learned('二', 60), learned('三', 60)],
    cards: [...(['recognize', 'write', 'recall-hv'] as const).map(type => card('一', type, at(-30), 30)),
      card('二', 'recognize', at(-30), 30), card('二', 'write', at(-30), 30), card('二', 'recall-hv', at(-3), 5)],
    reviews: [review('二', 'recognize', 1, at(50)), review('二', 'write', 1, at(45)), review('三', 'recognize', 1, at(50)),
      review('三', 'recognize', 1, at(40)), review('三', 'recognize', 1, at(30)), review('一', 'recognize', 1, at(50))] });
  assert.equal(summary.mature, 1);
  assert.equal(summary.learned, 3);
  assert.deepEqual(summary.hard.map(entry => [entry.id, entry.forgotten]), [['三', 3], ['二', 2]]);
});

test('Mốc trục tròn 1/2/5', () => {
  assert.deepEqual([0, 1, 3, 7, 12, 48, 101].map(niceMax), [1, 1, 5, 10, 20, 50, 200]);
});
