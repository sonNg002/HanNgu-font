import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Content } from '@/lib/types';
import { DictionaryBrowser } from '@/components/dictionary-browser';
import { MobileNavigation } from '@/components/mobile-navigation';
export const dynamic = 'force-static';
export default async function Browse() {
  // SSG giữ từ điển độc lập Firestore; client chỉ thực hiện lọc và phân trang sau hydration.
  const content = JSON.parse(await readFile(path.join(process.cwd(), 'public/data/content.json'), 'utf8')) as Content;
  return <main className="shell"><header className="topbar"><a className="brand" href="/"><span className="brand-mark">字</span><span>Hán ngữ<small>Hiểu từng chữ. Nhớ lâu hơn.</small></span></a>
    <nav aria-label="Điều hướng chính"><a href="/">Học tập</a><a className="active" aria-current="page" href="/browse/">Từ điển</a></nav></header>
    <div className="intro"><span className="eyebrow">TỪ ĐIỂN THEO BỘ THỦ</span><h1>Tìm chữ. Hiểu cách tạo chữ.</h1><p>{content.characters.length.toLocaleString('vi-VN')} chữ có mẫu nét · tra cứu, khám phá bộ thủ và luyện viết.</p></div>
    <DictionaryBrowser characters={content.characters} /><footer><a href="/">Bắt đầu học →</a></footer><MobileNavigation current="dictionary" /></main>;
}
