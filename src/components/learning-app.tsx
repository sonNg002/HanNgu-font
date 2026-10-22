'use client';

import { AppHeader } from '@/components/app-header';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { State, type Grade } from 'ts-fsrs';
import { DEFAULT_SETTINGS } from '@/lib/db';
import { loadHskContent, hskCharacters, type HskContent } from '@/lib/hsk-content';
import { memoryDecks } from '@/lib/memory-decks';
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
import { APP_NAME, cheer } from '@/lib/personal';

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
    <p className="muted">Nhớ nghĩa và cách đọc trước khi mở đáp án.</p>
    {!revealed ? <button onClick={() => setRevealed(true)}>Hiện đáp án</button> : <>
      <div className="answer"><div className="hanzi small">{character.id}</div>
        <h2>{character.pinyin.join(' / ')}</h2><p>{character.meaning.join(' · ')}</p>
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
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Cập nhật giá trị đồng bộ mà không remount form, để thông báo lưu thành công còn hiển thị.
    setNewPerDay(settings.newPerDay); setOrder(settings.order);
  }, [settings.newPerDay, settings.order]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!database || saving) return;
    setSaving(true); setFailed(false); setMessage('');
    try { await saveSettings(newPerDay, order, database); setMessage('Đã lưu trên thiết bị.'); }
    catch (failure) { setFailed(true); setMessage(failure instanceof Error ? failure.message : 'Không lưu được cài đặt.'); }
    finally { setSaving(false); }
  }
  return <section className="panel"><h2>Nhịp học của bạn</h2><form onSubmit={submit}>
    <label>Chữ mới mỗi ngày<input type="number" min={1} max={50} required value={newPerDay} onChange={event => setNewPerDay(Number(event.target.value))} /></label>
    <label>Thứ tự học<select value={order} onChange={event => setOrder(event.target.value as Settings['order'])}>
      <option value="hsk">Theo cấp HSK</option><option value="freq">Chữ cơ bản trước</option></select></label>
    <p className="muted">Bắt đầu với 3–5 chữ mỗi ngày. Bạn có thể thay đổi mục tiêu bất cứ lúc nào.</p>
    <button disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu nhịp học'}</button><p role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'success'}>{message}</p>
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
  const [hsk, setHsk] = useState<HskContent | null>(null);
  const [hskError, setHskError] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [groupId, setGroupId] = useState('');
  const [preview, setPreview] = useState(false);
  const [activity, setActivity] = useState<'learn' | 'review'>('learn');
  const [preferredCharacter, setPreferredCharacter] = useState('');
  const [currentCharacter, setCurrentCharacter] = useState('');
  const [tab, setTab] = useState<'study' | 'settings'>('study');
  // Lời nhắn sau khi lưu chữ: chọn một lần lúc lưu để không đổi khi trang render lại.
  const [learnedCheer, setLearnedCheer] = useState('');
  useEffect(() => {
    let active = true;
    // Link từ từ điển vẫn mở đúng bộ/chữ; truy cập trang chủ mặc định dùng gợi ý ngày.
    const restoreTab = () => {
      const params = new URLSearchParams(window.location.search);
      setTab(params.get('view') === 'settings' ? 'settings' : 'study');
      setActivity(params.get('activity') === 'review' ? 'review' : 'learn');
      setGroupId(params.has('textbook') ? `textbook:${params.get('textbook')}:${params.get('lesson')}` : params.has('deck') ? `deck:${params.get('deck')}` : params.has('radical') ? `radical:${params.get('radical')}`
        : params.has('topic') ? `topic:${params.get('topic')}` : params.has('all') ? 'all' : '');
      setPreferredCharacter(params.get('character') ?? ''); setCurrentCharacter('');
    };
    restoreTab();
    void loadContent().then(value => { if (active) setContent(value); }).catch(failure => { if (active) setError(String(failure)); });
    window.addEventListener('popstate', restoreTab);
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('popstate', restoreTab); };
  }, []);
  useEffect(() => {
    setHskError('');
    if (!groupId.startsWith('textbook:')) return;
    let active = true;
    void loadHskContent().then(value => { if (active) setHsk(value); }).catch(() => { if (active) setHskError('Chưa tải được nội dung giáo trình. Hãy kết nối mạng và thử lại.'); });
    return () => { active = false; };
  }, [groupId]);
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
  const groups = useMemo(() => content ? [...studyGroups(content.characters, local?.settings.order ?? 'hsk'), ...memoryDecks(content.characters).map(deck => ({ id: `deck:${deck.id}`, kind: 'memory' as const, title: deck.title, characters: deck.characters })), ...(hsk?.lessons.filter(lesson => `textbook:${lesson.bookId}:${lesson.number}` === groupId).map(lesson => ({ id: `textbook:${lesson.bookId}:${lesson.number}`, kind: 'textbook' as const, title: `HSK ${lesson.bookId.toUpperCase()} · Chữ trong bài ${lesson.number}`, characters: hskCharacters(lesson, content.characters).characters })) ?? [])] : [],
    [content, local?.settings.order, hsk, groupId]);
  const recommendation = useMemo(() => content && local
    ? dailyRecommendation(content.characters, local.learned, local.settings, now) : null,
    [content, local?.learned, local?.settings, dayKey(now)]);
  const selectedGroup = groupId ? groups.find(group => group.id === groupId) : recommendation;
  const textbookLesson = hsk?.lessons.find(lesson => `textbook:${lesson.bookId}:${lesson.number}` === groupId);
  // Luyện chữ trong giáo trình dùng từ của chính bài, không lấy ngữ cảnh từ bộ khởi đầu khác.
  const lessonWords = textbookLesson ? textbookLesson.words.map(word => ({ id: word.text, simplified: word.text,
    pinyin: word.pinyin, meaning: [word.meaning], chars: [...word.text] })) : content?.words ?? [];
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
  const otherDrafts = local?.drafts.filter(entry => !learnedIds.has(entry.id) && entry.id !== next?.id) ?? [];
  const goal = local?.settings.newPerDay ?? DEFAULT_SETTINGS.newPerDay;
  const remaining = Math.max(0, goal - introducedToday);
  // Preview theo đúng bộ đã chọn; giữ chữ học hôm nay, loại chữ đã biết từ những ngày trước.
  const knownBeforeToday = new Set(local?.learned.filter(entry => entry.introducedAt < startOfDay(now)).map(entry => entry.id));
  const planCharacters = groupId ? deck.filter(entry => !knownBeforeToday.has(entry.id)).slice(0, goal)
    : recommendation?.characters ?? [];
  // Bộ ghi nhớ giới hạn phiên ôn theo đúng chữ trong bộ, vẫn giữ hạn FSRS hiện tại.
  const scopedDue = (groupId.startsWith('deck:') || groupId.startsWith('textbook:')) ? due.filter(card => deck.some(item => item.id === card.targetId)) : due;
  const card = scopedDue[0];
  const character = content?.characters.find(entry => entry.id === card?.targetId);
  function selectTab(value: 'study' | 'settings') {
    // Giữ nhịp học trong URL để reload và nút quay lại mở đúng màn hình.
    if (value === tab) return;
    setTab(value);
    const params = new URLSearchParams(window.location.search);
    if (value === 'settings') params.set('view', 'settings'); else params.delete('view');
    history.pushState(null, '', params.size ? `/?${params}` : '/');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function selectGroup(id: string) {
    setGroupId(id); setPreferredCharacter(''); setCurrentCharacter(''); setActivity('learn');
    const params = new URLSearchParams();
    if (id.startsWith('textbook:')) { const [, book, lesson] = id.split(':'); params.set('textbook', book); params.set('lesson', lesson); }
    if (id.startsWith('deck:')) params.set('deck', id.slice(5));
    if (id.startsWith('radical:')) params.set('radical', id.slice(8));
    if (id.startsWith('topic:')) params.set('topic', id.slice(6));
    if (id === 'all') params.set('all', '1');
    // Giữ bộ học khi reload hoặc chia sẻ link; không ghi lựa chọn bộ vào tiến độ đồng bộ.
    history.replaceState(null, '', params.size ? `/?${params}` : '/');
    showLesson();
  }
  function selectCharacter(id: string) {
    setTab('study'); setPreferredCharacter(id); setCurrentCharacter(id); setActivity('learn'); setPreview(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('view'); params.set('character', id);
    history.replaceState(null, '', `/?${params}`);
    showLesson();
  }
  function showLesson() {
    // Giữ người học ở đầu bài mới sau khi lưu, tránh phải kéo từ cuối bài trước lên lại.
    document.getElementById('learning-workspace')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <main className="shell">
    {/* Điều hướng document để service worker phục vụ HTML đã cache trên hosting tĩnh. */}
    <AppHeader current={tab === 'settings' ? 'settings' : 'study'} onStudyAction={() => selectTab('study')} onSettingsAction={() => selectTab('settings')} />
    {/* Đầu trang chỉ giữ tiêu đề và mục tiêu ngày; số liệu chi tiết nằm ở trang Tiến độ. */}
    <div id="page-content" tabIndex={-1} className="intro learning-intro"><div>
      <h1><span className="desktop-heading">{tab === 'settings' ? 'Học theo nhịp của bạn.' : 'Hôm nay, thêm một chút hiểu biết.'}</span>
        <span className="mobile-heading">{tab === 'settings' ? 'Nhịp học của bạn.' : 'Học từng chữ, nhớ lâu.'}</span></h1></div>
      {tab === 'study' && <div className="daily-goal"><div><span>Mục tiêu hôm nay</span><strong>{introducedToday}<small> / {goal} chữ</small></strong></div>
        <progress value={Math.min(introducedToday, goal)} max={goal} aria-label="Tiến độ chữ mới hôm nay" />
      </div>}</div>
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
          onClick={() => selectCharacter(item.id)} aria-label={`Học chữ ${item.id} · ${item.pinyin.join(' / ')}`}>
          <span className="daily-glyph">{item.id}</span><span>{item.pinyin.join(' / ')}</span>
          <small>{learnedIds.has(item.id) ? 'Đã học ✓' : item.meaning.join(' · ')}</small>
        </button></li>)}
      </ul></details>
      {groupId && <button className="secondary" onClick={() => selectGroup('')}>Học bộ gợi ý hôm nay</button>}
      <p><a href="/courses/">Bộ ghi nhớ & giáo trình HSK →</a></p>
      <details><summary>Đổi bộ học</summary><label>Bộ chữ đang học<select value={groupId} onChange={event => selectGroup(event.target.value)}>
        <option value="">Gợi ý hôm nay · {recommendation.title}</option>
        <option value="all">Toàn bộ {content.characters.length.toLocaleString('vi-VN')} chữ</option>
        <optgroup label="Bài giáo trình đang chọn">{groups.filter(group => group.kind === 'textbook').map(group => <option key={group.id} value={group.id}>{group.title}</option>)}</optgroup>
        <optgroup label="Bộ ghi nhớ ngắn">{groups.filter(group => group.kind === 'memory').map(group => <option key={group.id} value={group.id}>{group.title} · {group.characters.length} chữ</option>)}</optgroup>
        <optgroup label="Cùng chủ đề">{groups.filter(group => group.kind === 'topic').map(group =>
          <option key={group.id} value={group.id}>{group.title} · {group.characters.length} chữ</option>)}</optgroup>
        <optgroup label="Cùng bộ thủ">{groups.filter(group => group.kind === 'radical').map(group =>
          <option key={group.id} value={group.id}>{group.title} · {group.characters.length} chữ</option>)}</optgroup>
      </select></label><a href="/browse/">Chọn một chữ trong từ điển →</a></details>
      {textbookLesson && <p className="muted">Đây là luyện chữ bổ trợ. Từ vựng và ngữ pháp nằm trong <a href={`/courses/?mode=hsk&book=${textbookLesson.bookId}&lesson=${textbookLesson.number}`}>bài giáo trình</a>.</p>}
    </section>}
    </div><div id="learning-workspace" className="learning-workspace">
      {/* Chuyển học/ôn ở ngay trên bài để mobile không phải tìm nút ở cuối phần bộ học. */}
      {tab === 'study' && <div className="actions study-activities workspace-tabs" role="group" aria-label="Hoạt động học">
        <button className={activity === 'learn' ? '' : 'secondary'} aria-pressed={activity === 'learn'} onClick={() => setActivity('learn')}>Học chữ mới</button>
        <button className={activity === 'review' ? '' : 'secondary'} aria-pressed={activity === 'review'} onClick={() => setActivity('review')}>Ôn tập <span className="count-badge">{scopedDue.length}</span></button>
      </div>}
      {error || hskError ? <section className="panel error" role="alert">{error || hskError}<button onClick={() => location.reload()}>Thử lại</button></section>
        : !authReady || !local || !content || (groupId.startsWith('textbook:') && !hsk) ? <section className="panel" role="status">Đang mở bộ học…</section>
        : groupId && groupId !== 'all' && !selectedGroup ? <section className="panel"><h2>Không tìm thấy bộ học này.</h2><a href="/courses/">Chọn lại bộ học →</a></section>
        : tab === 'settings' ? <><AccountPanel /><SettingsForm key={user?.uid ?? 'guest'} settings={local.settings} />
          {local.learned.map(entry => {
            const found = content.characters.find(item => item.id === entry.id);
            return found ? <MnemonicEditor key={`${entry.id}:${entry.updatedAt}`} character={found} mnemonic={entry.mnemonic} /> : null;
          })}</>
        // Chỉ đổi phiên khi đã chấm thẻ; đồng bộ revision/mẹo nhớ không xóa bài đang viết.
        : activity === 'review' && card && character ? <ReviewCard key={`${database?.name}:${card.id}:${card.fsrsState.reps}`} card={card} character={character} />
        : activity === 'review' && card ? <section className="panel error">Chữ {card.targetId} chưa có trong từ điển phiên bản này.</section>
        : activity === 'review' ? <section className="panel"><h2>Đã ôn xong các thẻ đến hạn trong lựa chọn.</h2>{local.reviews.length > 0 && <p className="cheer">{cheer('reviewed', `${dayKey(now)}:${local.reviews.length}`)}</p>}<p><a href="/courses/">Chọn bộ học khác →</a></p><button onClick={() => setActivity('learn')}>Tiếp tục học chữ mới →</button></section>
        : next && introducedToday < local.settings.newPerDay ? <>{learnedCheer && <p className="cheer" role="status">{learnedCheer}</p>}<CharacterLesson key={`${database?.name}:${next.id}`} character={next}
          characters={content.characters} words={lessonWords} contentVersion={textbookLesson ? `${content.version}:${textbookLesson.id}` : content.version} peers={deck.length > 1 ? deck : content.characters.slice(0, 24)}
          preferLessonWords={!!textbookLesson} onPracticeStart={() => setPreview(false)} onSaved={() => { setLearnedCheer(cheer('learned', Date.now())); showLesson(); }} /></>
        : <section className="panel"><h2>{introducedToday >= local.settings.newPerDay ? 'Đã đạt mục tiêu chữ mới hôm nay.' : 'Đã học hết chữ trong bộ đã chọn.'}</h2>
          {introducedToday >= local.settings.newPerDay && <p className="cheer">{cheer('goal', dayKey(now))}</p>}
          <p>{introducedToday >= local.settings.newPerDay ? 'Ngày mai sẽ có bộ gợi ý mới. Bạn có thể điều chỉnh số chữ mỗi ngày trong Cài đặt.' : 'Bạn có thể chọn bộ hoặc chủ đề khác để học tiếp.'}</p>
          {scopedDue.length > 0 && <button onClick={() => setActivity('review')}>Ôn {scopedDue.length} thẻ đến hạn →</button>}
          <p className="muted">{local.cards.filter(item => item.fsrsState.state !== State.New).sort((a,b) => a.fsrsState.due.getTime() - b.fsrsState.due.getTime())[0]?.fsrsState.due.toLocaleString('vi-VN')}</p>
        </section>}
    </div><aside className="learning-support">
      {/* Chỉ gợi ý bài dở khác chữ đang mở, tránh lặp lại đúng bài phía trên. */}
      {tab === 'study' && remaining > 0 && !!otherDrafts.length && <section className="panel resume-panel"><span className="eyebrow">BẠN ĐANG HỌC</span><h2>Tiếp tục từ chỗ dừng</h2>
        <div className="draft-list">{otherDrafts.slice(0, 3).map(entry =>
          <button className="secondary" key={entry.id} onClick={() => selectCharacter(entry.id)}><span>{entry.id}</span> Bước {entry.step + 1}/4 <span aria-hidden="true">→</span></button>)}</div>
      </section>}
    </aside></div>
    <footer>{APP_NAME} · Tiến độ được lưu trên thiết bị. <a href="/browse/">Khám phá từ điển →</a></footer>
    <MobileNavigation current={tab === 'settings' ? 'settings' : 'study'} onStudyAction={() => selectTab('study')}
      onSettingsAction={() => selectTab('settings')} />
  </main>;
}
