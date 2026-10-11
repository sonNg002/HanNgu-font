'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { State, type Grade } from 'ts-fsrs';
import { DEFAULT_SETTINGS } from '@/lib/db';
import { filterCharacters, radicalGroups } from '@/lib/catalog';
import { loadContent } from '@/lib/content';
import { dueCards, gradeCard, introduceCharacter, orderedCharacters, saveMnemonic, saveSettings, scheduler } from '@/lib/study';
import { dayKey, intervalLabel, startOfDay } from '@/lib/time';
import { TYPE_LABELS, type Character, type Content, type RatingValue, type Settings, type StudyCard } from '@/lib/types';
import { WritingPractice } from './writing-practice';
import { WritingReview } from './writing-review';
import type { WritingResult } from '@/lib/writing';
import { AccountPanel } from './account-panel';
import { useStudy } from './study-provider';

function MemoryReviewCard({ card, character }: { card: StudyCard; character: Character }) {
  const { database } = useStudy();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ID và thời điểm tạo đúng một lần cho mỗi revision; render không đổi khóa retry.
  const [attempt] = useState(() => ({ id: crypto.randomUUID(), startedAt: Date.now() }));
  const now = new Date();
  const schedule = scheduler.repeat(card.fsrsState, now);
  async function grade(rating: RatingValue) {
    if (!database || busy) return;
    setBusy(true); setError('');
    try { await gradeCard(card.id, rating, Date.now() - attempt.startedAt, attempt.id, card.fsrsState.reps, new Date(), database); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Không lưu được lần ôn.'); }
    finally { setBusy(false); }
  }
  return <section className="panel review-card">
    <span className="eyebrow">{TYPE_LABELS[card.type]}</span>
    {card.type === 'recognize' ? <div className="hanzi">{character.id}</div>
      : <><h2>{character.meaning.join(' · ')}</h2><p>{character.pinyin.join(' / ')}</p></>}
    <p className="muted">{card.type === 'recall-hv' ? 'Nhớ chữ và âm Hán Việt trước khi mở đáp án.' : 'Nhớ nghĩa và cách đọc trước khi mở đáp án.'}</p>
    {!revealed ? <button onClick={() => setRevealed(true)}>Hiện đáp án</button> : <>
      <div className="answer"><div className="hanzi small">{character.id}</div>
        <h2>{character.hanViet.join(' / ')}</h2><p>{character.pinyin.join(' / ')} · {character.meaning.join(' · ')}</p>
        <p>{card.mnemonic || character.mnemonic}</p></div>
      <div className="ratings">{([1, 2, 3, 4] as RatingValue[]).map((rating, index) =>
        <button key={rating} disabled={busy} className={`rating rating-${rating}`} onClick={() => void grade(rating)}>
          {['Quên', 'Khó', 'Tốt', 'Dễ'][index]}<small>{intervalLabel(schedule[rating as Grade].card.due, now)}</small>
        </button>)}</div>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
// Thẻ viết dùng quiz chấm tự động; hai kỹ năng còn lại giữ màn hình nhớ và tự chấm.
function ReviewCard(props: { card: StudyCard; character: Character }) {
  return props.card.type === 'write' ? <WritingReview {...props} /> : <MemoryReviewCard {...props} />;
}
function NewCharacter({ character }: { character: Character }) {
  const { database } = useStudy();
  const [mnemonic, setMnemonic] = useState(character.mnemonic);
  const [writing, setWriting] = useState<WritingResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function learn() {
    if (!database || !writing) return;
    setBusy(true); setError('');
    try { await introduceCharacter(character, mnemonic, new Date(), database, writing); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Không lưu được chữ mới.'); }
    finally { setBusy(false); }
  }
  return <section className="panel"><span className="eyebrow">CHỮ MỚI</span>
    <h2>{character.hanViet.join(' / ')}</h2><p>{character.pinyin.join(' / ')} · {character.meaning.join(' · ')}</p>
    <p>Thành phần: {character.components.join(' + ') || 'Chữ đơn'}</p>
    <WritingPractice character={character.id} onResult={setWriting} disabled={busy} />
    <label>Mẹo nhớ<textarea maxLength={2000} value={mnemonic} onChange={event => setMnemonic(event.target.value)} /></label>
    <button disabled={busy || !writing} onClick={() => void learn()}>{busy ? 'Đang lưu…' : 'Lưu chữ và kết quả viết'}</button>
    {!writing && <p className="muted">Hoàn thành viết theo mẫu và tự viết để lưu chữ mới.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
function SettingsForm({ settings }: { settings: Settings }) {
  const { database } = useStudy();
  const [newPerDay, setNewPerDay] = useState(settings.newPerDay);
  const [order, setOrder] = useState(settings.order);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!database) return;
    try { await saveSettings(newPerDay, order, database); setMessage('Đã lưu trên thiết bị.'); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Không lưu được cài đặt.'); }
  }
  return <section className="panel"><h2>Nhịp học của bạn</h2><form onSubmit={submit}>
    <label>Chữ mới mỗi ngày<input type="number" min={1} max={50} required value={newPerDay} onChange={event => setNewPerDay(Number(event.target.value))} /></label>
    <label>Thứ tự học<select value={order} onChange={event => setOrder(event.target.value as Settings['order'])}>
      <option value="hsk">Theo cấp HSK</option><option value="freq">Chữ cơ bản trước</option></select></label>
    <button>Lưu cài đặt</button><p role="status">{message}</p>
  </form></section>;
}
function MnemonicEditor({ character, mnemonic }: { character: Character; mnemonic: string }) {
  const { database } = useStudy();
  const [value, setValue] = useState(mnemonic);
  const [message, setMessage] = useState('');
  return <details className="panel"><summary>{character.id} · {character.meaning.join(' · ')}</summary>
    <form onSubmit={async event => {
      event.preventDefault(); if (!database) return;
      try { await saveMnemonic(character.id, value, database); setMessage('Đã lưu mẹo nhớ.'); }
      catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Không lưu được.'); }
    }}><label>Mẹo nhớ<textarea maxLength={2000} value={value} onChange={event => setValue(event.target.value)} /></label>
      <button>Lưu mẹo nhớ</button><p role="status">{message}</p></form>
  </details>;
}
export function LearningApp() {
  const { database, authReady, user } = useStudy();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [radical, setRadical] = useState('');
  const [preferredCharacter, setPreferredCharacter] = useState('');
  const [tab, setTab] = useState<'study' | 'settings'>('study');
  useEffect(() => {
    let active = true;
    // URL từ từ điển chỉ chọn chữ mới; các thẻ ôn đến hạn vẫn được ưu tiên.
    const params = new URLSearchParams(window.location.search);
    setRadical(params.get('radical') ?? ''); setPreferredCharacter(params.get('character') ?? '');
    void loadContent().then(value => { if (active) setContent(value); }).catch(failure => { if (active) setError(String(failure)); });
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    // Service worker sinh từ build cache shell và JSON, chỉ đăng ký ở production.
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => { /* Học vẫn lưu Dexie nếu browser không hỗ trợ SW. */ });
    }
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const local = useLiveQuery(async () => {
    if (!database) return undefined;
    const [cards, learned, settings, reviews] = await Promise.all([
      database.cards.toArray(), database.learned.toArray(), database.settings.get('main'),
      database.reviews.where('reviewedAt').aboveOrEqual(startOfDay(now)).toArray(),
    ]);
    return { cards, learned, settings: settings ?? DEFAULT_SETTINGS, reviews };
  }, [database, dayKey(now)]);
  // Tính hạn theo lúc render để thẻ vừa tạo xuất hiện ngay, timer chỉ đánh thức thẻ đang chờ.
  const due = local ? dueCards(local.cards) : [];
  const learnedIds = new Set(local?.learned.map(entry => entry.id));
  const introducedToday = local?.learned.filter(entry => entry.introducedAt >= startOfDay(now)).length ?? 0;
  const groups = content ? radicalGroups(content.characters) : [];
  const candidates = content && local ? orderedCharacters(filterCharacters(content.characters, radical), local.settings.order).filter(character => !learnedIds.has(character.id)) : [];
  const next = candidates.find(character => character.id === preferredCharacter) ?? candidates[0];
  const card = due[0];
  const character = content?.characters.find(entry => entry.id === card?.targetId);
  return <main className="shell">
    {/* Điều hướng document để service worker phục vụ HTML đã cache trên hosting tĩnh. */}
    <header className="topbar"><a href="/" className="brand">字 <span>Hán ngữ<small>Học từng chữ, nhớ dài lâu</small></span></a>
      <nav><a href="/browse/">Từ điển</a><button className="text-button" onClick={() => setTab(tab === 'study' ? 'settings' : 'study')}>
        {tab === 'study' ? 'Cài đặt' : 'Học & ôn'}</button></nav></header>
    <div className="intro"><span className="eyebrow">MỖI NGÀY MỘT CHÚT</span><h1>Để mỗi chữ trở nên quen thuộc.</h1><p>Nhận mặt chữ, luyện viết và nhớ âm Hán Việt theo lịch FSRS.</p></div>
    <div className="stats"><div><strong>{local?.learned.length ?? 0}</strong><span>chữ đã học</span></div>
      <div><strong>{due.length}</strong><span>thẻ đến hạn</span></div><div><strong>{local?.reviews.length ?? 0}</strong><span>lượt ôn hôm nay</span></div>
      <div><strong>{introducedToday}/{local?.settings.newPerDay ?? 5}</strong><span>chữ mới hôm nay</span></div></div>
        {content && <section className="panel study-deck"><label>Bộ chữ đang học<select value={radical} onChange={event => {
      setRadical(event.target.value); setPreferredCharacter('');
      // Giữ lựa chọn khi reload và cho phép chia sẻ link bộ, không thêm ghi Firestore cho mỗi lần lọc.
      history.replaceState(null, '', event.target.value ? `/?radical=${event.target.value}` : '/');
    }}><option value="">Toàn bộ {content.characters.length.toLocaleString('vi-VN')} chữ</option>
      {groups.map(group => <option key={group.id} value={group.id}>{group.glyph} {group.name} · {group.count} chữ</option>)}
    </select></label><p className="muted">{candidates.length} chữ chưa học trong lựa chọn. Các thẻ đến hạn được ôn trước.</p><a href="/browse/">Chọn một chữ trong từ điển →</a></section>}
    <div className="columns"><div>
      {error ? <section className="panel error" role="alert">{error}<button onClick={() => location.reload()}>Thử lại</button></section>
        : !authReady || !local || !content ? <section className="panel" role="status">Đang mở bộ học…</section>
        : tab === 'settings' ? <><SettingsForm key={`${user?.uid ?? 'guest'}:${local.settings.revision}`} settings={local.settings} />
          {local.learned.map(entry => {
            const found = content.characters.find(item => item.id === entry.id);
            return found ? <MnemonicEditor key={`${entry.id}:${entry.updatedAt}`} character={found} mnemonic={entry.mnemonic} /> : null;
          })}</>
        : card && character ? <ReviewCard key={`${database?.name}:${card.id}:${card.revision}`} card={card} character={character} />
        : card ? <section className="panel error">Chữ {card.targetId} chưa có trong từ điển phiên bản này.</section>
        : next && introducedToday < local.settings.newPerDay ? <NewCharacter key={`${database?.name}:${next.id}`} character={next} />
        : <section className="panel"><h2>Bạn đã hoàn thành mục tiêu hiện tại.</h2><p>{!next ? 'Đã học hết chữ trong bộ đã chọn. Bạn có thể chọn bộ khác để học tiếp.' : 'Hãy quay lại khi thẻ tiếp theo đến hạn.'}</p>
          <p className="muted">{local.cards.filter(item => item.fsrsState.state !== State.New).sort((a,b) => a.fsrsState.due.getTime() - b.fsrsState.due.getTime())[0]?.fsrsState.due.toLocaleString('vi-VN')}</p>
        </section>}
    </div><aside><AccountPanel /><section className="panel tip"><span className="eyebrow">MẸO NHỎ</span><h2>Ôn trước, học sau.</h2>
      <p>Hoàn thành thẻ đến hạn trước khi thêm chữ mới. Khi mất mạng, mỗi lần chấm vẫn được lưu ngay trên thiết bị.</p></section></aside></div>
    <footer>Hán ngữ · Tiến độ được lưu trong trình duyệt. <a href="/browse/">Khám phá từ điển →</a></footer>
  </main>;
}