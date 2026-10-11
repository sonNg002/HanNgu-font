import type { Content } from './types';
let loading: Promise<Content> | undefined;
export function loadContent(): Promise<Content> {
  // Dictionary tĩnh được browser/service worker cache, không đọc từ Firestore.
  if (!loading) loading = fetch('/data/content.json').then(async response => {
    if (!response.ok) throw new Error('Không tải được từ điển. Hãy kết nối mạng và thử lại.');
    return await response.json() as Content;
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}