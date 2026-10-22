'use client';

import { NAVIGATION, type AppPage } from '@/lib/navigation';
import { APP_NAME, APP_TAGLINE } from '@/lib/personal';
import { useStudy } from './study-provider';

export function AppHeader({ current, onStudyAction, onSettingsAction }: {
  current: AppPage; onStudyAction?: () => void; onSettingsAction?: () => void;
}) {
  const { authReady, online, status } = useStudy();
  // Chỉ báo khi cần chú ý; trạng thái bình thường xem ở tab Nhịp học để đầu trang gọn.
  const notice = !authReady ? '' : !online ? 'Đang ngoại tuyến · tiến độ vẫn lưu trên thiết bị'
    : status.phase === 'error' ? 'Chưa đồng bộ được · tiến độ vẫn ở thiết bị' : '';
  return <>
    <a className="skip-link" href="#page-content">Đến nội dung chính</a>
    <header className="topbar">
      <a href="/" className="brand"><span className="brand-mark">字</span><span>{APP_NAME}<small>{APP_TAGLINE}</small></span></a>
      <nav aria-label="Điều hướng chính">{NAVIGATION.map(item => {
        const action = item.page === 'study' ? onStudyAction : item.page === 'settings' ? onSettingsAction : undefined;
        return action ? <button key={item.page} className={`nav-button ${current === item.page ? 'active' : ''}`}
          aria-pressed={current === item.page} onClick={action}>{item.label}</button>
          : <a key={item.page} href={item.href} className={current === item.page ? 'active' : undefined}
            aria-current={current === item.page ? 'page' : undefined}>{item.label}</a>;
      })}</nav>
    </header>
    {notice && <div className="connection-strip"><p role="status"><span className="connection-dot attention" aria-hidden="true" />{notice}</p>
      {current !== 'settings' && <a href="/?view=settings">Xem tài khoản →</a>}
    </div>}
  </>;
}
