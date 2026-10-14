# Thiết kế cách học cân bằng

## Capability

Học viên Việt Nam học từng nhóm chữ, hiểu hình và nghĩa, tự gọi lại âm đọc, viết từ trí nhớ, rồi nhận ra chữ trong từ. Mỗi bài có một bước đang hoạt động và một hành động tiếp theo. Không ép ôn thẻ tự chấm giữa các chữ mới.

## Constraints

- Ưu tiên kho biên soạn tiếng Việt khi còn chữ cơ bản chưa học. Không tự dịch hay gán nguồn gốc lịch sử cho mẹo nhớ.
- Pinyin phải đúng thanh điệu; nhận cả dấu thanh và số 1–5, `v`/`u:` cho `ü`. Hán Việt nhận các cách đọc đã có trong từ điển, giữ dấu tiếng Việt.
- Câu trả lời sai được sửa tại bước đó. Có thể xem lại bài hiểu và nghe lại trước khi thử tiếp.
- Bộ gợi ý thu gọn khi luyện nhớ để đáp án không nằm ngay trên màn hình; học viên có thể chủ động mở lại.
- Chỉ lưu sau khi hoàn tất các bước và có kết quả tự viết hợp lệ. Transaction vẫn kiểm hạn mức/ngăn trùng, lưu ba thẻ ôn và kết quả viết.
- Điểm FSRS viết phản ánh bài viết; không trộn lỗi Pinyin vào điểm viết. Các lần luyện âm/điền từ là bài tập trong phiên, chưa phải log FSRS.
- Audio dùng giọng Mandarin có trên thiết bị. Không có giọng thì hiện Pinyin và hướng dẫn đọc; không giả vờ đã kiểm tra phát âm bằng micro.

## Implementation contract

Actor: học viên khách hoặc tài khoản hiện tại. Surface: trang học chữ mới, bộ gợi ý ngày, màn ôn hiện có.

| Trạng thái | Nhiệm vụ | Điều kiện tiếp theo |
| --- | --- | --- |
| Hiểu | Nhìn chữ, nghĩa, Pinyin/Hán Việt, thành phần, mẹo nhớ; đọc thành tiếng | Học viên bắt đầu thử nhớ |
| Nhớ âm | Nhìn chữ, nhập Pinyin và Hán Việt khi đáp án ẩn | Hai đáp án khớp từ điển |
| Viết | Viết theo mẫu rồi tự viết trên ô trống | Hanzi Writer trả kết quả tự viết đầy đủ |
| Dùng | Điền chữ vào từ/câu có dịch nghĩa; đọc và liên hệ bản thân | Đáp án đúng; nếu chưa có ví dụ, xác nhận đã tự đặt liên hệ |
| Lưu | Lưu chữ, mẹo nhớ và bài viết trong transaction | Live query chuyển sang chữ tiếp theo |

Inputs: `Character`, `Content.words`, nhóm chữ hiện tại. Outputs: `WritingResult` và mnemonic cho `introduceCharacter`; không đổi schema đồng bộ/API. IndexedDB v3 bổ sung bảng `lessonDrafts` riêng trên từng kho tài khoản, tự lưu bước học, câu trả lời, mẹo nhớ và bài tự viết đã hoàn tất. Tải lại khôi phục bước hợp lệ; các nét đang viết dở trong một lượt quiz chưa được khôi phục. Hoàn thành chữ xóa bản dở cùng transaction; autosave đến trễ không tạo lại bản dở đã hoàn thành.

Giao diện: bài học là vùng chính ở trái trên desktop, bộ gợi ý và hỗ trợ ở phải. Mobile đưa bài học lên trước phần đổi bộ và tài khoản để vào bài nhanh; thanh điều hướng đáy mở Học tập/Từ điển/Nhịp học. Thanh tiến độ ngày dùng số chữ đã lưu thực tế; không đưa tỷ lệ nhớ hoặc điểm phát âm chưa đo. Có thể chọn từng chữ trong preview và tiếp tục một trong ba bài dở gần nhất. Màu xanh cho hành động chính, màu ấm cho liên hệ nhớ; các nút có vùng chạm tối thiểu 40px, có focus rõ và tôn trọng giảm chuyển động. Form mobile dùng font 16px, đáy trang chừa vùng an toàn và thanh điều hướng thu gọn khi nhập đáp án.

Kiểm chứng: kiểm tra chuẩn hóa Pinyin/thanh điệu, các cách đọc Hán Việt, tạo bài điền từ đúng dữ liệu, ưu tiên chữ biên soạn và ổn định gợi ý trong ngày; kiểm tra giữ bài dở, xóa bản dở và migration v2/v3; chạy TypeScript, build và kiểm tra giao diện mobile/desktop.

## Non-goals

Chấm phát âm bằng micro, tuyên bố một phương pháp tốt nhất cho mọi người, tự tạo ví dụ/ngữ nguyên chưa kiểm duyệt, sửa lịch ôn thành các mốc cứng.

## Open questions

Không có quyết định chặn bản đầu. Các bước tiếp theo cần dữ liệu: dịch/kiểm duyệt kho 3.000 chữ và ví dụ; đo tỷ lệ nhớ sau 1/7/30 ngày để điều chỉnh nhịp học và độ khó.

## Handoff

Sẵn sàng triển khai trực tiếp trong frontend. Giữ FSRS hiện có cho lịch cá nhân hóa; ứng dụng chỉ hiển thị bài tập của kỹ năng đang học.
