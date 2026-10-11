# HanNgu frontend

Giao diện Next.js học 3.000 chữ Hán, tra cứu 195 nhóm bộ thủ, luyện viết từng nét và ôn theo FSRS. Dexie lưu tiến độ offline; Firebase Authentication đăng nhập, API trong repository `hanngu-api` đồng bộ tiến độ.

## Cấu hình

Cần Node.js 22.14+.

```sh
npm ci
cp .env.example .env.local
```

PowerShell dùng `Copy-Item .env.example .env.local`. File mẫu chứa Firebase Web config công khai của `hanngu-91a22`; thay các giá trị trong `.env.local` nếu dùng dự án Firebase khác.

Đặt `NEXT_PUBLIC_SYNC_API_URL` thành URL HTTPS của API thật trước khi build bản deploy. Khi phát triển trên máy, có thể đặt `http://localhost:8080` và chạy API trong terminal riêng. Các biến `NEXT_PUBLIC_*` được đóng vào bundle lúc build; thay đổi cấu hình cần build lại.

Bật Email/Password và Google trong Firebase Authentication, thêm domain frontend vào Authorized domains và cấu hình CORS của API cho domain đó. Không thêm service-account/private key vào frontend.

Nếu thiếu cấu hình Firebase, ứng dụng vẫn học ở chế độ khách. Nếu thiếu URL API hoặc API mất kết nối, tiến độ được giữ trong IndexedDB; hàng đợi đồng bộ không bị xóa. Mỗi UID có kho riêng, không tự nhập tiến độ khách vào tài khoản.

## Chạy local

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

CI chạy các kiểm tra trên Node 22 và tạo artifact `static-website` chỉ chứa `out/`. Các file source/test/config phục vụ phát triển và build; chỉ upload `out/` lên hosting tĩnh. Test bảo vệ retry token, lỗi network/timeout, cursor và điều kiện ack batch.
