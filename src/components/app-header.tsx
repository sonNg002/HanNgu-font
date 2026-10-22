'use client';

import { NAVIGATION, type AppPage } from '@/lib/navigation';
import { APP_NAME, APP_TAGLINE } from '@/lib/personal';
import { useStudy } from './study-provider';

export function AppHeader({ current, onStudyAction, onSettingsAction }: {
  current: AppPage; onStudyAction?: () => void; onSettingsAction?: () => void;
}) {
  const { authReady, online, user, status } = useStudy();
  // Chỉ xác nhận đồng bộ khi có một lần thành công, tránh hiểu nhầm hàng đợi rỗng là đã sao lưu.
  const message = !authReady ? 'Đang mở dữ liệu học…' : !online ? 'Đang ngoại tuyến · tiến độ lưu trên thiết bị'
    : status.phase === 'error' ? 'Chưa đồng bộ được · tiến độ vẫn ở thiết bị'
    : !user ? 'Học trên thiết bị · đăng nhập để đồng bộ'
    : status.phase === 'syncing' ? 'Đang đồng bộ tiến độ…'
    : status.pending ? `${status.pending} thay đổi chờ đồng bộ`
    : status.lastSyncedAt ? 'Đã đồng bộ tiến độ' : 'Tiến độ đang lưu trên thiết bị';
  return <>
    <a className="skip-link" href="#page-content">Đến nội dung chính</a>
    <header className="topbar">
      <a href="/" className="brand"><span className="brand-mark">字</span><span>{APP_NAME}<small>{APP_TAGLINE}</small></span></a>
      {current === 'study' && <a className="mobile-jump" href="#today-plan">Bộ học ↓</a>}
      <nav aria-label="Điều hướng chính">{NAVIGATION.map(item => {
        const action = item.page === 'study' ? onStudyAction : item.page === 'settings' ? onSettingsAction : undefined;
        return action ? <button key={item.page} className={`nav-button ${current === item.page ? 'active' : ''}`}
          aria-pressed={current === item.page} onClick={action}>{item.label}</button>
          : <a key={item.page} href={item.href} className={current === item.page ? 'active' : undefined}
            aria-current={current === item.page ? 'page' : undefined}>{item.label}</a>;
      })}</nav>
    </header>
    <div className="connection-strip"><p role="status"><span className={`connection-dot ${!online || status.phase === 'error' ? 'attention' : ''}`} aria-hidden="true" />{message}</p>
      {current !== 'settings' && <a href="/?view=settings">Tài khoản & nhịp học →</a>}
    </div>
  </>;
}
