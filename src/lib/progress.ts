import { CARD_TYPES, type CardType, type LearnedCharacter, type ReviewLog, type StudyCard } from './types';
import { dayKey, startOfDay } from './time';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const RETENTION_WINDOW_DAYS = 90;
// Dưới 12 giờ là trí nhớ trong phiên (gồm bài viết lúc học), không đo khả năng nhớ lâu.
export const MIN_RECALL_GAP_MS = 12 * HOUR;
// Ổn định FSRS từ 21 ngày ở cả ba kỹ năng mới tính là chữ đã vững.
export const MATURE_STABILITY_DAYS = 21;

export type IntervalBucket = 'day' | 'week' | 'month';
export const INTERVAL_LABELS: Record<IntervalBucket, string> = { day: 'Sau khoảng 1 ngày', week: 'Sau khoảng 1 tuần', month: 'Sau khoảng 1 tháng' };
export interface Retention { recalled: number; total: number }
export interface DayActivity { day: Date; reviews: number; introduced: number }
export interface DueForecast { day: Date; cards: number }
export interface HardCharacter { id: string; forgotten: number; reviews: number }
export interface ProgressSummary {
  streak: { current: number; longest: number; activeToday: boolean };
  retention: Retention;
  byInterval: Record<IntervalBucket, Retention>;
  bySkill: Record<CardType, Retention>;
  learned: number; mature: number;
  activity: DayActivity[];
  forecast: DueForecast[];
  hard: HardCharacter[];
}

const empty = (): Retention => ({ recalled: 0, total: 0 });
export const rate = ({ recalled, total }: Retention) => total ? recalled / total : undefined;
function addDays(date: Date, days: number) {
  // Cộng theo ngày lịch để không lệch khi đổi giờ mùa hè ở thiết bị ngoài Việt Nam.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function bucket(gapMs: number): IntervalBucket {
  return gapMs < 3 * DAY ? 'day' : gapMs < 21 * DAY ? 'week' : 'month';
}

export function summarizeProgress({ cards, reviews, learned, now = new Date(), activityDays = 30, forecastDays = 7 }: {
  cards: StudyCard[]; reviews: ReviewLog[]; learned: LearnedCharacter[]; now?: Date; activityDays?: number; forecastDays?: number;
}): ProgressSummary {
  const today = startOfDay(now);
  const windowStart = addDays(today, -(RETENTION_WINDOW_DAYS - 1)).getTime();
  const introducedAt = new Map(learned.map(entry => [entry.id, entry.introducedAt.getTime()]));
  const lastSeen = new Map<string, number>();
  const retention = empty();
  const byInterval: Record<IntervalBucket, Retention> = { day: empty(), week: empty(), month: empty() };
  const bySkill = Object.fromEntries(CARD_TYPES.map(type => [type, empty()])) as Record<CardType, Retention>;
  const hard = new Map<string, HardCharacter>();
  // Khoảng cách tính từ lần gặp trước của cùng thẻ; lần đầu tính từ lúc học chữ.
  for (const review of [...reviews].sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime() || a.id.localeCompare(b.id))) {
    const at = review.reviewedAt.getTime();
    const previous = lastSeen.get(review.cardId) ?? introducedAt.get(review.targetId);
    lastSeen.set(review.cardId, at);
    if (previous === undefined || at - previous < MIN_RECALL_GAP_MS || at < windowStart || at > now.getTime()) continue;
    const recalled = review.rating > 1 ? 1 : 0;
    for (const target of [retention, byInterval[bucket(at - previous)], bySkill[review.type]]) { target.total++; target.recalled += recalled; }
    const entry = hard.get(review.targetId) ?? { id: review.targetId, forgotten: 0, reviews: 0 };
    entry.reviews++; entry.forgotten += 1 - recalled;
    hard.set(review.targetId, entry);
  }

  const active = new Set([...reviews.map(review => dayKey(review.reviewedAt)), ...learned.map(entry => dayKey(entry.introducedAt))]);
  const activeToday = active.has(dayKey(today));
  // Chưa học hôm nay thì chuỗi vẫn giữ đến hết ngày, tính từ hôm qua.
  let current = 0;
  for (let day = activeToday ? today : addDays(today, -1); active.has(dayKey(day)); day = addDays(day, -1)) current++;
  let longest = 0;
  let run = 0;
  let previousDay: string | undefined;
  for (const key of [...active].sort()) {
    const [year, month, date] = key.split('-').map(Number);
    run = previousDay === dayKey(addDays(new Date(year, month - 1, date), -1)) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previousDay = key;
  }

  const activity = Array.from({ length: activityDays }, (_, index) => ({ day: addDays(today, index - activityDays + 1), reviews: 0, introduced: 0 }));
  const activityIndex = new Map(activity.map((entry, index) => [dayKey(entry.day), index]));
  for (const review of reviews) { const index = activityIndex.get(dayKey(review.reviewedAt)); if (index !== undefined) activity[index].reviews++; }
  for (const entry of learned) { const index = activityIndex.get(dayKey(entry.introducedAt)); if (index !== undefined) activity[index].introduced++; }

  // Thẻ quá hạn được tính vào hôm nay vì học viên cần ôn chúng ngay.
  const forecast = Array.from({ length: forecastDays }, (_, index) => ({ day: addDays(today, index), cards: 0 }));
  for (const card of cards) {
    const offset = Math.max(0, Math.round((startOfDay(card.fsrsState.due).getTime() - today.getTime()) / DAY));
    if (offset < forecastDays) forecast[offset].cards++;
  }

  const skills = new Map<string, StudyCard[]>();
  for (const card of cards) skills.set(card.targetId, [...skills.get(card.targetId) ?? [], card]);
  const mature = learned.filter(entry => {
    const owned = skills.get(entry.id) ?? [];
    return owned.length === CARD_TYPES.length && owned.every(card => card.fsrsState.stability >= MATURE_STABILITY_DAYS);
  }).length;

  return {
    streak: { current, longest, activeToday }, retention, byInterval, bySkill, learned: learned.length, mature, activity, forecast,
    hard: [...hard.values()].filter(entry => entry.forgotten >= 2)
      .sort((a, b) => b.forgotten - a.forgotten || b.forgotten / b.reviews - a.forgotten / a.reviews || a.id.localeCompare(b.id)).slice(0, 6),
  };
}

// Mốc trục tròn 1/2/5 × 10^k để cột cao nhất không chạm đỉnh và nhãn dễ đọc.
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find(step => step * power >= value) ?? 10) * power;
}
