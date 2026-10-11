import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Content } from '@/lib/types';
import { DictionaryBrowser } from '@/components/dictionary-browser';
export const dynamic = 'force-static';
export default async function Browse() {
  // SSG giữ từ điển độc lập Firestore; client chỉ thực hiện lọc và phân trang sau hydration.
  const content = JSON.parse(await readFile(path.join(process.cwd(), 'public/data/content.json'), 'utf8')) as Content;
  return <main className="shell"><header className="topbar"><a className="brand" href="/">字 Hán ngữ</a><a href="/">← Học & ôn</a></header>
    <div className="intro"><span className="eyebrow">TỪ ĐIỂN THEO BỘ THỦ</span><h1>Một bộ, nhiều chữ để khám phá.</h1><p>{content.characters.length.toLocaleString('vi-VN')} chữ có mẫu nét. Tìm chữ, chọn bộ và bắt đầu luyện viết.</p></div>
    <DictionaryBrowser characters={content.characters} /><footer><a href="/">Bắt đầu học →</a></footer></main>;
}