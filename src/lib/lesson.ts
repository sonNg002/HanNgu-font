import type { Character, Example, Word } from './types';

const toneMarks: Record<string, [string, number]> = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['ü', 1], ǘ: ['ü', 2], ǚ: ['ü', 3], ǜ: ['ü', 4],
  ń: ['n', 2], ň: ['n', 3], ǹ: ['n', 4], ḿ: ['m', 2],
};

export function pinyinKey(value: string): string {
  // Chuyển dấu thanh thành số, giữ ü và thanh điệu để ri/ri3 không được nhận là rì.
  const syllables = value.normalize('NFC').toLowerCase().trim().replaceAll('u:', 'ü').replaceAll('v', 'ü').split(/[\s'’]+/);
  return syllables.map(syllable => {
    let tone = 0;
    let base = '';
    for (const letter of syllable) {
      const marked = toneMarks[letter];
      if (marked) {
        if (tone) return '!invalid';
        base += marked[0]; tone = marked[1];
      } else base += letter;
    }
    const digit = base.match(/[0-5]$/);
    if (digit) {
      const numberedTone = Number(digit[0]) || 5;
      if (tone && tone !== numberedTone) return '!invalid';
      tone = numberedTone; base = base.slice(0, -1);
    }
    return /^[a-zü]+$/.test(base) ? `${base}${tone || 5}` : '!invalid';
  }).join(' ');
}

export function matchesPinyin(answer: string, readings: string[]): boolean {
  const key = pinyinKey(answer);
  return !key.includes('!invalid') && readings.some(reading => pinyinKey(reading) === key);
}

export function matchesHanViet(answer: string, readings: string[]): boolean {
  // Giữ thanh và dạng nguyên âm, nhưng chấp nhận hai cách đặt dấu như thủy/thuỷ và hòa/hoà.
  // Tách thanh khỏi vị trí nguyên âm để không bắt học viên sửa một biến thể chính tả hợp lệ.
  const key = (value: string) => value.toLocaleLowerCase('vi-VN').trim().split(/\s+/).map(syllable => {
    let tones = '';
    const base = syllable.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, mark => { tones += mark; return ''; });
    return `${base}|${tones}`;
  }).join(' ');
  return !!key(answer) && readings.some(reading => key(reading) === key(answer));
}

export function lessonExample(character: Character, words: Word[], preferLessonWords = false): Example | undefined {
  // Chỉ tạo câu hỏi từ ví dụ/từ có thật trong kho; không ghép tùy ý thành từ mới.
  const example = character.examples.find(entry => entry.text.includes(character.id) && entry.translation.trim());
  if (example && !preferLessonWords) return example;
  const word = words.find(entry => entry.simplified.includes(character.id) && entry.meaning.length > 0);
  // Bài theo sách ưu tiên từ trong bài; ví dụ biên soạn của chữ vẫn dùng cho bộ tự do.
  return word ? { text: word.simplified, translation: word.meaning.join(' · '), pinyin: word.pinyin || undefined, source: 'Từ điển của bộ học' } : preferLessonWords ? undefined : example;
}

export function contextChoices(character: Character, peers: Character[]): string[] {
  const other = [...new Set(peers.filter(entry => entry.id !== character.id).map(entry => entry.id))].slice(0, 2);
  const choices = [...other];
  // Vị trí đáp án thay đổi theo chữ, không luôn ở nút đầu; thứ tự ổn định khi component render lại.
  choices.splice(character.id.codePointAt(0)! % (other.length + 1), 0, character.id);
  return choices;
}
