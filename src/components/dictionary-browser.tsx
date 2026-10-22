'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { radicalGroups } from '@/lib/catalog';
import type { Character } from '@/lib/types';
import { WritingPractice } from './writing-practice';
import { CATALOG_PAGE_SIZE as PAGE_SIZE, DEFAULT_CATALOG_VIEW, catalogResults, catalogSearch, parseCatalogView, type CatalogView } from '@/lib/catalog-view';
export function DictionaryBrowser({ characters }: { characters: Character[] }) {
  const [view, setView] = useState<CatalogView>(DEFAULT_CATALOG_VIEW);
  const { query, radical, page } = view;
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Đọc URL sau hydration để giữ HTML tĩnh và khôi phục bộ lọc khi mở link.
    const restore = () => setView(parseCatalogView(new URLSearchParams(window.location.search)));
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function update(patch: Partial<CatalogView>, focusResults = false) {
    const next = { ...view, page: 0, ...patch };
    setView(next);
    const search = catalogSearch(next);
    // Không tạo một mục lịch sử cho mỗi phím gõ trong ô tìm kiếm.
    history.replaceState(null, '', search ? `/browse/?${search}` : '/browse/');
    if (focusResults) {
      resultsHeading.current?.focus({ preventScroll: true });
      resultsHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  const [practice, setPractice] = useState<Character | null>(null);
  const groups = useMemo(() => radicalGroups(characters), [characters]);
  const filtered = useMemo(() => catalogResults(characters, view), [characters, view]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  // Phân trang để hàng nghìn chữ không tạo hàng nghìn card/SVG cùng lúc trên điện thoại.
  return <>
    <section className="panel catalog-controls">
      <label>Tìm chữ, pinyin hoặc nghĩa<input type="search" value={query} placeholder="Ví dụ: 明, ming, sáng…" maxLength={200} onChange={event => update({ query: event.target.value })} /></label>
      <label>Chia theo bộ thủ<select value={radical} onChange={event => update({ radical: event.target.value })}>
        <option value="">Tất cả {characters.length.toLocaleString('vi-VN')} chữ</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.glyph} {group.name} {group.variants.join('/')} · {group.count} chữ</option>)}
      </select></label>
      <div className="catalog-filter-row"><label>Cấp độ HSK<select value={view.hsk} onChange={event => update({ hsk: event.target.value })}>
        <option value="">Tất cả cấp độ</option>{[...new Set(characters.map(item => item.hsk).filter((level): level is number => !!level))].sort((a, b) => a - b).map(level => <option key={level} value={level}>HSK {level}</option>)}
      </select></label><label>Sắp xếp<select value={view.sort} onChange={event => update({ sort: event.target.value as CatalogView['sort'] })}>
        <option value="default">Thứ tự từ điển</option><option value="strokes">Ít nét trước</option><option value="hsk">HSK thấp trước</option>
      </select></label></div>
      {(query || radical || view.hsk || view.sort !== 'default') && <button className="secondary" onClick={() => update(DEFAULT_CATALOG_VIEW)}>Xóa bộ lọc</button>}
      <p role="status">{filtered.length.toLocaleString('vi-VN')} chữ · {groups.length} bộ thủ có chữ trong kho</p>
      {radical && <a className="button-link" href={`/?radical=${radical}`}>Học bộ này →</a>}
    </section>
    {practice && <section className="panel catalog-practice">
      <div className="practice-heading"><div><span className="eyebrow">LUYỆN VIẾT</span><h2>{practice.pinyin.join(' / ')} · {practice.meaning.join(' · ')}</h2></div>
        <button className="secondary" onClick={() => setPractice(null)}>Đóng bài viết</button></div>
      <WritingPractice key={practice.id} character={practice.id} onResult={() => { /* Luyện thử chưa đưa vào lịch FSRS; muốn lưu tiến độ chọn Học chữ này. */ }} />
      <a className="button-link" href={`/?radical=${practice.radicalNumber}&character=${encodeURIComponent(practice.id)}`}>Học chữ này và lưu tiến độ →</a>
    </section>}
    {!filtered.length && <section className="panel"><h2>Chưa tìm thấy chữ phù hợp.</h2><p>Thử một từ ngắn hơn, bỏ dấu hoặc mở rộng cấp HSK và bộ thủ.</p><button onClick={() => update(DEFAULT_CATALOG_VIEW)}>Xem toàn bộ từ điển</button></section>}
    <h2 ref={resultsHeading} tabIndex={-1} className="catalog-results-heading">{filtered.length ? `Kết quả ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} / ${filtered.length.toLocaleString('vi-VN')} chữ` : 'Kết quả tìm kiếm'}</h2>
    <div className="dictionary">{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(character => <article className="panel" key={character.id}>
      <div className="hanzi small">{character.id}</div><h2>{character.pinyin.join(' / ')}</h2>
      <p>{character.meaning.join(' · ')} {character.meaningLanguage === 'en' && <small className="muted">(nghĩa tiếng Anh)</small>}</p>
      {character.meaningTranslation === 'machine' && <small className="muted">Nghĩa tiếng Việt · bản dịch máy</small>}
      <p className="muted">Bộ {character.radical}{character.radicalVariant && character.radicalVariant !== character.radical ? ` (${character.radicalVariant})` : ''} · {character.strokes} nét{character.hsk ? ` · HSK ${character.hsk}` : ''}</p>
      <p className="muted">Thành phần: {character.components.join(' + ') || 'Chữ đơn'}</p>
      <div className="actions"><button className="secondary" onClick={() => { setPractice(character); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>Luyện viết</button>
        <a href={`/?radical=${character.radicalNumber}&character=${encodeURIComponent(character.id)}`}>Học chữ này →</a></div>
    </article>)}</div>
    <nav className="catalog-pagination" aria-label="Phân trang chữ"><button className="secondary" disabled={currentPage === 0} onClick={() => update({ page: currentPage - 1 }, true)}>← Trang trước</button>
      <span>Trang {currentPage + 1}/{pages}</span><button className="secondary" disabled={currentPage + 1 >= pages} onClick={() => update({ page: currentPage + 1 }, true)}>Trang sau →</button></nav>
    <p className="muted">Nguồn: Make Me a Hanzi và Unicode Unihan; nghĩa tiếng Việt đang được bổ sung. <a href="/data/licenses/makemeahanzi-LICENSE.txt">Giấy phép dữ liệu</a></p>
  </>;
}
