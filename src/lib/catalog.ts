import type { Character } from './types';
const names: Record<number, string> = { 1:'Nhất', 2:'Cổn', 9:'Nhân', 18:'Đao', 30:'Khẩu', 31:'Vi', 32:'Thổ', 37:'Đại', 38:'Nữ', 39:'Tử', 40:'Miên', 46:'Sơn', 48:'Công', 50:'Cân', 61:'Tâm', 64:'Thủ', 72:'Nhật', 74:'Nguyệt', 75:'Mộc', 85:'Thủy', 86:'Hỏa', 93:'Ngưu', 94:'Khuyển', 96:'Ngọc', 102:'Điền', 104:'Nạch', 109:'Mục', 112:'Thạch', 113:'Thị', 115:'Hòa', 118:'Trúc', 120:'Mịch', 130:'Nhục', 140:'Thảo', 142:'Trùng', 145:'Y', 149:'Ngôn', 154:'Bối', 156:'Tẩu', 157:'Túc', 159:'Xa', 162:'Sước', 163:'Ấp', 167:'Kim', 169:'Môn', 170:'Phụ', 173:'Vũ', 181:'Hiệt', 184:'Thực', 187:'Mã', 195:'Ngư', 196:'Điểu' };
export function radicalGroups(characters: Character[]) {
  const groups = new Map<number, { id: number; glyph: string; name: string; count: number; variants: string[] }>();
  // Dùng số bộ Unicode, không gom theo chuỗi biến thể: 水 và 氵 thuộc cùng một nhóm.
  for (const character of characters) {
    if (!character.radicalNumber || !character.radical) continue;
    const group = groups.get(character.radicalNumber) ?? { id: character.radicalNumber, glyph: character.radical,
      name: names[character.radicalNumber] ?? `Bộ ${character.radical}`, count: 0, variants: [] };
    group.count++;
    if (character.radicalVariant && character.radicalVariant !== group.glyph && !group.variants.includes(character.radicalVariant)) group.variants.push(character.radicalVariant);
    groups.set(group.id, group);
  }
  return [...groups.values()].sort((a,b) => a.id - b.id);
}
export function searchKey(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('đ', 'd'); }
export function filterCharacters(characters: Character[], radical: string, query = '') {
  const key = searchKey(query.trim());
  return characters.filter(character => (!radical || String(character.radicalNumber) === radical) && (!key ||
    searchKey([character.id, ...character.pinyin, ...character.meaning].join(' ')).includes(key)));
}