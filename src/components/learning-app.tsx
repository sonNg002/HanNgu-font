'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { State, type Grade } from 'ts-fsrs';
import { DEFAULT_SETTINGS } from '@/lib/db';
import { dailyRecommendation, studyGroups } from '@/lib/daily-study';
import { loadContent } from '@/lib/content';
import { dueCards, gradeCard, orderedCharacters, saveMnemonic, saveSettings, scheduler } from '@/lib/study';
import { dayKey, intervalLabel, startOfDay } from '@/lib/time';
import { TYPE_LABELS, type Character, type Content, type RatingValue, type Settings, type StudyCard } from '@/lib/types';
import { CharacterLesson } from './character-lesson';
import { WritingReview } from './writing-review';
import { AccountPanel } from './account-panel';
import { MobileNavigation } from './mobile-navigation';
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
  const [groupId, setGroupId] = useState('');
  const [preview, setPreview] = useState(false);
  const [activity, setActivity] = useState<'learn' | 'review'>('learn');
  const [preferredCharacter, setPreferredCharacter] = useState('');
  const [currentCharacter, setCurrentCharacter] = useState('');
  const [tab, setTab] = useState<'study' | 'settings'>('study');
  useEffect(() => {
    let active = true;
    // Link từ từ điển vẫn mở đúng bộ/chữ; truy cập trang chủ mặc định dùng gợi ý ngày.
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'settings') setTab('settings');
    setGroupId(params.has('radical') ? `radical:${params.get('radical')}`
      : params.has('topic') ? `topic:${params.get('topic')}` : params.has('all') ? 'all' : '');
    setPreferredCharacter(params.get('character') ?? '');
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
    const [cards, learned, settings, reviews, drafts] = await Promise.all([
      database.cards.toArray(), database.learned.toArray(), database.settings.get('main'),
      database.reviews.where('reviewedAt').aboveOrEqual(startOfDay(now)).toArray(),
      database.lessonDrafts.orderBy('updatedAt').reverse().toArray(),
    ]);
    return { cards, learned, settings: settings ?? DEFAULT_SETTINGS, reviews, drafts };
  }, [database, dayKey(now)]);
  // Tính hạn theo lúc render để thẻ vừa tạo xuất hiện ngay, timer chỉ đánh thức thẻ đang chờ.
  const due = local ? dueCards(local.cards) : [];
  const learnedIds = new Set(local?.learned.map(entry => entry.id));
  const introducedToday = local?.learned.filter(entry => entry.introducedAt >= startOfDay(now)).length ?? 0;
  const groups = useMemo(() => content ? studyGroups(content.characters, local?.settings.order ?? 'hsk') : [],
    [content, local?.settings.order]);
  const recommendation = useMemo(() => content && local
    ? dailyRecommendation(content.characters, local.learned, local.settings, now) : null,
    [content, local?.learned, local?.settings, dayKey(now)]);
  const selectedGroup = groupId ? groups.find(group => group.id === groupId) : recommendation;
  const deck = groupId === 'all' && content && local ? orderedCharacters(content.characters, local.settings.order)
    : selectedGroup?.characters ?? [];
  const candidates = deck.filter(character => !learnedIds.has(character.id));
  // Chữ chọn trực tiếp trong từ điển không bị giới hạn bởi bộ đề xuất tự động.
  const preferred = content?.characters.find(character => character.id === preferredCharacter && !learnedIds.has(character.id));
  // Bài dở trong bộ đang chọn được tiếp tục trước chữ mới khác; chọn chữ trực tiếp vẫn được ưu tiên.
  const draft = local?.drafts.find(entry => !learnedIds.has(entry.id) && deck.some(item => item.id === entry.id));
  const next = preferred ?? candidates.find(entry => entry.id === currentCharacter)
    ?? candidates.find(entry => entry.id === draft?.id) ?? candidates[0];
  useEffect(() => {
    // Giữ chữ đang làm khi một tab khác lưu bài dở mới hơn; chỉ đổi khi chữ đã học hoặc đổi bộ.
    if (next) setCurrentCharacter(next.id);
  }, [next?.id]);
  const goal = local?.settings.newPerDay ?? DEFAULT_SETTINGS.newPerDay;
  const remaining = Math.max(0, goal - introducedToday);
  // Preview theo đúng bộ đã chọn; giữ chữ học hôm nay, loại chữ đã biết từ những ngày trước.
  const knownBeforeToday = new Set(local?.learned.filter(entry => entry.introducedAt < startOfDay(now)).map(entry => entry.id));
  const planCharacters = groupId ? deck.filter(entry => !knownBeforeToday.has(entry.id)).slice(0, goal)
    : recommendation?.characters ?? [];
  const card = due[0];
  const character = content?.characters.find(entry => entry.id === card?.targetId);
  function selectGroup(id: string) {
    setGroupId(id); setPreferredCharacter(''); setCurrentCharacter(''); setActivity('learn');
    const params = new URLSearchParams();
    if (id.startsWith('radical:')) params.set('radical', id.slice(8));
    if (id.startsWith('topic:')) params.set('topic', id.slice(6));
    if (id === 'all') params.set('all', '1');
    // Giữ bộ học khi reload hoặc chia sẻ link; không ghi lựa chọn bộ vào tiến độ đồng bộ.
    history.replaceState(null, '', params.size ? `/?${params}` : '/');
    showLesson();
  }
  function selectCharacter(id: string) {
    setPreferredCharacter(id); setCurrentCharacter(id); setActivity('learn'); setPreview(false);
    const params = new URLSearchParams(window.location.search);
    params.set('character', id);
    history.replaceState(null, '', `/?${params}`);
    showLesson();
  }
  function showLesson() {
    // Giữ người học ở đầu bài mới sau khi lưu, tránh phải kéo từ cuối bài trước lên lại.
    document.getElementById('learning-workspace')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <main className="shell">
    {/* Điều hướng document để service worker phục vụ HTML đã cache trên hosting tĩnh. */}
    <header className="topbar"><a href="/" className="brand"><span className="brand-mark">字</span><span>Hán ngữ<small>Hiểu từng chữ. Nhớ lâu hơn.</small></span></a>
      <a className="mobile-jump" href="#today-plan">Bộ học <span aria-hidden="true">↓</span></a>
      <nav aria-label="Điều hướng chính"><button className={`nav-button ${tab === 'study' ? 'active' : ''}`} aria-pressed={tab === 'study'} onClick={() => setTab('study')}>Học tập</button>
        <a href="/browse/">Từ điển</a><a href="/progress/">Tiến độ</a><button className={`nav-button ${tab === 'settings' ? 'active' : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Cài đặt</button></nav></header>
    <div className="intro learning-intro"><div><span className="eyebrow"><span className="desktop-heading">MỖI NGÀY MỘT CHÚT · {authReady ? now.toLocaleDateString('vi-VN') : 'HỌC ĐỀU, NHỚ LÂU'}</span>
      <span className="mobile-heading">{tab === 'settings' ? 'NHỊP HỌC CÁ NHÂN' : `HỌC HÔM NAY · ${groupId === 'all' ? 'TOÀN BỘ CHỮ' : selectedGroup?.title ?? 'CHỮ CƠ BẢN'}`}</span></span>
      <h1><span className="desktop-heading">{tab === 'settings' ? 'Học theo nhịp của bạn.' : 'Hôm nay, thêm một chút hiểu biết.'}</span>
        <span className="mobile-heading">{tab === 'settings' ? 'Nhịp học của bạn.' : 'Học từng chữ, nhớ lâu.'}</span></h1>
      <p>{tab === 'settings' ? 'Điều chỉnh mục tiêu và giữ những câu chuyện nhớ chữ của riêng bạn.' : 'Hiểu chữ. Gọi lại trí nhớ. Viết và dùng trong từ.'}</p></div>
      <div className="daily-goal"><div><span>Mục tiêu hôm nay</span><strong>{introducedToday}<small> / {goal} chữ</small></strong></div>
        <progress value={Math.min(introducedToday, goal)} max={goal} aria-label="Tiến độ chữ mới hôm nay" />
        <small>{remaining ? `Còn ${remaining} chữ để hoàn thành` : 'Đã hoàn thành mục tiêu hôm nay ✓'}</small>
      </div></div>
    <div className="stats"><div><span>Chữ đã học</span><strong>{local?.learned.length ?? 0}<small> chữ</small></strong></div>
      <div><span>Đến hạn</span><strong>{due.length}<small> thẻ ôn</small></strong></div><div><span>Lượt ôn hôm nay</span><strong>{local?.reviews.length ?? 0}<small> lượt</small></strong></div>
      <div><span>Chữ mới hôm nay</span><strong>{introducedToday}<small> / {goal} chữ</small></strong></div></div>
    <div className={`learning-layout ${tab === 'settings' ? 'settings-layout' : ''}`}>
    <div className="learning-plan">
    {tab === 'study' && content && recommendation && <section id="today-plan" className="panel study-deck">
      <span className="eyebrow">BỘ HỌC HÔM NAY</span>
      <h2>{groupId === 'all' ? 'Khám phá toàn bộ chữ' : selectedGroup?.title ?? recommendation.title}</h2>
      <p className="plan-description">{planCharacters.length ? `${planCharacters.length} chữ đề xuất · ${selectedGroup?.kind === 'topic' ? 'Liên kết qua chủ đề' : selectedGroup?.kind === 'radical' ? 'Nhận ra cấu trúc chung' : 'Theo nhịp học của bạn'}`
        : 'Bộ này không còn chữ mới. Bạn có thể đổi bộ hoặc ôn lại các chữ đã học.'}</p>
      {/* Thu gọn đáp án trước khi luyện nhớ/viết; học viên chủ động mở khi cần xem lại bộ. */}
      <details open={preview} onToggle={event => setPreview(event.currentTarget.open)}><summary>Xem {planCharacters.length} chữ đề xuất</summary><ul className="daily-characters" aria-label="Các chữ được đề xuất hôm nay">
        {planCharacters.map(item => <li key={item.id} className={learnedIds.has(item.id) ? 'learned' : ''}><button className="deck-character" disabled={learnedIds.has(item.id) || remaining === 0}
          onClick={() => selectCharacter(item.id)} aria-label={`Học chữ ${item.id} · ${item.hanViet.join(' / ')}`}>
          <span className="daily-glyph">{item.id}</span><span>{item.hanViet.join(' / ')}</span>
          <small>{learnedIds.has(item.id) ? 'Đã học ✓' : item.meaning.join(' · ')}</small>
        </button></li>)}
      </ul></details>
      {groupId && <button className="secondary" onClick={() => selectGroup('')}>Học bộ gợi ý hôm nay</button>}
      <details><summary>Đổi bộ học</summary><label>Bộ chữ đang học<select value={groupId} onChange={event => selectGroup(event.target.value)}>
        <option value="">Gợi ý hôm nay · {recommendation.title}</option>
        <option value="all">Toàn bộ {content.characters.length.toLocaleString('vi-VN')} chữ</option>
        <optgroup label="Cùng chủ đề">{groups.filter(group => group.kind === 'topic').map(group =>
          <option key={group.id} value={group.id}>{group.title} · {group.characters.length} chữ</option>)}</optgroup>
        <optgroup label="Cùng bộ thủ">{groups.filter(group => group.kind === 'radical').map(group =>
          <option key={group.id} value={group.id}>{group.title} · {group.characters.length} chữ</option>)}</optgroup>
      </select></label><a href="/browse/">Chọn một chữ trong từ điển →</a></details>
      <p className="plan-remaining">{candidates.length} chữ chưa học trong lựa chọn</p>
    </section>}
    </div><div id="learning-workspace" className="learning-workspace">
      {/* Chuyển học/ôn ở ngay trên bài để mobile không phải tìm nút ở cuối phần bộ học. */}
      {tab === 'study' && <div className="actions study-activities workspace-tabs" role="group" aria-label="Hoạt động học">
        <button className={activity === 'learn' ? '' : 'secondary'} aria-pressed={activity === 'learn'} onClick={() => setActivity('learn')}>Học chữ mới</button>
        <button className={activity === 'review' ? '' : 'secondary'} aria-pressed={activity === 'review'} onClick={() => setActivity('review')}>Ôn tập <span className="count-badge">{due.length}</span></button>
      </div>}
      {error ? <section className="panel error" role="alert">{error}<button onClick={() => location.reload()}>Thử lại</button></section>
        : !authReady || !local || !content ? <section className="panel" role="status">Đang mở bộ học…</section>
        : tab === 'settings' ? <><SettingsForm key={`${user?.uid ?? 'guest'}:${local.settings.revision}`} settings={local.settings} />
          {local.learned.map(entry => {
            const found = content.characters.find(item => item.id === entry.id);
            return found ? <MnemonicEditor key={`${entry.id}:${entry.updatedAt}`} character={found} mnemonic={entry.mnemonic} /> : null;
          })}</>
        // Chỉ đổi phiên khi đã chấm thẻ; đồng bộ revision/mẹo nhớ không xóa bài đang viết.
        : activity === 'review' && card && character ? <ReviewCard key={`${database?.name}:${card.id}:${card.fsrsState.reps}`} card={card} character={character} />
        : activity === 'review' && card ? <section className="panel error">Chữ {card.targetId} chưa có trong từ điển phiên bản này.</section>
        : activity === 'review' ? <section className="panel"><h2>Đã ôn xong các thẻ đến hạn.</h2><button onClick={() => setActivity('learn')}>Tiếp tục học chữ mới →</button></section>
        : next && introducedToday < local.settings.newPerDay ? <CharacterLesson key={`${database?.name}:${next.id}`} character={next}
          characters={content.characters} words={content.words} contentVersion={content.version} peers={deck.length > 1 ? deck : content.characters.slice(0, 24)}
          onPracticeStart={() => setPreview(false)} onSaved={showLesson} />
        : <section className="panel"><h2>{introducedToday >= local.settings.newPerDay ? 'Đã đạt mục tiêu chữ mới hôm nay.' : 'Đã học hết chữ trong bộ đã chọn.'}</h2>
          <p>{introducedToday >= local.settings.newPerDay ? 'Ngày mai sẽ có bộ gợi ý mới. Bạn có thể điều chỉnh số chữ mỗi ngày trong Cài đặt.' : 'Bạn có thể chọn bộ hoặc chủ đề khác để học tiếp.'}</p>
          {due.length > 0 && <button onClick={() => setActivity('review')}>Ôn {due.length} thẻ đến hạn →</button>}
          <p className="muted">{local.cards.filter(item => item.fsrsState.state !== State.New).sort((a,b) => a.fsrsState.due.getTime() - b.fsrsState.due.getTime())[0]?.fsrsState.due.toLocaleString('vi-VN')}</p>
        </section>}
    </div><aside className="learning-support">
      {!!local?.drafts.length && remaining > 0 && <section className="panel resume-panel"><span className="eyebrow">BẠN ĐANG HỌC</span><h2>Tiếp tục từ chỗ dừng</h2>
        <div className="draft-list">{local.drafts.filter(entry => !learnedIds.has(entry.id)).slice(0, 3).map(entry =>
          <button className="secondary" key={entry.id} onClick={() => selectCharacter(entry.id)}><span>{entry.id}</span> Bước {entry.step + 1}/4 <span aria-hidden="true">→</span></button>)}</div>
      </section>}
      <section className="panel tip"><span className="eyebrow">NHỚ LÂU HƠN</span><h2>Thử nhớ trước khi xem.</h2>
        <p>Đọc thành tiếng, gắn chữ với một từ quen thuộc và ôn lại khi đến hạn.</p><small>3–5 chữ mỗi ngày là một nhịp khởi đầu nhẹ nhàng.</small></section><AccountPanel />
    </aside></div>
    <footer>Hán ngữ · Tiến độ được lưu trên thiết bị. <a href="/browse/">Khám phá từ điển →</a></footer>
    <MobileNavigation current={tab === 'settings' ? 'settings' : 'study'} onStudyAction={() => { setTab('study'); window.scrollTo({ top: 0, behavior: 'instant' }); }}
      onSettingsAction={() => { setTab('settings'); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
  </main>;
}
