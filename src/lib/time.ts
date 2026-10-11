// Ngày học tính theo giờ thiết bị, không cắt ngày theo UTC khiến lệch hạn mức ở Việt Nam.
export function dayKey(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function startOfDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
export function intervalLabel(due: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
  if (minutes < 60) return minutes + ' phút';
  if (minutes < 1440) return Math.round(minutes / 60) + ' giờ';
  return Math.round(minutes / 1440) + ' ngày';
}
