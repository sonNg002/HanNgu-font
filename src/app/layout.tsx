import type { Metadata } from 'next';
import { StudyProvider } from '@/components/study-provider';
import './globals.css';
export const metadata: Metadata = { title: 'Hán ngữ · Học từng chữ', description: 'Học chữ Hán offline với FSRS và đồng bộ tiến độ qua Firebase.' };
// Server layout chỉ bọc provider; IndexedDB/Auth được mở trong effect ở phía client.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body><StudyProvider>{children}</StudyProvider></body></html>;
}