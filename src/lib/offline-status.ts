export type OfflineStatus = 'preparing' | 'ready' | 'error';

export function observeOffline(container: Pick<ServiceWorkerContainer, 'register'>, report: (status: OfflineStatus) => void) {
  let stopped = false;
  const cleanups: (() => void)[] = [];
  const publish = (status: OfflineStatus) => { if (!stopped) report(status); };
  publish('preparing');
  void container.register('/sw.js').then(registration => {
    if (stopped) return;
    const watched = new Set<ServiceWorker>();
    const update = () => {
      // Chỉ báo sẵn sàng sau activate: install phải cache xong toàn bộ gói học trước đó.
      // Khi cập nhật thất bại, bản active cũ vẫn có thể phục vụ học ngoại tuyến.
      const pending = registration.installing ?? registration.waiting;
      if (pending && pending.state !== 'redundant' || registration.active?.state === 'activating') publish('preparing');
      else if (registration.active?.state === 'activated') publish('ready');
      else publish('error');
    };
    const watch = () => {
      for (const worker of [registration.installing, registration.waiting, registration.active]) {
        if (!worker || watched.has(worker)) continue;
        watched.add(worker);
        worker.addEventListener('statechange', update);
        cleanups.push(() => worker.removeEventListener('statechange', update));
      }
      update();
    };
    registration.addEventListener('updatefound', watch);
    cleanups.push(() => registration.removeEventListener('updatefound', watch));
    watch();
  }).catch(() => publish('error'));
  // React Strict Mode và chuyển trang không được để callback cũ cập nhật component đã bỏ.
  return () => { stopped = true; cleanups.forEach(cleanup => cleanup()); };
}
