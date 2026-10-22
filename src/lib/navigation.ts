export type AppPage = 'study' | 'courses' | 'dictionary' | 'progress' | 'settings';

// Một nguồn điều hướng cho desktop và mobile để nhãn, URL không bị lệch giữa các trang.
export const NAVIGATION = [
  { page: 'study', label: 'Học tập', href: '/' },
  { page: 'courses', label: 'Bộ học', href: '/courses/' },
  { page: 'dictionary', label: 'Từ điển', href: '/browse/' },
  { page: 'progress', label: 'Tiến độ', href: '/progress/' },
  { page: 'settings', label: 'Nhịp học', href: '/?view=settings' },
] as const;
