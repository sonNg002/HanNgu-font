import type { Character, StudyCard } from './types';

// Bộ ngắn biên soạn riêng; thứ tự thể hiện liên hệ học, không dùng làm nhãn bài sách HSK.
export const MEMORY_DECKS = [
  { id: 'count-start', title: 'Đếm bằng nét', glyphs: '一二三十', method: 'Tình huống', tip: 'Đếm đồ vật quanh bạn, rồi che chữ và viết lại số vừa đếm.' },
  { id: 'count-more', title: 'Đếm tiếp đến mười', glyphs: '四五六七八', method: 'Tình huống', tip: 'Tự đọc một số ngẫu nhiên, viết chữ tương ứng rồi kiểm tra.' },
  { id: 'light', title: 'Mặt trời và ánh sáng', glyphs: '日月明天', method: 'Liên hệ hình', tip: 'Quan sát 日 và 月 trong 明. Dùng hình ảnh như mẹo nhớ, không coi đó là nguồn gốc của mọi chữ.' },
  { id: 'trees', title: 'Từ cây đến rừng', glyphs: '木林森山', method: 'Liên hệ hình', tip: 'So sánh số lần xuất hiện của 木, sau đó tự viết từng chữ không nhìn mẫu.' },
  { id: 'people', title: 'Người trong gia đình', glyphs: '人女子母父', method: 'Tình huống', tip: 'Gắn mỗi chữ với một người cụ thể, rồi tự gọi lại âm đọc và nghĩa.' },
  { id: 'direction', title: 'Chỉ đường quanh bạn', glyphs: '上下中左右', method: 'Tình huống', tip: 'Chỉ vị trí của một đồ vật thật và nói hướng trước khi mở đáp án.' },
  { id: 'body', title: 'Nhớ bằng cử chỉ', glyphs: '口目耳手心', method: 'Tình huống', tip: 'Chỉ vào bộ phận cơ thể, nhớ chữ rồi viết từ trí nhớ.' },
  { id: 'elements', title: 'Một cảnh thiên nhiên', glyphs: '水火土山田', method: 'Tình huống', tip: 'Hình dung một cảnh có các yếu tố này. Kể lại rồi tự viết từng chữ.' },
  { id: 'calendar', title: 'Lịch của bạn', glyphs: '日月年今明', method: 'Tình huống', tip: 'Liên hệ chữ với lịch thật. Nhớ nghĩa của chữ và phân biệt nghĩa khi ghép thành từ.' },
  { id: 'study', title: 'Một buổi học', glyphs: '学书读写听', method: 'Tình huống', tip: 'Gắn chữ với hành động trong buổi học, rồi gọi lại âm đọc mà không nhìn Pinyin.' },
  { id: 'meal', title: 'Bữa ăn hôm nay', glyphs: '吃喝饭茶水', method: 'Tình huống', tip: 'Nhìn món ăn hoặc đồ uống thật rồi nhớ chữ phù hợp.' },
  { id: 'weather', title: 'Nhìn trời nhớ chữ', glyphs: '天雨风云雪', method: 'Tình huống', tip: 'Liên hệ với thời tiết bạn từng gặp; cuối buổi tự nhớ lại toàn bộ bộ chữ.' },
] as const;

export function memoryDecks(characters: Character[]) {
  const lookup = new Map(characters.map(character => [character.id, character]));
  return MEMORY_DECKS.map(deck => ({ ...deck,
    // Giữ thứ tự biên soạn và không tạo chữ giả khi bản từ điển thiếu dữ liệu.
    characters: [...new Set(deck.glyphs)].flatMap(id => lookup.has(id) ? [lookup.get(id)!] : []),
    missing: [...new Set(deck.glyphs)].filter(id => !lookup.has(id)),
  }));
}

export function deckReviewCards(cards: StudyCard[], ids: ReadonlySet<string>, now = new Date()) {
  // Chỉ lấy thẻ đến hạn trong bộ, không tạo lượt ôn sớm làm lệch lịch FSRS.
  return cards.filter(card => ids.has(card.targetId) && card.fsrsState.due <= now);
}
