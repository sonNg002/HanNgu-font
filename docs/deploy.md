# Deploy HanNgu

Hệ thống gồm ba phần, deploy theo đúng thứ tự vì frontend cần URL API khi build và API cần domain frontend cho CORS:

| Phần | Repository | Nơi chạy | Địa chỉ |
| --- | --- | --- | --- |
| Đăng nhập, database | — | Firebase Auth, Firestore (`hanngu-91a22`) | console.firebase.google.com |
| API đồng bộ | `hanngu-api` | Google Cloud Run (Dockerfile) | `https://hanngu-api-<mã>.asia-southeast1.run.app` |
| Website | `hanngu-frontend` | Firebase Hosting (thư mục `out/`) | `https://hanngu-91a22.web.app` |

Domain Firebase Hosting đã biết trước nên có thể cấu hình CORS của API trước khi deploy frontend.

## 0. Chuẩn bị

- Node.js 24.12+ (`nvm use` đọc `.nvmrc`).
- Tài khoản Google là owner của project `hanngu-91a22`.
- Firebase CLI:

  ```sh
  npm install -g firebase-tools
  firebase login
  ```

  `hanngu-api` cũng có sẵn CLI trong devDependencies (`npx firebase ...`).
- Code đã merge vào `main` của cả hai repository; Cloud Run và bản build lấy code từ đó.

## 1. Firebase

### 1.1. Gói Blaze

Cloud Run cần billing. Firebase Console → biểu tượng bánh răng → **Usage and billing** → **Modify plan** → **Blaze**. Lượng dùng nhỏ thường nằm trong hạn mức miễn phí. Nên tạo **Budget alert** (ví dụ 5 USD) trong Google Cloud Billing để được báo khi phát sinh chi phí.

### 1.2. Authentication

Firebase Console → **Build → Authentication → Get started → Sign-in method**:

1. **Email/Password** → Enable → Save.
2. **Google** → Enable → chọn **Project support email** → Save.
3. Tab **Settings → Authorized domains**: kiểm tra đã có `localhost`, `hanngu-91a22.firebaseapp.com`, `hanngu-91a22.web.app`. Dùng domain riêng thì thêm domain đó ở đây.

### 1.3. Firestore

1. **Build → Firestore Database → Create database**.
2. Database ID `(default)`, location `asia-southeast1` (Singapore). Location không đổi được sau khi tạo.
3. Chọn **Start in production mode**; rules thật được deploy ở bước sau.
4. Deploy rules và indexes từ `hanngu-api`:

   ```sh
   cd hanngu-api
   npm ci
   npm run firebase:deploy
   ```

   Kiểm tra tab **Rules** trong Firestore đã hiển thị nội dung `firestore.rules`.

## 2. API trên Cloud Run

### 2.1. Biến môi trường

| Biến | Giá trị | Ghi chú |
| --- | --- | --- |
| `NODE_ENV` | `production` | Đã đặt sẵn trong Dockerfile |
| `FIREBASE_PROJECT_ID` | `hanngu-91a22` | Phải trùng project của frontend, nếu không mọi request trả 401 |
| `CORS_ORIGINS` | `https://hanngu-91a22.web.app,https://hanngu-91a22.firebaseapp.com` | Bắt buộc ở production, chỉ nhận HTTPS, không có `/` cuối |
| `RATE_LIMIT_MAX` | `3000` | Xem lưu ý bên dưới |

Không đặt `PORT` (Cloud Run tự cấp 8080) và không đặt `HOST` (production mặc định `0.0.0.0`). Không cần service-account key.

**Rate limit:** API đếm request theo địa chỉ socket. Trên Cloud Run mọi request đi qua proxy của Google nên mọi người dùng chung một bộ đếm; mặc định 120 request/phút sẽ nhanh chóng trả `429 RATE_LIMITED`. Đặt `RATE_LIMIT_MAX` cao (ví dụ 3000) và nếu cần giới hạn theo người dùng thì làm ở gateway.

### 2.2. Cách A: deploy từ GitHub qua Console (không cần cài gì)

1. console.cloud.google.com → chọn project `hanngu-91a22` → **Cloud Run** → **Deploy container** → **Service**.
2. Chọn **Continuously deploy from a repository** → **Set up with Cloud Build**.
3. Kết nối GitHub, chọn repository `sonNg002/HanNgu-api`, branch `^main$`.
4. Build type **Dockerfile**, source location `/Dockerfile` → Save.
5. Service name `hanngu-api`, region `asia-southeast1`.
6. Authentication: **Allow unauthenticated invocations** (API tự xác thực Firebase ID token).
7. Billing: **Request-based**. Scaling: min instances `0`, max instances `3`.
8. **Containers → Variables & Secrets**: thêm các biến ở bảng 2.1. Container port giữ `8080`.
9. **Create**. Mỗi lần push lên `main` của `hanngu-api`, Cloud Build tự build và deploy lại.

### 2.3. Cách B: deploy bằng gcloud CLI

Cài Google Cloud CLI (cloud.google.com/sdk), rồi trong thư mục `hanngu-api`:

```sh
gcloud auth login
gcloud config set project hanngu-91a22
gcloud run deploy hanngu-api --source . --region asia-southeast1 --allow-unauthenticated \
  --set-env-vars "^@^NODE_ENV=production@FIREBASE_PROJECT_ID=hanngu-91a22@RATE_LIMIT_MAX=3000@CORS_ORIGINS=https://hanngu-91a22.web.app,https://hanngu-91a22.firebaseapp.com"
```

`^@^` đổi dấu phân cách của gcloud thành `@` vì `CORS_ORIGINS` chứa dấu phẩy. Lần đầu gcloud sẽ hỏi bật các API Cloud Run, Cloud Build, Artifact Registry: chọn `y`.

### 2.4. Kiểm tra API

Mở `https://<url-cloud-run>/health`, kết quả mong đợi:

```json
{ "ok": true, "project": "hanngu-91a22" }
```

Nếu service không khởi động: Cloud Run → service → **Logs**, tìm `server.config_error`; thông báo chỉ rõ biến môi trường nào sai.

## 3. Frontend trên Firebase Hosting

### 3.1. Cấu hình

Tạo `.env` (hoặc `.env.local`) từ file mẫu:

```sh
cp .env.example .env
```

Sửa dòng API thành URL Cloud Run, không có `/` cuối:

```sh
NEXT_PUBLIC_SYNC_API_URL=https://hanngu-api-<mã>.asia-southeast1.run.app
```

Các biến `NEXT_PUBLIC_FIREBASE_*` trong file mẫu là Web config công khai của `hanngu-91a22`, giữ nguyên. Các biến `NEXT_PUBLIC_*` được đóng vào bundle lúc build: đổi giá trị thì phải build lại. Bản production chỉ nhận URL API HTTPS.

### 3.2. Build

```sh
npm ci
npm test
npm run build
```

`npm run build` sinh dữ liệu từ điển, export trang tĩnh vào `out/` và tạo service worker `out/sw.js`.

Xem thử trước khi đưa lên: `npm start` rồi mở `http://localhost:3000`. Bản build production gọi API thật, nên đăng nhập trên localhost chỉ đồng bộ được khi `CORS_ORIGINS` của API có thêm `http://localhost:3000`; bình thường không cần.

### 3.3. Deploy

```sh
firebase deploy --only hosting
```

`firebase.json` publish thư mục `out/`, giữ dấu `/` cuối URL như `next.config.ts`, không cache `sw.js` để người dùng nhận bản mới, và cache lâu file trong `/_next/static/` (tên file đã có hash). `.firebaserc` chọn project `hanngu-91a22`.

Có thể deploy thử lên kênh preview trước:

```sh
firebase hosting:channel:deploy thu-nghiem
```

URL preview không có trong `CORS_ORIGINS` nên đồng bộ sẽ báo lỗi; chỉ dùng để xem giao diện.

## 4. Kiểm tra sau deploy

1. Mở `https://hanngu-91a22.web.app`, học thử một chữ ở chế độ khách.
2. Đăng nhập bằng Google hoặc Email/Password.
3. DevTools → Network: request tới `<url-cloud-run>/v1/sync/...` trả 200.
4. Học thêm một chữ, mở trang trên thiết bị khác cùng tài khoản: tiến độ xuất hiện sau khi đồng bộ.
5. Firestore Console có document dưới UID của tài khoản.
6. Tắt mạng, tải lại trang: app vẫn chạy nhờ service worker (cần mở online ít nhất một lần).

## 5. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| Console báo lỗi CORS, API trả 403 `ORIGIN_FORBIDDEN` | Domain frontend không có trong `CORS_ORIGINS` | Thêm đúng origin (`https://...`, không `/` cuối), deploy lại API |
| `auth/unauthorized-domain` khi đăng nhập | Domain chưa có trong Authorized domains | Thêm ở Authentication → Settings |
| `auth/operation-not-allowed` | Chưa bật provider | Bật Email/Password hoặc Google ở Sign-in method |
| API trả 401 `UNAUTHENTICATED` | `FIREBASE_PROJECT_ID` của API khác project frontend | Đặt `hanngu-91a22` |
| "Đồng bộ chưa khả dụng" | Build thiếu `NEXT_PUBLIC_SYNC_API_URL` | Đặt biến, build và deploy lại frontend |
| Lỗi URL API phải HTTPS | Build production với URL `http://` | Dùng URL HTTPS của Cloud Run |
| 429 `RATE_LIMITED` khi nhiều người dùng | Bộ đếm dùng chung qua proxy | Tăng `RATE_LIMIT_MAX` |
| 502/504 từ API | Firestore chưa tạo hoặc rules chưa deploy | Làm lại bước 1.3 |
| Người dùng vẫn thấy bản cũ | Service worker giữ cache phiên bản trước | Đóng hết tab rồi mở lại; `sw.js` không bị cache nên lần tải sau sẽ cập nhật |

## 6. Cập nhật về sau

- **API:** push lên `main` của `hanngu-api` (cách A tự deploy) hoặc chạy lại `gcloud run deploy` (cách B). Đổi rules thì chạy lại `npm run firebase:deploy`.
- **Frontend:** `npm run build` rồi `firebase deploy --only hosting`. Bản cũ vẫn khôi phục được ở Firebase Console → Hosting → Release history → Rollback.
- **Domain riêng:** Hosting → Add custom domain, làm theo hướng dẫn DNS; sau đó thêm domain vào Authorized domains và `CORS_ORIGINS`.
