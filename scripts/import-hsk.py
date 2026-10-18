"""Convert a locally downloaded OLP/Zero to Hero snapshot; never fetch during production builds."""
import csv
import hashlib
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.local/hsk-source'
FILES = ['zerotohero-zh-vocabulary.csv', 'zerotohero-zh-grammar.csv']
COUNTS = {1: 15, 2: 15, 3: 20, 4: 20, 5: 36, 6: 40}


def book_id(level, lesson):
    # Quyển B nối tiếp số bài của A, không khởi động lại từ bài 1.
    if level < 4:
        return str(level)
    split = {4: 10, 5: 18, 6: 20}[level]
    return str(level) + ('a' if lesson <= split else 'b')


def convert():
    raw = {name: (SOURCE / name).read_bytes() for name in FILES}
    lessons = {(level, number): {'id': f'standard:{book_id(level, number)}:{number}',
               'bookId': book_id(level, number), 'number': number, 'words': [], 'grammar': []}
               for level, count in COUNTS.items() for number in range(1, count + 1)}
    vocabulary = list(csv.DictReader(io.StringIO(raw[FILES[0]].decode('utf-8-sig'))))
    grammar = list(csv.DictReader(io.StringIO(raw[FILES[1]].decode('utf-8-sig'))))
    excluded_vocab = excluded_grammar = duplicate_words = 0
    def number(value):
        return int(value) if value.isdigit() else 9999
    for row in sorted(vocabulary, key=lambda row: (number(row['book']), number(row['lesson']), number(row['dialog']), number(row['nw']))):
        # Phụ lục không có số bài được ghi nhận riêng, tuyệt đối không ép vào bài cuối.
        if not row['lesson'].isdigit():
            excluded_vocab += 1
            continue
        key = (int(row['book']), int(row['lesson']))
        if key not in lessons:
            raise ValueError(f'Unknown lesson: {key}')
        word = {key: row[field].strip() for key, field in [('text', 'simplified'), ('pinyin', 'pinyin'), ('meaning', 'definitions')]}
        if not all(word.values()):
            raise ValueError(f'Incomplete word: {row}')
        words = lessons[key]['words']
        prior = next((entry for entry in words if (entry['text'], entry['pinyin']) == (word['text'], word['pinyin'])), None)
        if prior:
            duplicate_words += 1
            if word['meaning'] not in prior['meaning']:
                prior['meaning'] += ' / ' + word['meaning']
        else:
            words.append(word)
    for row in grammar:
        match = re.fullmatch(r'([1-6])\.(\d+)\.(\d+)', row['Code'])
        if not match or not row['Structure'].strip():
            excluded_grammar += 1
            continue
        key = (int(match[1]), int(match[2]))
        if key not in lessons:
            raise ValueError(f'Unknown grammar lesson: {row["Code"]}')
        lessons[key]['grammar'].append({'pattern': row['Structure'].strip(), 'meaning': row['English Equivalent'].strip(),
            'example': row['Example'].strip(), 'pinyin': row['Example Pinyin'].strip(), 'translation': row['Example Translation'].strip()})
    if any(not lesson['words'] for lesson in lessons.values()):
        raise ValueError('Every textbook lesson must have vocabulary before publishing.')
    output = {'source': 'https://github.com/openlanguageprofiles/olp-zh-zerotohero',
              'license': 'CC BY-SA 4.0 (CC-CEDICT definitions); CC0 (remaining dataset)',
              'sourceHashes': {name: hashlib.sha256(data).hexdigest() for name, data in raw.items()},
              'meaningLanguage': 'en', 'excludedSupplementaryWords': excluded_vocab,
              'excludedGrammarRows': excluded_grammar, 'mergedDuplicateWords': duplicate_words,
              'lessons': list(lessons.values())}
    (ROOT / 'data/hsk-standard.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'lessons': len(lessons), 'words': sum(len(item['words']) for item in lessons.values()),
                      'grammar': sum(len(item['grammar']) for item in lessons.values()),
                      'excludedWords': excluded_vocab, 'excludedGrammar': excluded_grammar, 'mergedDuplicates': duplicate_words}))


if __name__ == '__main__':
    convert()
