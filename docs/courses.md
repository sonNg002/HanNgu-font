# Bộ học ghi nhớ và HSK Standard Course

## Hai lộ trình

`/courses/` có 12 bộ chữ ngắn biên soạn riêng: liên hệ hình hoặc tình huống, mỗi bộ 3–5 chữ.
Các bộ giữ thứ tự biên soạn, dùng lại tiến độ và ba kỹ năng FSRS của chữ hiện có. Ôn từ bộ chỉ lấy thẻ đến hạn của bộ.
Chữ xuất hiện ở hai bộ không tạo hai lịch ôn. Hoàn thành bài mới không được gọi là nhớ vững.

`/courses/?mode=hsk&book=1` có 6 cấp, 9 quyển, 146 bài của HSK Standard Course theo hệ 1–6.
Quyển 4B bắt đầu ở bài 11, 5B ở bài 19, 6B ở bài 21. Không áp dụng danh sách HSK 3.0 cho bộ sách này.
Mỗi bài có từ vựng, ngữ pháp, tự nhớ tối đa 5 từ/lượt, và nút luyện các chữ có trong kho mẫu nét.
Từ chưa nhớ quay lại cuối lượt. Bài luyện từ là tự đánh giá trong phiên, chưa có lịch FSRS riêng cho từ ghép.

Checklist bốn bước (nghe/đọc, nhớ từ, bài tập/đặt câu, ôn ở buổi sau) là tự báo cáo, không tự chấm hoàn thành bằng số chữ đã học.
Lưu trong `textbookProgress` ở IndexedDB v4, tách theo kho khách/UID. Hiện chưa đồng bộ checklist lên API.
Nâng cấp chỉ thêm bảng; không thay đổi thẻ, bài dở, revision hoặc hàng đợi sync hiện có.

## Nguồn và độ phủ

- Cấu trúc bộ sách: https://www.blcup.com/EnSeriesBook/index/8
- Dữ liệu từ vựng/ngữ pháp: https://github.com/openlanguageprofiles/olp-zh-zerotohero
- Tác giả nguồn: Chinese Zero to Hero; CC-CEDICT dùng CC BY-SA 4.0, phần còn lại nguồn công bố CC0.
- Thông báo phân phối: `data/licenses/hsk-data-NOTICE.txt`, được copy vào public khi build.

Snapshot nhập ngày 2026-10-16 có 5.053 mục từ theo bài và 674 mục ngữ pháp sau chuẩn hóa.
Đây là số mục theo bài, không phải số từ duy nhất hay số từ của đề cương thi chính thức.
102 mục từ phụ lục không có số bài bị loại khỏi ánh xạ; 18 hàng ngữ pháp phụ lục/thiếu cấu trúc không xuất bản;
307 hàng từ trùng cặp chữ/Pinyin trong cùng bài được gộp, giữ nghĩa khác nếu có.

Đã kiểm tra đủ số bài từng quyển, không trùng khóa, không thiếu từ/Pinyin/nghĩa, và mốc đầu sách 1.
Chưa đối chiếu thủ công toàn bộ từng mục với sách in; giao diện ghi đây là dữ liệu bổ trợ, chưa có chứng nhận nhà xuất bản.
Nghĩa từ, giải thích ngữ pháp và bản dịch ví dụ hiển thị bằng tiếng Việt qua snapshot dịch máy.
Giữ dữ liệu tiếng Anh gốc để đối chiếu; bản dịch chưa được rà soát ngôn ngữ toàn bộ.
Không chứa toàn văn hội thoại, hình ảnh hoặc audio của sách.
Không tự dịch hàng nghìn mục sang tiếng Việt rồi coi là nội dung đã kiểm duyệt.

## Nhập lại dữ liệu

Tải `zerotohero-zh-vocabulary.csv` và `zerotohero-zh-grammar.csv` từ kho nguồn vào `.local/hsk-source/`.
Chạy `python scripts/import-hsk.py`, xem diff và chạy test. Script giữ SHA-256 của hai CSV trong snapshot JSON.
`python scripts/translate-vietnamese.py` tạo/bổ sung snapshot dịch từ các nghĩa công khai còn thiếu.
Script lưu từng lô và dừng khi dịch vụ báo lỗi; chạy lại tiếp tục từ snapshot hiện có.
Tùy chọn `--repair` dịch lại các mục phát hiện còn cụm tiếng Anh thông dụng.
Các bản sửa thuật ngữ đã rà soát nằm trong `data/vietnamese-reviewed.json` và được ưu tiên
hơn dịch máy; sửa file này không cần gọi dịch vụ. Không coi kiểm tra độ phủ là kiểm định ngôn ngữ.
`npm run content:build` áp dụng snapshot `data/vietnamese-translations.json`, giữ nghĩa tiếng Việt
đã biên soạn và dừng nếu thiếu bản dịch. Build không tải mạng hoặc yêu cầu Python khi deploy.
Service worker cache thêm trang courses và dữ liệu JSON cùng phiên bản build.

## Nguyên tắc ghi nhớ

Luyện từ hỗ trợ hai chiều: nhìn chữ nhớ cách đọc/nghĩa, hoặc nhìn nghĩa nhớ chữ/cách đọc.
Người học có thể xáo trộn trước khi bắt đầu; từ chưa nhớ quay lại cuối hàng đợi.
Tổng kết đếm số từ nhớ ngay lần đầu và liệt kê từng từ cần thử lại, không xem đây là điểm thi
hay tự thay lịch FSRS. Trạng thái lượt luyện chỉ tồn tại trong trang và được đặt lại khi đổi nhóm.
Sau tổng kết, học viên có thể ôn riêng các từ vừa sai; lượt mới giữ đúng từ gốc và tính
thống kê riêng. Nút luyện lại nhóm vẫn bắt đầu đủ toàn bộ từ trong nhóm.
Trước khi luyện, học viên có thể chọn từng từ và luyện riêng lựa chọn; đổi nhóm sẽ xóa
lựa chọn cũ. Phần tổng kết cho phép mở lại pinyin/nghĩa của các từ vừa sai ngay tại chỗ.

Luyện truy hồi và ôn cách quãng dựa trên tổng quan Dunlosky và cộng sự (2013):
https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html
Kích thước nhóm 3–5 là lựa chọn UX ban đầu, không phải con số tối ưu được chứng minh cho mọi học viên.
Liên hệ hình là mẹo nhớ, không dùng thay cho giải thích từ nguyên. Cần đo hiệu quả bằng lượt ôn ở những ngày sau.

## Kiểm tra

Trang giáo trình cho phép tìm trong quyển hiện tại bằng số bài chính xác, chữ Hán,
pinyin không dấu, nghĩa và ngữ pháp. Bộ lọc tiến độ dựa trên checklist tự xác nhận;
không dùng nó để suy ra mức ghi nhớ. Đổi quyển hoặc chọn tiếp tục bài sẽ xóa bộ lọc.

`npm run typecheck`, `npm test`, `npm run build`.
Test bao phủ bộ nhỏ, ôn đúng bộ/đúng hạn, đủ 146 bài, thứ tự A/B, thiếu mẫu chữ,
checklist nguyên tử, cách ly tài khoản và nâng cấp v3 lên v4 giữ dữ liệu.
Không mở browser theo yêu cầu người dùng; chưa kiểm tra giao diện trực quan.
