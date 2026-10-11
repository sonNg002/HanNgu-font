import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiClientError, normalizeApiUrl } from '../src/lib/api/client';
import { ApiTransport } from '../src/lib/api-transport';

test('URL normalize giữ API prefix; production yêu cầu HTTPS', () => {
  assert.equal(normalizeApiUrl(' https://api.example.com/api/ '), 'https://api.example.com/api');
  for (const value of ['javascript:alert(1)', 'https://user:secret@api.example.com', 'https://api.example.com?key=x', 'https://api.example.com#hash', 'invalid']) {
    assert.throws(() => normalizeApiUrl(value), ApiClientError);
  }
  assert.throws(() => normalizeApiUrl('http://api.example.com', true), ApiClientError);
});

test('Request gửi token, JSON và timeout; 401 refresh đúng một lần với body không đổi', async () => {
  const refreshes: boolean[] = [];
  const requests: RequestInit[] = [];
  const urls: string[] = [];
  const client = new ApiClient('https://api.example.com/', {
    getToken: async refresh => { refreshes.push(refresh); return refresh ? 'new-token' : 'old-token'; },
    fetcher: async (url, init) => {
      urls.push(String(url)); requests.push(init!);
      return requests.length === 1 ? Response.json({ error: 'Expired' }, { status: 401 }) : Response.json({ ok: true });
    },
  });
  assert.deepEqual(await client.request('/v1/sync/batch', { writes: [] }), { ok: true });
  assert.deepEqual(refreshes, [false, true]);
  assert.equal(urls[0], 'https://api.example.com/v1/sync/batch');
  assert.equal(requests[0].body, requests[1].body);
  assert.equal((requests[1].headers as Record<string, string>).Authorization, 'Bearer new-token');
  assert.equal(requests[1].cache, 'no-store');
  assert.ok(requests[1].signal);
});

test('401 lần hai dừng retry; lỗi giữ status/code/requestId/Retry-After', async () => {
  let count = 0;
  const client = new ApiClient('https://api.example.com', { getToken: async () => 'token', fetcher: async () => {
    count++; return Response.json({ error: 'Expired', code: 'UNAUTHENTICATED', requestId: 'request-1' }, { status: 401 });
  } });
  await assert.rejects(client.request('/v1/sync/settings'), (error: ApiClientError) => error.status === 401 && error.requestId === 'request-1');
  assert.equal(count, 2);
  const limited = new ApiClient('https://api.example.com', { getToken: async () => 'token', fetcher: async () =>
    Response.json({ error: 'Wait', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60', 'X-Request-ID': 'request-2' } }) });
  await assert.rejects(limited.request('/v1/sync/settings'), (error: ApiClientError) => error.status === 429 && error.code === 'RATE_LIMITED' && error.retryAfterSeconds === 60 && error.requestId === 'request-2');
});

test('Lỗi network/timeout và response không phải JSON có mã lỗi rõ ràng', async () => {
  for (const [name, code] of [['TypeError', 'NETWORK_ERROR'], ['TimeoutError', 'REQUEST_TIMEOUT']]) {
    const client = new ApiClient('https://api.example.com', { getToken: async () => 'token', fetcher: async () => { throw Object.assign(new Error('secret'), { name }); } });
    await assert.rejects(client.request('/v1/sync/settings'), (error: ApiClientError) => error.code === code && !error.message.includes('secret'));
  }
  const invalid = new ApiClient('https://api.example.com', { getToken: async () => 'token', fetcher: async () => new Response('<html>Error</html>') });
  await assert.rejects(invalid.request('/v1/sync/settings'), (error: ApiClientError) => error.code === 'INVALID_RESPONSE');
});

test('Transport không ack batch nếu server trả envelope sai; null settings được hỗ trợ', async () => {
  const user = { getIdToken: async () => 'token' };
  const bad = new ApiTransport(user, 'https://api.example.com', async () => Response.json({}));
  await assert.rejects(bad.commit([]), (error: ApiClientError) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(bad.readPage('cards', 0), ApiClientError);
  await assert.rejects(bad.readSettings(), ApiClientError);
  const empty = new ApiTransport(user, 'https://api.example.com', async () => Response.json({ settings: null }));
  assert.equal(await empty.readSettings(), undefined);
});

test('Transport encode cursor và giữ URL cùng wire format hiện tại', async () => {
  let requestUrl = '';
  const transport = new ApiTransport({ getIdToken: async () => 'token' }, 'https://api.example.com', async url => {
    requestUrl = String(url); return Response.json({ documents: [] });
  });
  const cursor = { id: 'write:字', timestamp: '2026-10-11T12:00:00.123456789Z' };
  assert.deepEqual(await transport.readPage('cards', 123, cursor), { documents: [] });
  const params = new URL(requestUrl).searchParams;
  assert.equal(params.get('since'), '123');
  assert.deepEqual(JSON.parse(params.get('cursor')!), cursor);
});
