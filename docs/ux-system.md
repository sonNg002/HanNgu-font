# Hệ thống trải nghiệm Hán ngữ

## Kiến trúc hiện tại

Next.js export HTML tĩnh; component client đọc dữ liệu học qua StudyProvider và Dexie.
Nghiệp vụ học, lịch ôn FSRS và đồng bộ nằm trong `src/lib`; component không gọi Firestore trực tiếp.
API riêng đi theo route → controller → service → repository; Firebase xác thực chủ sở hữu dữ liệu.

Tiến độ được ghi vào kho cục bộ của khách hoặc UID trước khi đồng bộ. Bộ lọc từ điển chỉ là trạng thái URL,
không được ghi vào tiến độ hoặc hàng đợi đồng bộ. Không đổi schema IndexedDB trong nâng cấp này.

## Thành phần chung

- `src/lib/navigation.ts`: nguồn duy nhất cho nhãn và URL của desktop/mobile.
- `AppHeader`: thương hiệu, điều hướng, liên kết bỏ qua điều hướng và trạng thái kết nối.
- `MobileNavigation`: dùng cùng cấu hình, thu gọn khi bàn phím điện thoại mở.
- `catalog-view.ts`: parse/serialize URL, lọc và sắp xếp độc lập React, có unit test.
- `DictionaryBrowser`: quản lý tương tác và phân trang, tối đa 60 chữ mỗi trang.

## Quy ước thiết kế

Giữ bảng màu giấy, mực và xanh lá hiện tại để không thay đổi nhận diện. Màu xanh dành cho thao tác chính;
màu ấm cho trạng thái cần chú ý; lỗi luôn có thông báo chữ. Trạng thái lưu cục bộ không đồng nghĩa đã sao lưu.

CSS custom properties trong `globals.css` cung cấp màu, bán kính control/panel, khoảng cách và focus ring.
Màn hình mới tái sử dụng `.panel`, `.secondary`, `.actions`, `.muted` và header chung.
Không dùng màu làm tín hiệu duy nhất. Nút có vùng chạm tối thiểu 44px; focus bàn phím nhìn thấy rõ.
Từ điển đổi trang đưa focus về tiêu đề kết quả, hỗ trợ người dùng bàn phím; cuộn luyện viết tôn trọng reduced motion.

## Luồng và phản hồi

- Học tập ↔ Nhịp học cập nhật URL và hỗ trợ Back/Forward; reload giữ màn hình đã chọn.
- Từ điển giữ query, bộ thủ, HSK, thứ tự và trang trong URL; đổi bộ lọc quay về trang đầu.
- Không có kết quả: hướng dẫn nới bộ lọc và một nút xem toàn bộ từ điển.
- Lưu nhịp học: khóa nút trong khi lưu, hiển thị thành công hoặc lỗi, giữ thông báo sau khi Dexie cập nhật.
- Header chỉ nói đã đồng bộ khi đã có lần sync thành công và không còn thay đổi chờ gửi.

## Kiểm chứng

Chạy `npm run typecheck`, `npm test`, `npm run build`.
Test bộ lọc kiểm tra tổ hợp điều kiện, tìm không dấu, round-trip URL, input không hợp lệ và không sửa kho gốc.
Chưa đánh giá trực quan hoặc chấm điểm khả năng tiếp cận bằng browser; người dùng yêu cầu không tự mở browser.
Khi kiểm tra thủ công, ưu tiên màn hình 360px, 768px và desktop, bàn phím, offline và khôi phục bộ lọc từ link.
# Trạng thái tải offline

Layout chung đăng ký service worker ở bản production để mọi trang vào trực tiếp đều tải gói học.
Thông báo phân biệt đang chuẩn bị, đã kích hoạt, lỗi và trình duyệt không hỗ trợ; lỗi có nút thử lại.
Kích hoạt worker xảy ra sau khi cache xong gói tài nguyên. Trạng thái này khác với đồng bộ tiến độ
tài khoản và không bảo đảm trình duyệt sẽ giữ cache vĩnh viễn khi thiếu dung lượng.
Observer hủy listener khi unmount; cập nhật thất bại vẫn giữ trạng thái sẵn sàng của worker cũ đang active.

