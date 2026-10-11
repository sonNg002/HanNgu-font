import type { User } from 'firebase/auth';
import type { RemoteSettings } from './sync-codec';
import type { RemotePage, SyncCollection, SyncTransport, SyncWrite } from './sync';

export class ApiTransport implements SyncTransport {
  private base: string;
  constructor(private user: Pick<User, 'getIdToken'>, baseUrl: string,
    private fetcher: typeof fetch = fetch) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error('Địa chỉ API không hợp lệ.');
    this.base = baseUrl.replace(/\/+$/, '');
  }
  private async request<T>(path: string, body?: unknown, refresh = false): Promise<T> {
    // Firebase SDK tự refresh token hết hạn; retry 401 một lần không làm trùng log nhờ ID ổn định.
    const token = await this.user.getIdToken(refresh);
    const response = await this.fetcher(this.base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000), cache: 'no-store',
    });
    if (response.status === 401 && !refresh) return this.request<T>(path, body, true);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không kết nối được API đồng bộ.');
    return result as T;
  }
  readPage(collection: SyncCollection, since: number, cursor?: unknown): Promise<RemotePage> {
    const params = new URLSearchParams({ since: String(since) });
    if (cursor !== undefined) params.set('cursor', JSON.stringify(cursor));
    return this.request<RemotePage>('/v1/sync/' + collection + '?' + params);
  }
  async readSettings(): Promise<RemoteSettings | undefined> {
    return (await this.request<{ settings: RemoteSettings | null }>('/v1/sync/settings')).settings ?? undefined;
  }
  async commit(writes: SyncWrite[]): Promise<void> { await this.request('/v1/sync/batch', { writes }); }
}
