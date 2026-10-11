import type { SyncFields } from './types';

// Mốc tăng đơn điệu và revision giúp ack không xóa dirty của bản vừa sửa trong lúc gửi.
export function changed(previous?: SyncFields, now = Date.now()): SyncFields {
  return { updatedAt: Math.max(now, (previous?.updatedAt ?? 0) + 1), revision: crypto.randomUUID(), dirty: 1 };
}
// Khi bằng thời gian, bản server thắng theo thứ tự commit đã được server quyết định.
export function remoteWins(local: SyncFields | undefined, remote: SyncFields): boolean {
  return !local || remote.updatedAt >= local.updatedAt;
}