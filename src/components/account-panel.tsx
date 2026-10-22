'use client';

import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword,
  signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, getFirebase } from '@/lib/firebase';
import { useStudy } from './study-provider';

export function AccountPanel() {
  const { user, authReady, status, online, syncNow } = useStudy();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function execute(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); setPassword(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể đăng nhập.'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    // Auth SDK quản lý token; không lưu mật khẩu hoặc credential trong IndexedDB.
    void execute(() => register
      ? createUserWithEmailAndPassword(getFirebase().auth, email, password)
      : signInWithEmailAndPassword(getFirebase().auth, email, password));
  }
  return <section className="panel account">
    <h2>Tài khoản & đồng bộ</h2>
    <p role="status">{!online ? 'Đang offline · tiến độ lưu trên thiết bị' : status.phase === 'syncing'
      ? 'Đang đồng bộ…' : user ? `${status.pending} thay đổi đang chờ đồng bộ` : 'Chế độ học trên thiết bị'}</p>
    {status.message && <p role="alert" className="error">{status.message}</p>}
    {/* Thu gọn tài khoản để bài học và bộ gợi ý là nội dung chính; form đăng nhập vẫn dễ mở khi cần. */}
    <details><summary>{user ? 'Quản lý tài khoản' : 'Đăng nhập để đồng bộ'}</summary>
    {!firebaseConfigured ? <p className="muted">Đăng nhập chưa khả dụng. Bạn vẫn có thể học trên thiết bị.</p>
      : !authReady ? <p>Đang khôi phục tài khoản…</p>
      : user ? <>
        <p>{user.displayName || user.email}</p>
        {status.lastSyncedAt && <p className="muted">Đồng bộ gần nhất: {new Date(status.lastSyncedAt).toLocaleTimeString('vi-VN')}</p>}
        <div className="actions"><button disabled={busy || !online || status.phase === 'syncing'} onClick={() => void syncNow()}>Đồng bộ ngay</button>
          <button className="secondary" disabled={busy} onClick={() => void execute(async () => {
            // Flush best effort; dirty vẫn ở DB riêng của UID nếu mất mạng khi đăng xuất.
            void syncNow(); await signOut(getFirebase().auth);
          })}>Đăng xuất</button></div>
      </> : <>
        <button disabled={busy || !online} onClick={() => void execute(() => signInWithPopup(getFirebase().auth, new GoogleAuthProvider()))}>Tiếp tục với Google</button>
        <form onSubmit={submit}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label>Mật khẩu<input type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password}
            onChange={event => setPassword(event.target.value)} minLength={6} required /></label>
          <button disabled={busy || !online}>{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        <button className="text-button" onClick={() => setRegister(value => !value)}>{register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}</button>
        <p className="muted">Tiến độ khách và mỗi tài khoản được lưu riêng trên thiết bị.</p>
      </>}
    {error && <p role="alert" className="error">{error}</p>}
    </details>
  </section>;
}
