'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLiveQuery } from 'dexie-react-hooks';
import { databaseForUser, type StudyDatabase } from '@/lib/db';
import { firebaseConfigured, getFirebase } from '@/lib/firebase';
import { ApiTransport } from '@/lib/api-transport';
import { SyncService, type SyncStatus } from '@/lib/sync';

interface StudyContext {
  database: StudyDatabase | null; user: User | null; authReady: boolean;
  status: SyncStatus; syncNow: () => Promise<void>; online: boolean;
}
const Context = createContext<StudyContext | null>(null);
export function StudyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [database, setDatabase] = useState<StudyDatabase | null>(null);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<SyncStatus>({ phase: 'idle', pending: 0 });
  const [service, setService] = useState<SyncService | null>(null);
  const pending = useLiveQuery(async () => {
    if (!database) return 0;
    const counts = await Promise.all([database.cards, database.reviews, database.settings]
      .map(table => table.where('dirty').equals(1).count()));
    return counts.reduce((sum, count) => sum + count, 0);
  }, [database], 0);

  useEffect(() => {
    // Chờ Auth khôi phục trước khi mở DB, tránh ghi nhầm vào kho khách lúc reload.
    if (!firebaseConfigured) {
      setDatabase(databaseForUser(null)); setAuthReady(true); return;
    }
    return onAuthStateChanged(getFirebase().auth, account => {
      setUser(account); setDatabase(databaseForUser(account?.uid ?? null)); setAuthReady(true);
    }, error => {
      setStatus({ phase: 'error', pending: 0, message: error.message }); setAuthReady(true);
    });
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    setStatus({ phase: 'idle', pending: 0 });
    if (!database || !user) { setService(null); return; }
    // Chỉ dùng API được cấu hình; thiếu URL vẫn giữ tiến độ local, không gọi localhost khi deploy.
    const apiUrl = process.env.NEXT_PUBLIC_SYNC_API_URL?.trim();
    if (!apiUrl) {
      setService(null);
      setStatus({ phase: 'error', pending: 0, message: 'Đồng bộ chưa khả dụng. Tiến độ vẫn được lưu trên thiết bị.' });
      return;
    }
    let active = true;
    const next = new SyncService(database, new ApiTransport(user, apiUrl),
      value => { if (active) setStatus(value); });
    setService(next);
    void next.sync();
    // Sync định kỳ và khi quay lại app; pagehide chỉ best effort, hàng đợi Dexie bảo đảm retry.
    const timer = window.setInterval(() => { void next.sync(); }, 60_000);
    const visibility = () => { void next.sync(); };
    window.addEventListener('online', visibility);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', visibility);
    return () => {
      active = false; next.stop(); window.clearInterval(timer);
      window.removeEventListener('online', visibility);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', visibility);
    };
  }, [database, user]);
  useEffect(() => {
    // Khoảng 20 thao tác dirty kích hoạt flush; biến pending đến từ live query nhiều tab.
    if (pending >= 20 && service) void service.sync();
  }, [pending, service]);
  const value = useMemo(() => ({ database, user, authReady, online,
    status: { ...status, pending }, syncNow: () => service?.sync() ?? Promise.resolve() }),
  [database, user, authReady, online, status, pending, service]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStudy() {
  const value = useContext(Context);
  if (!value) throw new Error('useStudy cần StudyProvider.');
  return value;
}
