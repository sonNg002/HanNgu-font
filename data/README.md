# Kho chữ

`starter.json`: 24 chữ biên soạn có nghĩa tiếng Việt. `corpus.json`: dữ liệu dẫn xuất từ Make Me a Hanzi (LGPL-3.0-or-later) và Unicode Unihan 17.0.0 (Unicode License v3). License nằm trong `licenses/` và được build vào `/data/licenses/` cùng corpus nguồn.

Build chọn 3.000 chữ có pinyin, nghĩa, âm Việt, bộ thủ Unicode và mẫu Hanzi Writer thật. Giữ toàn bộ chữ khởi đầu; phần mở rộng ưu tiên thứ tự danh mục TGH 2013, không gán cấp HSK hoặc giả lập tần suất. Nghĩa phần mở rộng hiện là tiếng Anh. kVietnamese là cách đọc Quốc ngữ theo Unihan, có thể gồm cách đọc Hán Nôm; không coi đây là bản Hán Việt đã kiểm duyệt. Với chữ giản thể thiếu âm, lấy từ kTraditionalVariant tương ứng. Bộ thủ dùng kRSUnicode và CJKRadicals; thành phần chữ là một trường riêng.

Nguồn gốc:
- https://github.com/skishore/makemeahanzi/blob/master/dictionary.txt
- https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip
- https://www.unicode.org/Public/17.0.0/ucd/CJKRadicals.txt
- Mẫu nét: package hanzi-writer-data 2.0.1, Arphic Public License, copy nguyên dữ liệu và ARPHICPL.TXT.

Build dùng `starter.json`, `corpus.json` và package `hanzi-writer-data` đã cài; không tải lại nguồn từ mạng. Chạy `npm run content:build` để sinh `public/data/`. Giữ dữ liệu nguồn và các giấy phép để build lại bản deploy.
