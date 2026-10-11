export class ApiClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string,
    public readonly requestId?: string, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  getToken: (refresh: boolean) => Promise<string>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  requireHttps?: boolean;
}

export function normalizeApiUrl(value: string, requireHttps = false): string {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new ApiClientError('Địa chỉ API không hợp lệ.', 0, 'INVALID_API_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || (requireHttps && url.protocol !== 'https:')) {
    throw new ApiClientError(requireHttps ? 'API production phải dùng địa chỉ HTTPS hợp lệ.' : 'Địa chỉ API không hợp lệ.', 0, 'INVALID_API_URL');
  }
  return url.href.replace(/\/+$/, '');
}

export class ApiClient {
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  constructor(baseUrl: string, private readonly options: ApiClientOptions) {
    this.base = normalizeApiUrl(baseUrl, options.requireHttps);
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async request<T>(path: string, body?: unknown): Promise<T> {
    return this.perform<T>(path, body, false);
  }

  private async perform<T>(path: string, body: unknown, refresh: boolean): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new ApiClientError('Đường dẫn API không hợp lệ.', 0, 'INVALID_API_PATH');
    let token: string;
    try { token = await this.options.getToken(refresh); }
    catch { throw new ApiClientError('Không lấy được phiên đăng nhập. Hãy đăng nhập lại.', 401, 'UNAUTHENTICATED'); }
    let response: Response;
    try {
      response = await this.fetcher(this.base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs), cache: 'no-store',
      });
    } catch (error) {
      const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
      throw new ApiClientError(timeout ? 'API phản hồi quá lâu. Hãy thử đồng bộ lại.' : 'Không kết nối được API. Tiến độ vẫn được lưu trên thiết bị.',
        0, timeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR');
    }
    // Chỉ retry 401 một lần với token mới; batch giữ nguyên ID/revision để retry an toàn.
    if (response.status === 401 && !refresh) return this.perform<T>(path, body, true);
    let payload: unknown;
    try { payload = await response.json(); }
    catch {
      throw new ApiClientError('API trả về dữ liệu không hợp lệ.', response.status, 'INVALID_RESPONSE', response.headers.get('x-request-id') ?? undefined);
    }
    if (!response.ok) {
      const result = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new ApiClientError(typeof result.error === 'string' ? result.error : 'Đồng bộ thất bại. Hãy thử lại.', response.status,
        typeof result.code === 'string' ? result.code : 'API_ERROR',
        typeof result.requestId === 'string' ? result.requestId : response.headers.get('x-request-id') ?? undefined,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
    }
    return payload as T;
  }
}
