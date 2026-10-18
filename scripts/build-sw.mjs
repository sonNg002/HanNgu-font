import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}
// Không đưa worker cũ vào snapshot: build lại cùng nội dung phải giữ nguyên phiên bản.
const assets = (await files('out')).filter(file => /\.(js|css|json|html|txt|svg)$/i.test(file)
  && path.relative('out', file) !== 'sw.js').sort();
const hash = createHash('sha256');
// Đọc theo lô giới hạn để giảm I/O tuần tự, nhưng hash theo thứ tự cố định.
// Hash cả đường dẫn và độ dài để đổi tên hay ranh giới file đều làm đổi phiên bản.
for (let index = 0; index < assets.length; index += 32) {
  const batch = assets.slice(index, index + 32);
  const contents = await Promise.all(batch.map(asset => readFile(asset)));
  for (let offset = 0; offset < batch.length; offset++) {
    hash.update(JSON.stringify([path.relative('out', batch[offset]).replaceAll('\\', '/'), contents[offset].length]));
    hash.update(contents[offset]);
  }
}
const version = hash.digest('hex').slice(0, 16);
const urls = [...new Set(['/', '/browse/', '/progress/', '/courses/', ...assets.map(file => '/' + path.relative('out', file).replaceAll('\\', '/'))])];
// SW cache đúng một phiên bản build; không cache Firebase/token hoặc request bên ngoài origin.
await writeFile('out/sw.js', `
const CACHE = 'hanzi-${version}';
const PRECACHE = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  // Chia nhóm để không mở hàng nghìn request đồng thời khi cache kho chữ lớn.
  event.waitUntil(caches.open(CACHE).then(async cache => {
    for (let index = 0; index < PRECACHE.length; index += 40) await cache.addAll(PRECACHE.slice(index, index + 40));
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hanzi-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      const cached = await caches.match(url.pathname);
      return cached || new Response('Trang chưa được lưu offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }));
  } else {
    event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
  }
});
`);
console.log(`Offline cache ${version}: ${urls.length} tài nguyên.`);
