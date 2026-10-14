'use client';
import { useMemo, useState } from 'react';
import { filterCharacters, radicalGroups } from '@/lib/catalog';
import type { Character } from '@/lib/types';
import { WritingPractice } from './writing-practice';
const PAGE_SIZE = 60;
export function DictionaryBrowser({ characters }: { characters: Character[] }) {
  const [query, setQuery] = useState(''), [radical, setRadical] = useState(''), [page, setPage] = useState(0);
  const [practice, setPractice] = useState<Character | null>(null);
  const groups = useMemo(() => radicalGroups(characters), [characters]);
  const filtered = useMemo(() => filterCharacters(characters, radical, query), [characters, radical, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  // Phân trang để hàng nghìn chữ không tạo hàng nghìn card/SVG cùng lúc trên điện thoại.
  return <>
    <section className="panel catalog-controls">
      <label>Tìm chữ, pinyin, âm Việt hoặc nghĩa<input type="search" value={query} placeholder="Ví dụ: 明, ming, minh…" onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <label>Chia theo bộ thủ<select value={radical} onChange={event => { setRadical(event.target.value); setPage(0); }}>
        <option value="">Tất cả {characters.length.toLocaleString('vi-VN')} chữ</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.glyph} {group.name} {group.variants.join('/')} · {group.count} chữ</option>)}
      </select></label>
      <p role="status">{filtered.length.toLocaleString('vi-VN')} chữ · {groups.length} bộ thủ có chữ trong kho</p>
      {radical && <a className="button-link" href={`/?radical=${radical}`}>Học bộ này →</a>}
    </section>
    {practice && <section className="panel catalog-practice">
      <div className="practice-heading"><div><span className="eyebrow">LUYỆN VIẾT</span><h2>{practice.pinyin.join(' / ')} · {practice.meaning.join(' · ')}</h2></div>
        <button className="secondary" onClick={() => setPractice(null)}>Đóng bài viết</button></div>
      <WritingPractice key={practice.id} character={practice.id} onResult={() => { /* Luyện thử chưa đưa vào lịch FSRS; muốn lưu tiến độ chọn Học chữ này. */ }} />
      <a className="button-link" href={`/?radical=${practice.radicalNumber}&character=${encodeURIComponent(practice.id)}`}>Học chữ này và lưu tiến độ →</a>
    </section>}
    {!filtered.length && <section className="panel">Không có chữ phù hợp. Thử đổi bộ hoặc từ tìm kiếm.</section>}
    <div className="dictionary">{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(character => <article className="panel" key={character.id}>
      <div className="hanzi small">{character.id}</div><h2>{character.hanViet.join(' / ') || 'Chưa có âm Việt'}</h2>
      <p>{character.pinyin.join(' / ')}</p><p>{character.meaning.join(' · ')} {character.meaningLanguage === 'en' && <small className="muted">(nghĩa tiếng Anh)</small>}</p>
      <p className="muted">Bộ {character.radical}{character.radicalVariant && character.radicalVariant !== character.radical ? ` (${character.radicalVariant})` : ''} · {character.strokes} nét{character.hsk ? ` · HSK ${character.hsk}` : ''}</p>
      <p className="muted">Thành phần: {character.components.join(' + ') || 'Chữ đơn'}</p>
      {character.readingSource === 'unihan' && <small className="muted">Âm Việt theo Unihan</small>}
      <div className="actions"><button className="secondary" onClick={() => { setPractice(character); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Luyện viết</button>
        <a href={`/?radical=${character.radicalNumber}&character=${encodeURIComponent(character.id)}`}>Học chữ này →</a></div>
    </article>)}</div>
    <nav className="catalog-pagination" aria-label="Phân trang chữ"><button className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← Trang trước</button>
      <span>Trang {currentPage + 1}/{pages}</span><button className="secondary" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Trang sau →</button></nav>
    <p className="muted">Nguồn: Make Me a Hanzi và Unicode Unihan. Âm Việt từ Unihan có thể gồm cách đọc Hán Nôm; nghĩa tiếng Việt đang được bổ sung. <a href="/data/licenses/makemeahanzi-LICENSE.txt">Giấy phép dữ liệu</a></p>
  </>;
}
