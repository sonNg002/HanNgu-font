// Mọi chỗ cá nhân hóa cho Ly nằm ở đây: sửa tên hoặc thêm lời nhắn rồi build lại.
export const APP_NAME = 'Ly học tiếng Trung';
export const APP_TAGLINE = 'Mỗi ngày một chữ, cùng Ly.';

export type CheerMoment = 'learned' | 'goal' | 'reviewed' | 'streak';

export const CHEERS: Record<CheerMoment, string[]> = {
  learned: [
    'Thêm một chữ nữa rồi, Ly giỏi quá! 💕',
    'Chữ này là của Ly rồi đó ✨',
    'Từng chữ một thôi, Ly đang làm rất tốt 🌸',
    'Chữ mới đã vào túi! Tự hào về Ly lắm 💖',
    'Ly viết đẹp ghê, học thêm chữ nữa nha? 🌷',
  ],
  goal: [
    'Ly hoàn thành mục tiêu hôm nay rồi! Giỏi quá đi 🎉',
    'Đủ chữ cho hôm nay rồi, mai học tiếp nha Ly 💖',
    'Mỗi ngày một chút, Ly đang tiến bộ từng ngày đó 🌸',
  ],
  reviewed: [
    'Ôn xong hết rồi! Trí nhớ của Ly đỉnh thật 🌟',
    'Hôm nay Ly chăm quá, nghỉ ngơi chút nha 💕',
    'Xong phần ôn rồi, nhờ Ly kiên trì đó ✨',
  ],
  streak: [
    'Ly đã học liên tục {days} ngày rồi, giữ lửa nha 🔥',
    '{days} ngày liền không nghỉ, Ly đỉnh quá 💖',
  ],
};

// Chọn theo seed để lời nhắn đứng yên khi trang render lại, chỉ đổi khi có thành tích mới.
export function cheer(moment: CheerMoment, seed: string | number, days = 0): string {
  const list = CHEERS[moment];
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return list[hash % list.length].replace('{days}', String(days));
}
