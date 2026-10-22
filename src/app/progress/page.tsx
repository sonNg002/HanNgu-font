import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/personal';
import { ProgressDashboard } from '@/components/progress-dashboard';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: `Tiến độ · ${APP_NAME}` };
// Trang tĩnh; thống kê tính ở client từ IndexedDB của tài khoản hiện tại.
export default function Progress() {
  return <ProgressDashboard />;
}
