import type { Metadata, Viewport } from 'next';
import { StudyProvider } from '@/components/study-provider';
import './globals.css';
export const metadata: Metadata = { title: 'Hán ngữ · Học từng chữ', description: 'Học chữ Hán offline với FSRS và đồng bộ tiến độ qua Firebase.' };
// Cho thanh điều hướng tôn trọng vùng an toàn trên iPhone, đồng bộ màu thanh trình duyệt với nền học.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f4f6f0' };
// Server layout chỉ bọc provider; IndexedDB/Auth được mở trong effect ở phía client.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body><StudyProvider>{children}</StudyProvider></body></html>;
}
