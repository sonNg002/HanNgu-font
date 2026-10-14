# HanNgu frontend

Giao diện Next.js học 3.000 chữ Hán, tra cứu 195 nhóm bộ thủ, luyện viết từng nét và ôn theo FSRS. Dexie lưu tiến độ offline; Firebase Authentication đăng nhập, API trong repository `hanngu-api` đồng bộ tiến độ.

## Cấu hình

Cần Node.js 24.12+ (Firebase 13 yêu cầu); `.nvmrc` ghi phiên bản dùng cho nvm và CI.

```sh
npm ci
cp .env.example .env.local
```

PowerShell dùng `Copy-Item .env.example .env.local`. File mẫu chứa Firebase Web config công khai của `hanngu-91a22`; thay các giá trị trong `.env.local` nếu dùng dự án Firebase khác.

Đặt `NEXT_PUBLIC_SYNC_API_URL` thành URL HTTPS của API thật trước khi build bản deploy. Khi phát triển trên máy, có thể đặt `http://localhost:8080` và chạy API trong terminal riêng. Các biến `NEXT_PUBLIC_*` được đóng vào bundle lúc build; thay đổi cấu hình cần build lại.

Bật Email/Password và Google trong Firebase Authentication, thêm domain frontend vào Authorized domains và cấu hình CORS của API cho domain đó. Không thêm service-account/private key vào frontend.

Nếu thiếu cấu hình Firebase, ứng dụng vẫn học ở chế độ khách. Nếu thiếu URL API hoặc API mất kết nối, tiến độ được giữ trong IndexedDB; hàng đợi đồng bộ không bị xóa. Mỗi UID có kho riêng, không tự nhập tiến độ khách vào tài khoản.

## Chạy local

<!-- Học và ôn có hàng đợi riêng để không chen thẻ tự chấm sau khi học một chữ mới. -->
Trang chủ tự đề xuất một bộ chữ theo chủ đề hoặc bộ thủ mỗi ngày, dựa trên thứ tự HSK/chữ cơ bản và mục tiêu chữ mới. Bộ gợi ý giữ nguyên trong ngày sau khi lưu chữ; ngày mới loại các chữ đã học và xoay nhóm. Có thể đổi chủ đề, bộ thủ hoặc chọn chữ trong từ điển.

Trong **Học chữ mới**, học theo bốn bước **Hiểu chữ → Nhớ âm → Viết chữ → Dùng trong từ**. Bài học hiện hình chữ, thành phần và mẹo nhớ; kiểm tra Pinyin/Hán Việt; luyện viết theo mẫu rồi tự viết; điền chữ vào từ có sẵn. Pinyin nhận dấu hoặc số thanh, giữ thanh điệu và phân biệt `u`/`ü`. Audio sử dụng giọng Mandarin của thiết bị khi có. Kho biên soạn tiếng Việt được ưu tiên cho người mới.

Hoàn thành bài rồi bấm **Lưu và học chữ tiếp theo**. Kết quả viết được chấm tự động và lưu cùng tiến độ. Thẻ nhận mặt chữ/Hán Việt được giữ cho hoạt động **Ôn tập**; các nút Quên/Khó/Tốt/Dễ chỉ xuất hiện trong phiên ôn trí nhớ. Thẻ đến hạn không chặn học tiếp trong hạn mức ngày.

<!-- Bài dở được lưu local theo UID để không lẫn với tiến độ đã hoàn thành hoặc tài khoản khác. -->
Bước học, câu trả lời, mẹo nhớ và bài viết đã hoàn tất được tự lưu trong IndexedDB; tải lại có thể tiếp tục. Các nét đang viết dở trong quiz cần viết lại. Bộ gợi ý cho phép chọn từng chữ; phần **Tiếp tục từ chỗ dừng** mở lại các bài gần nhất. Bài dở chỉ lưu trên thiết bị hiện tại, còn thẻ đã học/lịch ôn vẫn đồng bộ như trước. Xem [thiết kế cách học](docs/learning-method.md) và [mục tiêu sản phẩm](PRODUCT-BRIEF.md).

Trang **Tiến độ** (`/progress/`) tính từ IndexedDB của tài khoản hiện tại: chuỗi ngày học, tỷ lệ nhớ 90 ngày theo khoảng cách ôn (khoảng 1 ngày/1 tuần/1 tháng) và theo kỹ năng, lượt ôn 30 ngày, thẻ đến hạn 7 ngày tới và chữ hay quên. Lượt ôn cách lần gặp trước dưới 12 giờ không tính vào tỷ lệ nhớ; chữ vững là chữ có độ ổn định FSRS từ 21 ngày ở cả ba kỹ năng. Công thức nằm trong `src/lib/progress.ts`.

```sh
npm run dev
```

Frontend chạy tại `http://localhost:3000`.

## Build và deploy

```sh
npm test
npm run build
npm run typecheck
```

<!-- Build cần dependency phát triển để sinh từ điển và mẫu nét; chỉ thư mục out được đưa lên hosting. -->
Cài đầy đủ dependency khi build. `predev` và `build` tự sinh `public/data` từ `data/corpus.json`, `data/starter.json` và `hanzi-writer-data`. Dữ liệu, mẫu nét và license là tài nguyên ứng dụng cần dùng khi deploy. Xem `data/README.md` để biết nguồn dữ liệu và giới hạn chất lượng.

Build xuất website tĩnh vào `out/`. Cấu hình hosting với build command `npm run build` và thư mục publish `out`. Đặt các biến môi trường trước khi chạy build trên hosting.

Xem thử bản đã build bằng:

```sh
npm start
```

Service worker cache giao diện và mẫu nét sau lần truy cập online đầu tiên. Không xóa storage nếu còn tiến độ chưa đồng bộ.

## Đồng bộ

Frontend gọi `/v1/sync` của API với Firebase ID token. Pull phân trang trước push; batch tối đa 450 writes. Metadata revision giữ thay đổi phát sinh trong lúc commit; cursor dùng timestamp server, replay ranh giới cùng mili giây. Log có UUID ổn định để retry không nhân đôi. Settings, mnemonic, FSRS và log viết được khôi phục trên thiết bị mới.

Batch giảm số request; chi phí Firestore vẫn tính theo từng document. LWW có thể mất một nhánh lịch ôn nếu hai thiết bị học cùng thẻ offline; log của cả hai vẫn giữ.

## Base frontend

`src/lib/api/client.ts` là HTTP client chung: Bearer token, timeout, mã lỗi, request ID và refresh token một lần khi API trả 401. `src/lib/api-transport.ts` ánh xạ endpoint đồng bộ và kiểm tra response trước khi cập nhật IndexedDB hoặc ack queue. `src/lib/sync.ts` giữ nghiệp vụ pull/push, phân trang, LWW và revision. `StudyProvider` nối Auth, database và lifecycle của React.

Thêm API mới bằng cách dùng `ApiClient` trong transport/service của tính năng; component dùng provider/hook thay vì gọi `fetch` và quản lý token trực tiếp. API server phải cho phép origin frontend bằng `CORS_ORIGINS`. Khi build production, URL API cần HTTPS. URL sai được hiển thị dưới dạng lỗi đồng bộ và ứng dụng tiếp tục lưu tiến độ local.

```sh
npm test
npm run build
npm run typecheck
```

CI chạy các kiểm tra trên Node 24 và tạo artifact `static-website` chỉ chứa `out/`. Các file source/test/config phục vụ phát triển và build; chỉ upload `out/` lên hosting tĩnh. Test bảo vệ retry token, lỗi network/timeout, cursor và điều kiện ack batch; `tests/sync.test.ts` kiểm tra pull phân trang, LWW, ack theo revision, chia batch và giữ hàng đợi khi lỗi.
