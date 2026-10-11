import type { SyncFields } from './types';
import type { StudyDatabase } from './db';
import { decodeCard, decodeReview, encodeCard, encodeReview, encodeSettings,
  type RemoteCard, type RemoteReview, type RemoteSettings } from './sync-codec';
import { remoteWins } from './sync-state';

export const MAX_BATCH_OPERATIONS = 450;
export type SyncCollection = 'cards' | 'reviews';
export type SyncWrite = { collection: SyncCollection | 'settings'; id: string;
  data: RemoteCard | RemoteReview | RemoteSettings };
export interface RemotePage { documents: { id: string; data: RemoteCard | RemoteReview; serverUpdatedAt: number }[]; next?: unknown }
export interface SyncTransport {
  readPage(collection: SyncCollection, since: number, cursor?: unknown): Promise<RemotePage>;
  readSettings(): Promise<RemoteSettings | undefined>;
  commit(writes: SyncWrite[]): Promise<void>;
}
export interface SyncStatus { phase: 'idle' | 'syncing' | 'offline' | 'error'; pending: number; message?: string; lastSyncedAt?: number }

export class SyncService {
  private running?: Promise<void>;
  private stopped = false;
  constructor(private database: StudyDatabase, private transport: SyncTransport,
    private report: (status: SyncStatus) => void = () => {}, private online = () => navigator.onLine) {}

  async pending(): Promise<number> {
    const counts = await Promise.all([this.database.cards, this.database.reviews, this.database.settings]
      .map(table => table.where('dirty').equals(1).count()));
    return counts.reduce((total, count) => total + count, 0);
  }
  stop() { this.stopped = true; }
  sync(): Promise<void> {
    // Chống hai flush cùng lúc trong một tab; Web Locks bảo vệ thêm giữa các tab.
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    const run = () => this.perform();
    this.running = (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(`sync:${this.database.name}`, run) : run())
      .finally(() => { this.running = undefined; });
    return this.running;
  }
  private async perform() {
    if (this.stopped) return;
    if (!this.online()) { this.report({ phase: 'offline', pending: await this.pending() }); return; }
    this.report({ phase: 'syncing', pending: await this.pending() });
    try {
      // Pull trước push để LWW loại bỏ các thay đổi cũ khi thiết bị quay lại online.
      await this.pull('cards');
      await this.pull('reviews');
      const settings = await this.transport.readSettings();
      if (settings && !this.stopped) await this.database.transaction('rw', this.database.settings, async () => {
        const local = await this.database.settings.get('main');
        if (remoteWins(local, { ...settings, dirty: 0 })) await this.database.settings.put({ ...settings, dirty: 0 });
      });
      if (this.stopped) return;
      await this.push();
      if (this.stopped) return;
      const lastSyncedAt = Date.now();
      await this.database.syncMeta.put({ id: 'lastSyncedAt', value: lastSyncedAt });
      this.report({ phase: 'idle', pending: await this.pending(), lastSyncedAt });
    } catch (error) {
      // Không xóa dirty khi lỗi: refresh/trình duyệt đóng vẫn retry được từ IndexedDB.
      if (!this.stopped) this.report({ phase: this.online() ? 'error' : 'offline', pending: await this.pending(),
        message: error instanceof Error ? error.message : 'Đồng bộ thất bại.' });
    }
  }
  private async pull(collection: SyncCollection) {
    const checkpoint = `cursor:${collection}`;
    const since = (await this.database.syncMeta.get(checkpoint))?.value ?? 0;
    let highWater = since;
    let cursor: unknown;
    do {
      if (this.stopped) return;
      const page = await this.transport.readPage(collection, since, cursor);
      if (this.stopped) return;
      await this.database.transaction('rw', this.database.cards, this.database.learned,
        this.database.reviews, this.database.syncMeta, async () => {
        for (const remote of page.documents) {
          highWater = Math.max(highWater, remote.serverUpdatedAt);
          if (collection === 'cards') {
            const card = decodeCard(remote.data as RemoteCard);
            const local = await this.database.cards.get(card.id);
            if (!remoteWins(local, card)) continue;
            await this.database.cards.put(card);
            const learned = await this.database.learned.get(card.targetId);
            if (!learned || card.updatedAt >= learned.updatedAt) await this.database.learned.put({
              id: card.targetId, introducedAt: card.introducedAt, mnemonic: card.mnemonic, updatedAt: card.updatedAt,
            });
          } else {
            const review = decodeReview(remote.data as RemoteReview);
            // Log bất biến và ID ổn định: retry commit không tạo thống kê trùng.
            await this.database.reviews.put(review);
          }
        }
        // Chỉ cập nhật cursor cùng transaction đã lưu xong trang; lỗi trang sau có thể đọc lại.
        await this.database.syncMeta.put({ id: checkpoint, value: highWater });
      });
      cursor = page.next;
    } while (cursor);
  }
  private async push() {
    const cards = await this.database.cards.where('dirty').equals(1).toArray();
    const reviews = await this.database.reviews.where('dirty').equals(1).toArray();
    const settings = await this.database.settings.where('dirty').equals(1).toArray();
    const writes: SyncWrite[] = [
      ...cards.map(card => ({ collection: 'cards' as const, id: card.id, data: encodeCard(card) })),
      ...reviews.map(review => ({ collection: 'reviews' as const, id: review.id, data: encodeReview(review) })),
      ...settings.map(setting => ({ collection: 'settings' as const, id: 'main', data: encodeSettings(setting) })),
    ];
    for (let offset = 0; offset < writes.length; offset += MAX_BATCH_OPERATIONS) {
      if (this.stopped) return;
      const chunk = writes.slice(offset, offset + MAX_BATCH_OPERATIONS);
      await this.transport.commit(chunk);
      await this.acknowledge(chunk);
    }
  }
  async acknowledge(writes: SyncWrite[]) {
    await this.database.transaction('rw', this.database.cards, this.database.reviews, this.database.settings, async () => {
      for (const name of ['cards', 'reviews', 'settings'] as const) {
        const revisions = new Map(writes.filter(write => write.collection === name).map(write => [write.id, write.data.revision]));
        if (!revisions.size) continue;
        // Một lượt modify mỗi bảng; transaction vẫn bảo vệ chấm tiếp và chỉ ack đúng revision.
        await this.database.table<SyncFields & { id: string }, string>(name).where('id').anyOf([...revisions.keys()]).modify(current => {
          if (current.revision === revisions.get(current.id)) current.dirty = 0;
        });
      }
    });
  }
}