import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyCard } from 'ts-fsrs';
import { StudyDatabase } from '../src/lib/db';
import { MAX_BATCH_OPERATIONS, SyncService, type RemotePage, type SyncCollection, type SyncStatus, type SyncTransport, type SyncWrite } from '../src/lib/sync';
import { encodeCard, type RemoteCard, type RemoteReview, type RemoteSettings } from '../src/lib/sync-codec';
import type { StudyCard } from '../src/lib/types';

const card = (targetId: string, updatedAt: number, revision = `rev-${targetId}-${updatedAt}`, dirty: 0 | 1 = 1): StudyCard => ({
  id: `write:${targetId}`, targetId, type: 'write', fsrsState: createEmptyCard(new Date(0)),
  mnemonic: `nhớ ${targetId}`, introducedAt: new Date(500), updatedAt, revision, dirty,
});

// Server giả giữ thứ tự serverUpdatedAt + id và cursor giống API thật, trang nhỏ để kiểm tra phân trang.
class FakeServer implements SyncTransport {
  docs: Record<SyncCollection, Map<string, { data: RemoteCard | RemoteReview; serverUpdatedAt: number }>> = { cards: new Map(), reviews: new Map() };
  settings?: RemoteSettings;
  commits: SyncWrite[][] = [];
  clock = 10_000;
  pageSize = 2;
  failCommit?: Error;
  beforeCommit?: () => Promise<void>;
  async readPage(collection: SyncCollection, since: number, cursor?: unknown): Promise<RemotePage> {
    const sorted = [...this.docs[collection]].map(([id, entry]) => ({ id, ...entry }))
      .filter(entry => entry.serverUpdatedAt >= since)
      .sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt || a.id.localeCompare(b.id));
    const start = cursor ? sorted.findIndex(entry => entry.id === (cursor as { id: string }).id) + 1 : 0;
    const documents = sorted.slice(start, start + this.pageSize);
    const last = documents.at(-1);
    return { documents, ...(last && documents.length === this.pageSize ? { next: { id: last.id, timestamp: String(last.serverUpdatedAt) } } : {}) };
  }
  async readSettings() { return this.settings; }
  async commit(writes: SyncWrite[]) {
    await this.beforeCommit?.();
    if (this.failCommit) throw this.failCommit;
    this.commits.push(writes);
    const serverUpdatedAt = ++this.clock;
    for (const write of writes) {
      if (write.collection === 'settings') this.settings = write.data as RemoteSettings;
      else this.docs[write.collection].set(write.id, { data: write.data as RemoteCard | RemoteReview, serverUpdatedAt });
    }
  }
}

async function withDatabase(run: (database: StudyDatabase) => Promise<void>) {
  const database = new StudyDatabase(`test-sync:${crypto.randomUUID()}`);
  try { await run(database); } finally { await database.delete(); }
}
const service = (database: StudyDatabase, server: SyncTransport, statuses: SyncStatus[] = [], online = () => true) =>
  new SyncService(database, server, status => statuses.push(status), online);

test('Push gửi thẻ, log và settings dirty; ack xong thì hết pending và lưu mốc đồng bộ', async () => withDatabase(async database => {
  const server = new FakeServer();
  const statuses: SyncStatus[] = [];
  await database.cards.put(card('一', 1000));
  await database.settings.put({ id: 'main', newPerDay: 8, order: 'freq', updatedAt: 1000, revision: 'settings-1', dirty: 1 });
  await service(database, server, statuses).sync();
  assert.equal(server.commits.length, 1);
  assert.deepEqual(server.commits[0].map(write => write.collection).sort(), ['cards', 'settings']);
  assert.equal(await service(database, server).pending(), 0);
  assert.equal(server.settings?.newPerDay, 8);
  assert.equal(statuses.at(-1)?.phase, 'idle');
  assert.ok((await database.syncMeta.get('lastSyncedAt'))?.value);
}));

test('Ack chỉ xóa dirty đúng revision đã gửi; sửa trong lúc commit vẫn chờ lượt sau', async () => withDatabase(async database => {
  const server = new FakeServer();
  await database.cards.put(card('一', 1000, 'sent'));
  server.beforeCommit = async () => { await database.cards.put(card('一', 1001, 'edited-during-commit')); };
  await service(database, server).sync();
  const local = await database.cards.get('write:一');
  assert.equal(local?.revision, 'edited-during-commit');
  assert.equal(local?.dirty, 1);
  server.beforeCommit = undefined;
  await service(database, server).sync();
  assert.equal((await database.cards.get('write:一'))?.dirty, 0);
  assert.equal(server.docs.cards.get('write:一')?.data.revision, 'edited-during-commit');
}));

test('Batch lớn chia thành nhiều commit, mỗi commit không vượt giới hạn API', async () => withDatabase(async database => {
  const server = new FakeServer();
  await database.cards.bulkPut(Array.from({ length: MAX_BATCH_OPERATIONS + 5 }, (_, index) => card(`字${index}`, 1000)));
  await service(database, server).sync();
  assert.deepEqual(server.commits.map(writes => writes.length), [MAX_BATCH_OPERATIONS, 5]);
  assert.equal(await service(database, server).pending(), 0);
}));

test('Pull đọc hết các trang, tạo chữ đã học và lưu cursor; lần sau không đọc lại từ đầu', async () => withDatabase(async database => {
  const server = new FakeServer();
  for (const [index, id] of ['一', '二', '三', '四', '五'].entries()) {
    server.docs.cards.set(`write:${id}`, { data: encodeCard(card(id, 1000 + index, `remote-${id}`, 0)), serverUpdatedAt: 2000 + index });
  }
  await service(database, server).sync();
  assert.equal(await database.cards.count(), 5);
  assert.deepEqual((await database.learned.toArray()).map(row => row.id).sort(), ['一', '三', '二', '五', '四']);
  assert.equal((await database.learned.get('一'))?.mnemonic, 'nhớ 一');
  assert.ok((await database.cards.get('write:一'))?.fsrsState.due instanceof Date);
  assert.equal((await database.syncMeta.get('cursor:cards'))?.value, 2004);
  const reads: number[] = [];
  const read = server.readPage.bind(server);
  server.readPage = async (collection, since, cursor) => { if (collection === 'cards') reads.push(since); return read(collection, since, cursor); };
  await service(database, server).sync();
  assert.deepEqual(reads, [2004]);
}));

test('LWW: bản local mới hơn không bị bản server cũ ghi đè; bản server mới hơn thắng', async () => withDatabase(async database => {
  const server = new FakeServer();
  await database.cards.put(card('一', 5000, 'local-newer'));
  await database.cards.put(card('二', 1000, 'local-older'));
  server.docs.cards.set('write:一', { data: encodeCard(card('一', 4000, 'remote-older', 0)), serverUpdatedAt: 2000 });
  server.docs.cards.set('write:二', { data: encodeCard(card('二', 3000, 'remote-newer', 0)), serverUpdatedAt: 2001 });
  await service(database, server).sync();
  assert.equal((await database.cards.get('write:一'))?.revision, 'local-newer');
  assert.equal(server.docs.cards.get('write:一')?.data.revision, 'local-newer');
  const second = await database.cards.get('write:二');
  assert.equal(second?.revision, 'remote-newer');
  assert.equal(second?.dirty, 0);
  assert.ok(!server.commits.flat().some(write => write.id === 'write:二'));
}));

test('Settings từ server chỉ thay bản local khi mới hơn', async () => withDatabase(async database => {
  const server = new FakeServer();
  server.settings = { id: 'main', newPerDay: 12, order: 'freq', updatedAt: 3000, revision: 'remote' };
  await database.settings.put({ id: 'main', newPerDay: 5, order: 'hsk', updatedAt: 1000, revision: 'local', dirty: 0 });
  await service(database, server).sync();
  assert.equal((await database.settings.get('main'))?.newPerDay, 12);
  await database.settings.put({ id: 'main', newPerDay: 3, order: 'hsk', updatedAt: 9000, revision: 'local-new', dirty: 1 });
  await service(database, server).sync();
  assert.equal((await database.settings.get('main'))?.newPerDay, 3);
  assert.equal(server.settings?.revision, 'local-new');
}));

test('Lỗi commit giữ hàng đợi và báo lỗi; offline không gọi API', async () => withDatabase(async database => {
  const server = new FakeServer();
  const statuses: SyncStatus[] = [];
  await database.cards.put(card('一', 1000));
  server.failCommit = new Error('API tạm lỗi');
  await service(database, server, statuses).sync();
  assert.equal((await database.cards.get('write:一'))?.dirty, 1);
  assert.deepEqual(statuses.at(-1), { phase: 'error', pending: 1, message: 'API tạm lỗi' });
  let called = false;
  server.readPage = async () => { called = true; return { documents: [] }; };
  await service(database, server, statuses, () => false).sync();
  assert.equal(called, false);
  assert.deepEqual(statuses.at(-1), { phase: 'offline', pending: 1 });
}));

test('Sync chạy đồng thời trong một tab dùng chung một lượt; stop chặn lượt mới', async () => withDatabase(async database => {
  const server = new FakeServer();
  let reads = 0;
  const read = server.readPage.bind(server);
  server.readPage = async (collection, since, cursor) => { reads++; return read(collection, since, cursor); };
  const sync = service(database, server);
  await Promise.all([sync.sync(), sync.sync()]);
  assert.equal(reads, 2);
  sync.stop();
  await sync.sync();
  assert.equal(reads, 2);
}));
