import type { Metadata } from 'next';
import { ProgressDashboard } from '@/components/progress-dashboard';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Tiến độ · Hán ngữ' };
// Trang tĩnh; thống kê tính ở client từ IndexedDB của tài khoản hiện tại.
export default function Progress() {
  return <ProgressDashboard />;
}
