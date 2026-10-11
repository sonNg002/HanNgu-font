import type { User } from 'firebase/auth';
import type { RemoteSettings } from './sync-codec';
import type { RemotePage, SyncCollection, SyncTransport, SyncWrite } from './sync';
import { ApiClient, ApiClientError } from './api/client';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function invalidResponse(): never {
  throw new ApiClientError('API trả về dữ liệu đồng bộ không hợp lệ.', 502, 'INVALID_RESPONSE');
}

export class ApiTransport implements SyncTransport {
  private client: ApiClient;
  constructor(private user: Pick<User, 'getIdToken'>, baseUrl: string,
    private fetcher: typeof fetch = fetch) {
    this.client = new ApiClient(baseUrl, { getToken: refresh => this.user.getIdToken(refresh), fetcher });
  }
  async readPage(collection: SyncCollection, since: number, cursor?: unknown): Promise<RemotePage> {
    const params = new URLSearchParams({ since: String(since) });
    if (cursor !== undefined) params.set('cursor', JSON.stringify(cursor));
    const result = await this.client.request<RemotePage>('/v1/sync/' + collection + '?' + params);
    if (!object(result) || !Array.isArray(result.documents)) invalidResponse();
    for (const entry of result.documents) {
      if (!object(entry) || typeof entry.id !== 'string' || typeof entry.serverUpdatedAt !== 'number' || !Number.isFinite(entry.serverUpdatedAt)
        || !object(entry.data) || entry.data.id !== entry.id || typeof entry.data.updatedAt !== 'number' || typeof entry.data.revision !== 'string') invalidResponse();
      if (collection === 'cards') {
        if (!object(entry.data.fsrs) || typeof entry.data.fsrs.due !== 'number' || !Number.isFinite(entry.data.fsrs.due)
          || typeof entry.data.introducedAt !== 'number') invalidResponse();
      } else if (!object(entry.data.fsrsLog) || typeof entry.data.fsrsLog.due !== 'number' || typeof entry.data.fsrsLog.review !== 'number'
        || typeof entry.data.reviewedAt !== 'number') invalidResponse();
    }
    if (result.next !== undefined && (!object(result.next) || typeof result.next.id !== 'string' || typeof result.next.timestamp !== 'string')) invalidResponse();
    return result;
  }
  async readSettings(): Promise<RemoteSettings | undefined> {
    const result = await this.client.request<{ settings: RemoteSettings | null }>('/v1/sync/settings');
    if (!object(result) || !Object.hasOwn(result, 'settings')) invalidResponse();
    const settings = result.settings;
    if (settings === null) return undefined;
    if (!object(settings) || settings.id !== 'main' || !Number.isInteger(settings.newPerDay) || !['hsk', 'freq'].includes(settings.order)
      || typeof settings.updatedAt !== 'number' || typeof settings.revision !== 'string') invalidResponse();
    return settings;
  }
  async commit(writes: SyncWrite[]): Promise<void> {
    const result = await this.client.request<{ ok: boolean }>('/v1/sync/batch', { writes });
    if (!object(result) || result.ok !== true) invalidResponse();
  }
}
