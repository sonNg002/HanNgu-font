import Dexie, { type Table } from 'dexie';
import type { LearnedCharacter, LessonDraft, ReviewLog, Settings, StudyCard, SyncMeta } from './types';

export class StudyDatabase extends Dexie {
  cards!: Table<StudyCard, string>;
  learned!: Table<LearnedCharacter, string>;
  reviews!: Table<ReviewLog, string>;
  settings!: Table<Settings, string>;
  syncMeta!: Table<SyncMeta, string>;
  lessonDrafts!: Table<LessonDraft, string>;
  constructor(name = 'hanzi-learner') {
    super(name);
    this.version(1).stores({
      cards: 'id, targetId, type, fsrsState.due', learned: 'id, introducedAt',
      reviews: 'id, cardId, reviewedAt, targetId', settings: 'id',
    });
    // Giữ dữ liệu v1, đổi khóa thẻ sang type:targetId và bổ sung hàng đợi bền vững.
    this.version(2).stores({
      cards: 'id, targetId, type, fsrsState.due, dirty', learned: 'id, introducedAt',
      reviews: 'id, cardId, reviewedAt, targetId, dirty', settings: 'id, dirty', syncMeta: 'id',
    }).upgrade(async tx => {
      const learned = new Map((await tx.table('learned').toArray()).map(row => [row.id, row]));
      const cards = await tx.table('cards').toArray();
      await tx.table('cards').clear();
      for (const card of cards) {
        const entry = learned.get(card.targetId);
        await tx.table('cards').put({ ...card, id: `${card.type}:${card.targetId}`,
          introducedAt: entry?.introducedAt ?? new Date(), mnemonic: entry?.mnemonic ?? '',
          updatedAt: Date.now(), revision: crypto.randomUUID(), dirty: 1 });
      }
      await tx.table('learned').toCollection().modify(row => { row.updatedAt = Date.now(); });
      await tx.table('reviews').toCollection().modify(row => {
        row.cardId = `${row.type}:${row.targetId}`;
        Object.assign(row, { updatedAt: row.reviewedAt.getTime(), revision: row.id, dirty: 1 });
      });
      await tx.table('settings').toCollection().modify(row => {
        Object.assign(row, { updatedAt: Date.now(), revision: crypto.randomUUID(), dirty: 1 });
      });
    });
    // Chỉ thêm bảng bài dở; nâng cấp từ v2 giữ nguyên thẻ, lịch ôn và hàng đợi đồng bộ.
    this.version(3).stores({ lessonDrafts: 'id, updatedAt' });
  }
}
export const db = new StudyDatabase();
export const DEFAULT_SETTINGS: Settings = {
  id: 'main', newPerDay: 5, order: 'hsk', updatedAt: 0, revision: 'default', dirty: 0,
};
const databases = new Map<string, StudyDatabase>();
export function databaseForUser(uid: string | null): StudyDatabase {
  if (!uid) return db;
  // Không chuyển tiến độ khách tự động sang tài khoản: mỗi UID có kho riêng.
  const name = `hanzi-learner:user:${encodeURIComponent(uid)}`;
  if (!databases.has(name)) databases.set(name, new StudyDatabase(name));
  return databases.get(name)!;
}
