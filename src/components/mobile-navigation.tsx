'use client';

import { useEffect, useRef, useState } from 'react';

type Page = 'study' | 'dictionary' | 'progress' | 'settings';

function NavigationIcon({ page }: { page: Page }) {
  // SVG tại chỗ giữ biểu tượng rõ ở mọi mật độ màn hình và không cần tải thư viện/CDN.
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {page === 'study' ? <><path d="M4 4.5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z" /><path d="M12 5.5v15M7 8h2M7 11h2M15 8h2M15 11h2" /></>
      : page === 'dictionary' ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5M8 8h5M10.5 8v5M8.5 11h4" /></>
      : page === 'progress' ? <path d="M4 20h16M7 16v-4M12 16V7M17 16v-7" />
        : <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="var(--white)" /><circle cx="16" cy="12" r="2" fill="var(--white)" /><circle cx="10" cy="18" r="2" fill="var(--white)" /></>}
  </svg>;
}

export function MobileNavigation({ current, onStudyAction, onSettingsAction }: {
  current: Page; onStudyAction?: () => void; onSettingsAction?: () => void;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewportSize = useRef({ height: 0, width: 0 });
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      // Chỉ thu gọn khi bàn phím thật làm viewport thấp đi; focus bằng bàn phím máy tính vẫn giữ nav.
      if (viewport.width !== viewportSize.current.width || viewport.height > viewportSize.current.height) {
        viewportSize.current = { width: viewport.width, height: viewport.height };
      }
      const editing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      setKeyboardOpen(editing && viewportSize.current.height - viewport.height > 140);
    };
    update(); viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => { viewport.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); };
  }, []);
  const items = [{ page: 'study' as const, label: 'Học tập', href: '/', action: onStudyAction },
    { page: 'dictionary' as const, label: 'Từ điển', href: '/browse/' },
    { page: 'progress' as const, label: 'Tiến độ', href: '/progress/' },
    { page: 'settings' as const, label: 'Nhịp học', href: '/?view=settings', action: onSettingsAction }];
  return <nav className={`mobile-navigation ${keyboardOpen ? 'keyboard-hidden' : ''}`} aria-label="Điều hướng trên điện thoại">
    {items.map(item => item.action ? <button key={item.page} className={current === item.page ? 'active' : ''}
      aria-pressed={current === item.page} onClick={item.action}><NavigationIcon page={item.page} /><span>{item.label}</span></button>
      : <a key={item.page} className={current === item.page ? 'active' : ''} aria-current={current === item.page ? 'page' : undefined}
        href={item.href}><NavigationIcon page={item.page} /><span>{item.label}</span></a>)}
  </nav>;
}
