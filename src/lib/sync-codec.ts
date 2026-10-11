import type { Card as FSRSCard, ReviewLog as FSRSLog } from 'ts-fsrs';
import type { ReviewLog, Settings, StudyCard } from './types';

// Wire format chỉ có primitive: mili giây UTC tránh mất kiểu Date khi qua Firestore.
export interface RemoteCard extends Omit<StudyCard, 'dirty' | 'fsrsState' | 'introducedAt'> {
  fsrs: Omit<FSRSCard, 'due' | 'last_review'> & { due: number; last_review?: number };
  introducedAt: number;
}
export interface RemoteReview extends Omit<ReviewLog, 'dirty' | 'reviewedAt' | 'fsrsLog'> {
  reviewedAt: number;
  fsrsLog: Omit<FSRSLog, 'due' | 'review'> & { due: number; review: number };
}
export type RemoteSettings = Omit<Settings, 'dirty'>;
export function encodeCard(card: StudyCard): RemoteCard {
  const { dirty, fsrsState, introducedAt, ...rest } = card;
  void dirty;
  const { due, last_review, ...state } = fsrsState;
  return { ...rest, introducedAt: introducedAt.getTime(), fsrs: {
    ...state, due: due.getTime(), ...(last_review ? { last_review: last_review.getTime() } : {}),
  } };
}
export function decodeCard(card: RemoteCard): StudyCard {
  const { fsrs, introducedAt, ...rest } = card;
  const { due, last_review, ...state } = fsrs;
  return { ...rest, dirty: 0, introducedAt: new Date(introducedAt), fsrsState: {
    ...state, due: new Date(due), ...(last_review === undefined ? {} : { last_review: new Date(last_review) }),
  } };
}
export function encodeReview(review: ReviewLog): RemoteReview {
  const { dirty, reviewedAt, fsrsLog, ...rest } = review;
  void dirty;
  return { ...rest, reviewedAt: reviewedAt.getTime(), fsrsLog: {
    ...fsrsLog, due: fsrsLog.due.getTime(), review: fsrsLog.review.getTime(),
  } };
}
export function decodeReview(review: RemoteReview): ReviewLog {
  return { ...review, dirty: 0, reviewedAt: new Date(review.reviewedAt), fsrsLog: {
    ...review.fsrsLog, due: new Date(review.fsrsLog.due), review: new Date(review.fsrsLog.review),
  } };
}
export function encodeSettings(settings: Settings): RemoteSettings {
  const { dirty, ...rest } = settings;
  void dirty;
  return rest;
}