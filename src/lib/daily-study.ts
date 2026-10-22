import { radicalGroups } from './catalog';
import { orderedCharacters } from './study';
import { startOfDay } from './time';
import type { Character, LearnedCharacter, Settings } from './types';

// Chủ đề biên soạn bằng danh sách chữ cụ thể; không suy diễn nghĩa từ bộ thủ.
export const STUDY_TOPICS = [
  { id: 'numbers', title: 'Số đếm', glyphs: '一二三四五六七八九十百千万零' },
  { id: 'nature', title: 'Thiên nhiên', glyphs: '日月明天山水火木林森田土雨风云雪河海' },
  { id: 'family', title: 'Gia đình', glyphs: '人女子父母爸妈兄弟姐妹儿家' },
  { id: 'body', title: 'Cơ thể', glyphs: '口目耳手足心头身牙' },
  { id: 'position', title: 'Vị trí và phương hướng', glyphs: '上下中左右前后内外东西南北' },
  { id: 'time', title: 'Thời gian', glyphs: '日月年时分秒今昨明早晚午' },
  { id: 'school', title: 'Học tập', glyphs: '学生书文字读写听说问答师校' },
  { id: 'food', title: 'Ăn uống', glyphs: '吃喝饭菜米茶水果肉鱼蛋奶' },
] as const;

export interface StudyGroup {
  id: string; kind: 'topic' | 'radical' | 'all'; title: string; characters: Character[];
}

export function studyGroups(characters: Character[], order: Settings['order']): StudyGroup[] {
  const ordered = orderedCharacters(characters, order);
  const byRadical = new Map<number, Character[]>();
  for (const character of ordered) {
    if (!character.radicalNumber) continue;
    const group = byRadical.get(character.radicalNumber) ?? [];
    group.push(character); byRadical.set(character.radicalNumber, group);
  }
  return [
    ...STUDY_TOPICS.map(topic => ({ id: `topic:${topic.id}`, kind: 'topic' as const,
      title: topic.title, characters: ordered.filter(character => topic.glyphs.includes(character.id)) })),
    ...radicalGroups(characters).map(group => ({ id: `radical:${group.id}`, kind: 'radical' as const,
      title: `${group.glyph} · ${group.name.startsWith('Bộ ') ? group.name : `Bộ ${group.name}`}`,
      characters: byRadical.get(group.id) ?? [] })),
  ].filter(group => group.characters.length > 0);
}

export function dailyRecommendation(
  characters: Character[], learned: LearnedCharacter[], settings: Pick<Settings, 'order' | 'newPerDay'>,
  now = new Date(),
): StudyGroup {
  // Chỉ loại chữ đã biết trước hôm nay để bộ đề xuất không đổi sau mỗi lần lưu hoặc tải lại.
  const knownBeforeToday = new Set(learned.filter(entry => entry.introducedAt < startOfDay(now)).map(entry => entry.id));
  const available = orderedCharacters(characters.filter(character => !knownBeforeToday.has(character.id)), settings.order);
  // Người mới học kho có nghĩa Việt và mẹo nhớ trước; tránh đưa chữ mở rộng hiếm vào cho đủ số lượng.
  const curated = available.filter(character => character.readingSource === 'curated');
  const groups = studyGroups(curated.length ? curated : available, settings.order);
  const rank = new Map(available.map((character, index) => [character.id, index]));
  const full = groups.filter(group => group.characters.length >= settings.newPerDay);
  const pool = full.length ? full : groups;
  // Xoay bộ/chủ đề theo ngày địa phương, chỉ chọn trong ba nhóm có chữ cơ bản nhất.
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const kind = day % 2 === 0 ? 'topic' : 'radical';
  const matching = pool.filter(group => group.kind === kind);
  const shortlist = (matching.length ? matching : pool).sort((a, b) =>
    (rank.get(a.characters[0].id) ?? 0) - (rank.get(b.characters[0].id) ?? 0) || a.id.localeCompare(b.id)).slice(0, 3);
  const selected = shortlist[day % Math.max(1, shortlist.length)]
    ?? { id: 'all', kind: 'all' as const, title: 'Chữ cơ bản', characters: available };
  return { ...selected, characters: selected.characters.slice(0, settings.newPerDay) };
}
