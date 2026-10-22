import type { Metadata, Viewport } from 'next';
import { StudyProvider } from '@/components/study-provider';
import { OfflineStatus } from '@/components/offline-status';
import { APP_NAME } from '@/lib/personal';
import './globals.css';
export const metadata: Metadata = { title: APP_NAME, description: 'Ly học chữ Hán mỗi ngày: học, luyện viết và ôn lại.' };
// Cho thanh điều hướng tôn trọng vùng an toàn trên iPhone, đồng bộ màu thanh trình duyệt với nền học.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f4f6f0' };
// Server layout chỉ bọc provider; IndexedDB/Auth được mở trong effect ở phía client.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body><StudyProvider>{children}<OfflineStatus /></StudyProvider></body></html>;
}
