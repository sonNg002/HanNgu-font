import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { CharacterJson } from 'hanzi-writer';
import type { Character, Content, Word } from '../src/lib/types';
import { localizeCharacter, localizeHsk, type VietnameseTranslations } from '../src/lib/content-localization';
import type { HskContent } from '../src/lib/hsk-content';
type SourceCharacter = Character & { starterWord?: { simplified: string; meaning: string[]; pinyin?: string }; catalogOrder?: number };
async function main() {
  const require = createRequire(path.resolve('package.json'));
  const vietnamese = JSON.parse(await readFile('data/vietnamese-translations.json', 'utf8')) as VietnameseTranslations;
  const starter = JSON.parse(await readFile('data/starter.json', 'utf8')) as SourceCharacter[];
  const corpus = (JSON.parse(await readFile('data/corpus.json', 'utf8')) as SourceCharacter[])
    .map(character => localizeCharacter(character, vietnamese));
  const lookup = new Map(corpus.map(entry => [entry.id, entry]));
  // Tra cứu tập chữ gốc một lần, tránh quét lại danh sách ở mỗi chữ của corpus.
  const starterIds = new Set(starter.map(entry => entry.id));
  // Giữ 24 chữ biên soạn và tiến độ cũ; bổ sung danh mục mở rộng theo thứ tự TGH.
  const source = [...starter.map(entry => ({ ...lookup.get(entry.id), ...entry, readingSource: 'curated' as const, meaningLanguage: 'vi' as const, meaningTranslation: undefined })),
    ...corpus.filter(entry => !starterIds.has(entry.id)).sort((a,b) => (a.catalogOrder ?? 99999) - (b.catalogOrder ?? 99999) || a.id.codePointAt(0)! - b.id.codePointAt(0)!)];
  const characters: Character[] = [], words: Word[] = [];
  const ids = new Set<string>();
  const wordIds = new Set<string>();
  const output = path.resolve('public/data'), strokeOutput = path.join(output, 'strokes');
  await mkdir(strokeOutput, { recursive: true });
  for (const entry of source) {
    if (characters.length >= 3000) break;
    if ([...entry.id].length !== 1 || ids.has(entry.id) || !entry.pinyin.length || !entry.meaning.length) throw new Error(`Chữ không hợp lệ: ${entry.id}`);
    let strokeSource: string;
    // Kho mở rộng chỉ nhận chữ có nét thật. Chữ khởi đầu thiếu nét phải báo lỗi thay vì âm thầm bỏ.
    try { strokeSource = require.resolve(`hanzi-writer-data/${entry.id}.json`); }
    catch (error) { if (starterIds.has(entry.id)) throw error; continue; }
    const strokeBytes = await readFile(strokeSource);
    const data = JSON.parse(strokeBytes.toString('utf8')) as CharacterJson;
    if (!data.strokes.length || data.strokes.length !== data.medians.length || data.medians.some(stroke => stroke.length < 2)) throw new Error(`Thiếu mẫu nét: ${entry.id}`);
    ids.add(entry.id);
    // Dùng lại byte vừa kiểm tra: không đọc lại file nguồn và giữ nguyên nội dung mẫu nét.
    await writeFile(path.join(strokeOutput, `${entry.id}.json`), strokeBytes);
    const { starterWord, catalogOrder: _catalogOrder, ...character } = entry;
    characters.push({ ...character, strokes: data.strokes.length });
    if (starterWord && !wordIds.has(starterWord.simplified)) {
      wordIds.add(starterWord.simplified);
      words.push({ id: starterWord.simplified, simplified: starterWord.simplified,
        meaning: starterWord.meaning, pinyin: starterWord.pinyin ?? '', chars: [...starterWord.simplified] });
    }
  }
  if (characters.length < 1000 || characters.some(char => !char.radical || !char.radicalNumber)) throw new Error('Kho chữ phải đủ 1000 chữ, mỗi chữ có bộ thủ.');
  await copyFile(require.resolve('hanzi-writer-data/ARPHICPL.TXT'), path.join(strokeOutput, 'ARPHICPL.TXT'));
  // Phân phối riêng dữ liệu dẫn xuất và license/source đi kèm, không đổi license mã ứng dụng.
  const licenseOutput = path.join(output, 'licenses'); await mkdir(licenseOutput, { recursive: true });
  for (const filename of ['makemeahanzi-LICENSE.txt', 'unicode-LICENSE.txt', 'LGPL.txt', 'GPL.txt', 'hsk-data-NOTICE.txt', 'vietnamese-NOTICE.txt']) await copyFile(`data/licenses/${filename}`, path.join(licenseOutput, filename));
  // Snapshot được nhập và kiểm tra trước; build production không phụ thuộc mạng hoặc Python.
  const hsk = JSON.parse(await readFile('data/hsk-standard.json', 'utf8')) as HskContent;
  await writeFile(path.join(output, 'hsk-standard.json'), JSON.stringify(localizeHsk(hsk, vietnamese)));
  await copyFile('data/corpus.json', path.join(licenseOutput, 'corpus-source.json'));
  const version = createHash('sha256').update(JSON.stringify({ characters, words })).digest('hex').slice(0, 12);
  const content: Content = { characters, words, version };
  // Ứng dụng đọc một snapshot chung để chữ và từ luôn cùng phiên bản.
  await writeFile(path.join(output, 'content.json'), JSON.stringify(content));
  console.log(`Dictionary ${version}: ${characters.length} chữ và mẫu nét, ${words.length} từ.`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
