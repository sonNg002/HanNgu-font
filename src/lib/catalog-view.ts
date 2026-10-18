import { filterCharacters } from './catalog';
import type { Character } from './types';

export const CATALOG_PAGE_SIZE = 60;
export interface CatalogView { query: string; radical: string; hsk: string; sort: 'default' | 'strokes' | 'hsk'; page: number }
export const DEFAULT_CATALOG_VIEW: CatalogView = { query: '', radical: '', hsk: '', sort: 'default', page: 0 };

// URL là dữ liệu không tin cậy: giới hạn trang, bộ thủ và cấp HSK trước khi đưa vào giao diện.
export function parseCatalogView(params: URLSearchParams): CatalogView {
  const integer = (value: string | null, max: number) => value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? String(Number(value)) : '';
  const sort = params.get('sort');
  return { query: (params.get('q') ?? '').slice(0, 200), radical: integer(params.get('radical'), 214),
    hsk: integer(params.get('hsk'), 9), sort: sort === 'hsk' || sort === 'strokes' ? sort : 'default',
    page: Number(integer(params.get('page'), 10000) || 1) - 1 };
}

export function catalogSearch(view: CatalogView): string {
  const params = new URLSearchParams();
  if (view.query) params.set('q', view.query);
  if (view.radical) params.set('radical', view.radical);
  if (view.hsk) params.set('hsk', view.hsk);
  if (view.sort !== 'default') params.set('sort', view.sort);
  if (view.page > 0) params.set('page', String(view.page + 1));
  return params.toString();
}

export function catalogResults(characters: Character[], view: CatalogView): Character[] {
  const result = filterCharacters(characters, view.radical, view.query).filter(item => !view.hsk || String(item.hsk) === view.hsk);
  // Lọc trả mảng mới; sắp xếp không làm thay đổi kho dùng chung cho bài học.
  if (view.sort === 'strokes') result.sort((a, b) => a.strokes - b.strokes || a.freq - b.freq);
  if (view.sort === 'hsk') result.sort((a, b) => (a.hsk || 99) - (b.hsk || 99) || a.freq - b.freq);
  return result;
}
