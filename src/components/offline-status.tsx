'use client';
import { useEffect, useState } from 'react';
import { observeOffline, type OfflineStatus as Status } from '@/lib/offline-status';

export function OfflineStatus() {
  const [status, setStatus] = useState<Status | 'unsupported' | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    // Đặt ở layout chung để vào thẳng giáo trình/từ điển cũng bắt đầu tải gói offline.
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    return observeOffline(navigator.serviceWorker, setStatus);
  }, [retry]);
  if (!status) return null;
  return <div className="offline-status"><p role="status">{status === 'ready' ? 'Đã tải gói học offline trên thiết bị này.'
    : status === 'preparing' ? 'Đang chuẩn bị gói học offline. Giữ kết nối đến khi hoàn tất.'
    : status === 'unsupported' ? 'Trình duyệt này chưa hỗ trợ tải gói học offline.'
    : 'Chưa tải xong gói học offline. Hãy kiểm tra kết nối và dung lượng thiết bị.'}</p>
    {status === 'error' && <button className="secondary" onClick={() => setRetry(value => value + 1)}>Thử tải lại gói offline</button>}
  </div>;
}
