'use client';

import { useState } from 'react';
import { gradeCard, scheduler, writingRating } from '@/lib/study';
import { intervalLabel } from '@/lib/time';
import type { Character, StudyCard } from '@/lib/types';
import type { WritingResult } from '@/lib/writing';
import { WritingPractice } from './writing-practice';
import { useStudy } from './study-provider';

const LABELS = { 1: 'Quên', 2: 'Khó', 3: 'Tốt', 4: 'Dễ' } as const;
export function WritingReview({ card, character }: { card: StudyCard; character: Character }) {
  const { database } = useStudy();
  const [result, setResult] = useState<WritingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attemptId] = useState(() => crypto.randomUUID());
  const rating = result ? writingRating(result.totalMistakes, result.usedHint) : null;
  async function save() {
    if (!database || !result || !rating || busy) return;
    setBusy(true); setError('');
    try {
      // Chỉ lưu sau quiz tự viết hoàn tất, dùng điểm hệ thống và attempt ID ổn định cho retry.
      await gradeCard(card.id, rating, result.durationMs, attemptId, card.fsrsState.reps, new Date(), database, {
        strokeCount: result.strokeCount, totalMistakes: result.totalMistakes, usedHint: result.usedHint,
      });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không lưu được kết quả viết.'); }
    finally { setBusy(false); }
  }
  return <section className="panel review-card">
    <span className="eyebrow">ÔN TẬP VIẾT</span><h2>{character.meaning.join(' · ')}</h2><p>{character.pinyin.join(' / ')}</p>
    <WritingPractice character={character.id} initialMode="free" onResult={setResult} disabled={busy} />
    {result && rating && <div className="writing-result">
      <h3>Kết quả: {LABELS[rating]}</h3>
      <p>{result.usedHint ? 'Bạn đã dùng gợi ý. Lịch ôn sẽ ngắn hơn để luyện lại.' : result.totalMistakes === 0
        ? 'Đúng toàn bộ nét ngay lần đầu.' : `Đã sửa đúng sau ${result.totalMistakes} lần viết sai.`}</p>
      <p className="muted">Lần ôn tiếp theo: {intervalLabel(scheduler.next(card.fsrsState, new Date(), rating).card.due)}</p>
      <button disabled={busy} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu kết quả và tiếp tục'}</button>
    </div>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}