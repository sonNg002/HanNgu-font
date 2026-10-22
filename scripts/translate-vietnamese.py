"""Create a cached Vietnamese translation snapshot from public dictionary definitions."""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/vietnamese-translations.json'


def source_strings():
    corpus = json.loads((ROOT / 'data/corpus.json').read_text(encoding='utf-8'))
    hsk = json.loads((ROOT / 'data/hsk-standard.json').read_text(encoding='utf-8'))
    values = {meaning for entry in corpus for meaning in entry['meaning']}
    for lesson in hsk['lessons']:
        values.update(word['meaning'] for word in lesson['words'])
        for grammar in lesson['grammar']:
            values.update([grammar['meaning'], grammar['translation']])
    return sorted(value for value in values if value.strip())


def translate(text):
    query = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'vi', 'dt': 't', 'q': text})
    with urllib.request.urlopen('https://translate.googleapis.com/translate_a/single?' + query, timeout=40) as response:
        result = json.load(response)
    translated = ''.join(part[0] for part in result[0] if part[0]).strip()
    if not translated:
        raise ValueError('Empty translation')
    return translated


def main():
    snapshot = json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else {
        'language': 'vi', 'provider': 'Google Translate', 'reviewStatus': 'machine-translated', 'translations': {}}
    translations = snapshot['translations']
    missing = [value for value in source_strings() if value not in translations]
    if '--repair' in sys.argv:
        # Nghĩa có dấu / và pinyin đôi khi làm dịch vụ bỏ sót cụm tiếng Anh thông dụng.
        residue = re.compile(r'\b(to|the|of|and|or|for|with|from|surname|variant|abbr|classifier|commonly|this|these|those|book|school|store|shop|cat|dog|rain|apple|morning|is|are|am|home|family|my|him|her|it|root|stem|origin|source|current|inherent)\b', re.I)
        missing = sorted(set(missing + [key for key, value in translations.items() if residue.search(value)]))
    while missing:
        batch, size = [], 0
        while missing and (not batch or size + len(missing[0]) < 2400):
            item = missing.pop(0)
            batch.append(item)
            size += len(item) + 1
        # Một dòng cho mỗi mục; nếu dịch vụ thay số dòng, dịch riêng để không lệch nghĩa giữa các từ.
        lines = [' '.join(item.replace('/', '; ').replace('CL:', 'measure words: ').split()) for item in batch]
        translated = translate('\n'.join(lines)).split('\n')
        if len(translated) != len(batch) or any(not line.strip() for line in translated):
            translated = [translate(line) for line in lines]
        translations.update({source: target.strip() for source, target in zip(batch, translated)})
        # Lưu từng lô, dừng khi có lỗi mạng/rate limit; chạy lại chỉ xử lý các mục còn thiếu.
        temporary = OUTPUT.with_suffix('.tmp')
        temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temporary.replace(OUTPUT)
        print(f'Translated {len(translations)}; remaining {len(missing)}', flush=True)
        time.sleep(0.3)


if __name__ == '__main__':
    main()
