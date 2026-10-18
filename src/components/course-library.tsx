'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { memoryDecks, deckReviewCards } from '@/lib/memory-decks';
import { HSK_BOOKS, HSK_SERIES_SOURCE, TEXTBOOK_TASKS, saveTextbookTask, textbookComplete, textbookLessons, type TextbookTask } from '@/lib/textbook';
import type { Character } from '@/lib/types';
import { loadHskContent, type HskContent } from '@/lib/hsk-content';
import { HskLessonStudy } from './hsk-lesson-study';
import { AppHeader } from './app-header';
import { MobileNavigation } from './mobile-navigation';
import { useStudy } from './study-provider';
import { courseLessonMatches, type CourseStatus } from '@/lib/course-search';

export function CourseLibrary({ characters }: { characters: Character[] }) {
  const { database } = useStudy();
  const [mode, setMode] = useState<'memory' | 'hsk'>('memory');
  const [bookId, setBookId] = useState('1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [hsk, setHsk] = useState<HskContent | null>(null);
  const [contentError, setContentError] = useState('');
  const [retry, setRetry] = useState(0);
  const [activeLesson, setActiveLesson] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CourseStatus>('all');
  useEffect(() => {
    if (mode !== 'hsk') return;
    let active = true; setContentError('');
    void loadHskContent().then(value => { if (active) setHsk(value); }).catch(() => { if (active) setContentError('Chưa tải được nội dung HSK. Kết nối mạng và thử lại.'); });
    return () => { active = false; };
  }, [mode, retry]);
  useEffect(() => {
    // Khôi phục lựa chọn từ link sau hydration để trang vẫn export tĩnh được.
    const restore = () => {
      const params = new URLSearchParams(location.search);
      // Bộ lọc chỉ thuộc màn hình hiện tại; lịch sử điều hướng phải mở được bài trong link.
      setQuery(''); setFilter('all');
      setMode(params.get('mode') === 'hsk' ? 'hsk' : 'memory');
      const restoredBook = HSK_BOOKS.find(book => book.id === params.get('book'))?.id ?? '1';
      setBookId(restoredBook);
      setActiveLesson(textbookLessons(restoredBook).find(lesson => String(lesson.number) === params.get('lesson'))?.id ?? '');
    };
    restore(); window.addEventListener('popstate', restore);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => { window.removeEventListener('popstate', restore); window.clearInterval(timer); };
  }, []);
  const local = useLiveQuery(async () => {
    if (!database) return undefined;
    const [learned, cards, progress] = await Promise.all([database.learned.toArray(), database.cards.toArray(), database.textbookProgress.toArray()]);
    return { learned: new Set(learned.map(item => item.id)), cards, progress };
  }, [database]);
  const decks = useMemo(() => memoryDecks(characters), [characters]);
  const book = HSK_BOOKS.find(item => item.id === bookId)!;
  const lessons = textbookLessons(book.id);
  // Dùng chung chỉ mục cho thống kê, bộ lọc và danh sách thay vì tìm tuyến tính từng bài.
  const progressById = new Map(local?.progress.map(item => [item.id, item]));
  const contentById = useMemo(() => new Map(hsk?.lessons.map(item => [item.id, item])), [hsk]);
  const completed = lessons.filter(lesson => textbookComplete(progressById.get(lesson.id))).length;
  const nextLesson = lessons.find(lesson => !textbookComplete(progressById.get(lesson.id)));
  const visibleLessons = lessons.filter(lesson => courseLessonMatches(lesson.number, contentById.get(lesson.id), progressById.get(lesson.id), query, filter));
  function navigate(nextMode: typeof mode, nextBook = bookId) {
    setMode(nextMode); setBookId(nextBook); setMessage(''); setActiveLesson(''); setQuery(''); setFilter('all');
    history.replaceState(null, '', nextMode === 'hsk' ? `/courses/?mode=hsk&book=${nextBook}` : '/courses/');
  }
  function selectLesson(id: string) {
    setActiveLesson(id);
    const lesson = textbookLessons(bookId).find(item => item.id === id);
    // Link giữ đúng bài khi quay lại từ luyện chữ hoặc tải lại trang.
    history.replaceState(null, '', `/courses/?mode=hsk&book=${bookId}${lesson ? `&lesson=${lesson.number}` : ''}`);
  }
  async function check(lesson: number, task: TextbookTask, checked: boolean) {
    if (!database || busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try { await saveTextbookTask(database, bookId, lesson, task, checked); setMessage('Đã lưu tiến độ sách trên thiết bị.'); }
    catch { setFailed(true); setMessage('Chưa lưu được. Hãy thử lại; lựa chọn cũ vẫn được giữ.'); }
    finally { setBusy(false); }
  }
  return <main className="shell"><AppHeader current="courses" />
    <div id="page-content" tabIndex={-1} className="intro"><span className="eyebrow">BỘ HỌC & GIÁO TRÌNH</span><h1>Mỗi buổi học, một mục tiêu rõ ràng.</h1><p>Chọn bộ chữ ngắn để luyện nhớ hoặc theo lộ trình HSK Standard Course 1–6.</p></div>
    <div className="actions course-modes" role="group" aria-label="Cách học"><button className={mode === 'memory' ? '' : 'secondary'} aria-pressed={mode === 'memory'} onClick={() => navigate('memory')}>Bộ ghi nhớ</button><button className={mode === 'hsk' ? '' : 'secondary'} aria-pressed={mode === 'hsk'} onClick={() => navigate('hsk')}>Giáo trình HSK 1–6</button></div>
    {mode === 'memory' ? <>
      <section className="panel tip"><h2>Học ít, tự nhớ, quay lại đúng lúc.</h2><p>Mỗi bộ có 3–5 chữ liên quan. Hiểu → nhớ âm → viết → dùng từ, sau đó ôn thẻ đến hạn. Hoàn thành bài mới chưa có nghĩa là đã nhớ vững.</p><p>Các bộ có thể dùng chung một chữ; lịch ôn của chữ được giữ thống nhất.</p></section>
      <div className="course-grid">{decks.map(deck => {
        const learned = deck.characters.filter(item => local?.learned.has(item.id)).length;
        const due = deckReviewCards(local?.cards ?? [], new Set(deck.characters.map(item => item.id)), now).length;
        return <article className="panel course-card" key={deck.id}><span className="eyebrow">{deck.method}</span><h2>{deck.title}</h2><p className="course-glyphs" lang="zh">{deck.characters.map(item => item.id).join(' ')}</p><p>{deck.tip}</p>
          {local ? <><progress value={learned} max={Math.max(1, deck.characters.length)} aria-label={`${deck.title}: đã học ${learned}/${deck.characters.length} chữ`} /><small>Đã học {learned}/{deck.characters.length} chữ · {due} thẻ đến hạn</small></> : <small>Đang đọc tiến độ…</small>}
          {!!deck.missing.length && <p className="muted">Chưa có dữ liệu cho {deck.missing.join('、')}.</p>}
          <div className="actions">{deck.characters.length > learned && <a className="button-link" href={`/?deck=${deck.id}`}>{learned ? 'Tiếp tục bộ' : 'Học bộ này'} →</a>}{due > 0 && <a href={`/?deck=${deck.id}&activity=review`}>Ôn {due} thẻ</a>}{local && learned === deck.characters.length && !due && <span className="muted">Đã học hết · quay lại khi có thẻ đến hạn</span>}</div>
        </article>;
      })}</div>
    </> : <>
      <section className="panel"><h2>HSK Standard Course · 6 cấp, 9 quyển</h2><p>HSK 1–3 mỗi cấp một quyển; HSK 4–6 mỗi cấp gồm A và B. <a href={HSK_SERIES_SOURCE}>Thông tin bộ sách</a></p><p className="muted">Checklist là tiến độ tự xác nhận, lưu riêng trên thiết bị và chưa đồng bộ. Không thay thế điểm kiểm tra hay chứng nhận trình độ.</p>
        <label>Chọn quyển<select value={bookId} onChange={event => navigate('hsk', event.target.value)}>{HSK_BOOKS.map(item => <option key={item.id} value={item.id}>{item.label} · {item.count} bài</option>)}</select></label><a href={book.source}>Nguồn tham khảo của quyển này →</a>
        {local ? <><progress value={completed} max={book.count} aria-label={`Đã hoàn thành checklist ${completed}/${book.count} bài`} /><p>{completed}/{book.count} bài đã hoàn thành checklist.</p>{nextLesson && <a href={`#${nextLesson.id}`} onClick={() => { setQuery(''); setFilter('all'); selectLesson(nextLesson.id); }}>Tiếp tục bài {nextLesson.number} →</a>}</> : <p role="status">Đang đọc tiến độ sách…</p>}
        <p className="muted">Từ vựng và ngữ pháp theo số bài từ <a href="https://github.com/openlanguageprofiles/olp-zh-zerotohero">Chinese Zero to Hero / Open Language Profiles</a>. Đây là dữ liệu học bổ trợ, chưa được nhà xuất bản chứng nhận; không bao gồm hội thoại và audio của sách. <a href="/data/licenses/hsk-data-NOTICE.txt">Nguồn & giấy phép</a></p>
      </section><p role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'success'}>{message}</p>
      {contentError ? <p role="alert" className="error">{contentError} <button onClick={() => setRetry(value => value + 1)}>Thử tải lại</button></p> : !hsk && <p role="status">Đang tải nội dung theo bài…</p>}
      <section className="panel" aria-label="Tìm bài trong quyển">
        <label>Tìm bài<input type="search" value={query} maxLength={200} disabled={!hsk} placeholder="Số bài, chữ Hán, pinyin, nghĩa hoặc ngữ pháp" onChange={event => setQuery(event.target.value)} /></label>
        <label>Tiến độ checklist<select value={filter} disabled={!local} onChange={event => setFilter(event.target.value as CourseStatus)}><option value="all">Tất cả bài</option><option value="new">Chưa học</option><option value="started">Đang học</option><option value="complete">Đã hoàn thành</option></select></label>
        <p className="muted">Tìm trong {book.label}. Có thể nhập pinyin không dấu; hỗ trợ tìm theo nghĩa tiếng Việt.</p>
        <p role="status">Hiển thị {visibleLessons.length}/{lessons.length} bài.</p>
        {(query || filter !== 'all') && <button className="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Xóa bộ lọc</button>}
        {!visibleLessons.length && <p>Không có bài phù hợp. Thử từ khóa khác hoặc xóa bộ lọc.</p>}
      </section>
      <div className="textbook-lessons">{visibleLessons.map(lesson => {
        const progress = progressById.get(lesson.id);
        const content = contentById.get(lesson.id);
        return <details id={lesson.id} className="panel" key={`${database?.name}:${lesson.id}`} open={activeLesson === lesson.id} onToggle={event => { if (event.currentTarget.open && activeLesson !== lesson.id) selectLesson(lesson.id); else if (!event.currentTarget.open && activeLesson === lesson.id) selectLesson(''); }}><summary>{book.label} · Bài {lesson.number} <span className="muted">{textbookComplete(progress) ? '✓ Đã hoàn thành checklist' : `${progress?.tasks.length ?? 0}/4 bước`}</span></summary>
          {activeLesson === lesson.id && content && <HskLessonStudy key={lesson.id} lesson={content} characters={characters} />}
          <p className="muted">Học kết hợp sách và audio đi kèm. Đánh dấu sau khi thực hiện.</p>
          <fieldset disabled={!local || busy}><legend>Các bước tự học</legend>{TEXTBOOK_TASKS.map(task => <label className="course-check" key={task.id}><input type="checkbox" checked={progress?.tasks.includes(task.id) ?? false} onChange={event => void check(lesson.number, task.id, event.target.checked)} />{task.label}</label>)}</fieldset>
        </details>;
      })}</div>
    </>}<footer><a href="/">Quay lại học tập →</a></footer><MobileNavigation current="courses" />
  </main>;
}
