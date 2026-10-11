import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Frontend chỉ dùng Firebase Auth; Firestore được truy cập qua API riêng.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(Boolean);
let client: { auth: ReturnType<typeof getAuth> } | undefined;
export function getFirebase() {
  if (typeof window === 'undefined') throw new Error('Firebase chỉ khởi tạo trên trình duyệt.');
  if (!firebaseConfigured) throw new Error('Chưa cấu hình Firebase. Bạn vẫn có thể học trên thiết bị.');
  if (!client) {
    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    client = { auth };
  }
  return client;
}
