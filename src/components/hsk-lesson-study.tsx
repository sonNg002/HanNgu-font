'use client';
import { useState } from 'react';
import { hskCharacters, type HskLesson } from '@/lib/hsk-content';
import type { Character } from '@/lib/types';
import { gradeWordRecall, retryWordRecall, selectedWordRecall, startWordRecall, type WordRecall } from '@/lib/word-recall';

export function HskLessonStudy({ lesson, characters }: { lesson: HskLesson; characters: Character[] }) {
  const [batch, setBatch] = useState(0);
  const [session, setSession] = useState<WordRecall | null>(null);
  const [direction, setDirection] = useState('character');
  const [shuffle, setShuffle] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [focusedReview, setFocusedReview] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const words = lesson.words.slice(batch * 5, batch * 5 + 5);
  const word = session?.queue.length ? words[session.queue[0]] : undefined;
  const coverage = hskCharacters(lesson, characters);
  function start() {
    setSession(startWordRecall(words.length, shuffle)); setRevealed(false); setFocusedReview(false);
  }
  function retryMistakes() {
    if (!session?.mistakes.length) return;
    setSession(retryWordRecall(session, shuffle)); setRevealed(false); setFocusedReview(true);
  }
  function grade(known: boolean) {
    if (!session?.queue.length || !revealed) return;
    // Từ chưa nhớ quay lại cuối lượt, không tự tăng độ vững hoặc sửa lịch FSRS của chữ.
    setSession(current => current ? gradeWordRecall(current, known) : current);
    setRevealed(false);
  }
  function selectGroup(next: number) {
    // Lựa chọn thuộc vị trí trong nhóm, nên phải xóa khi đổi nhóm để không luyện nhầm từ.
    setBatch(next); setSelected([]); setSession(null); setRevealed(false);
  }
  return <section className="hsk-lesson-study" aria-label={`Nội dung bài ${lesson.number}`}>
    <h3>{lesson.words.length} mục từ · {lesson.grammar.length} mục ngữ pháp</h3>
    <p className="muted">Nghĩa và giải thích tiếng Việt được dịch máy từ dữ liệu nguồn; cần đối chiếu với ngữ cảnh và giáo trình. Bài luyện nhớ dưới đây do ứng dụng tạo, không phải đề thi HSK.</p>
    <label>Nhóm từ trong bài<select value={batch} onChange={event => selectGroup(Number(event.target.value))}>
      {Array.from({ length: Math.ceil(lesson.words.length / 5) }, (_, index) => <option key={index} value={index}>Nhóm {index + 1} · từ {index * 5 + 1}–{Math.min((index + 1) * 5, lesson.words.length)}</option>)}
    </select></label>
    {session === null ? <><p className="muted">Chọn những từ muốn tập trung hoặc luyện cả nhóm bên dưới.</p><ul className="hsk-word-list">{words.map((item, index) => <li key={index}><label className="course-check"><input type="checkbox" aria-label={`Chọn từ ${item.text}`} checked={selected.includes(index)} onChange={event => { const checked = event.target.checked; setSelected(current => checked ? [...current, index] : current.filter(value => value !== index)); }} /><strong lang="zh">{item.text}</strong></label><span>{item.pinyin}<small lang="vi">{item.meaning}</small></span></li>)}</ul>
      <label>Chiều luyện nhớ<select value={direction} onChange={event => setDirection(event.target.value)}><option value="character">Nhìn chữ → nhớ cách đọc và nghĩa</option><option value="meaning">Nhìn nghĩa → nhớ chữ và cách đọc</option></select></label>
      <label className="course-check"><input type="checkbox" checked={shuffle} onChange={event => setShuffle(event.target.checked)} /> Xáo trộn thứ tự từ</label>
      <div className="actions"><button disabled={!words.length} onClick={start}>Luyện cả nhóm · {words.length} từ</button><button className="secondary" disabled={!selected.length} onClick={() => { setSession(selectedWordRecall(words.length, selected, shuffle)); setRevealed(false); setFocusedReview(true); }}>Luyện {selected.length} từ đã chọn</button>{!!selected.length && <button className="text-button" onClick={() => setSelected([])}>Bỏ chọn tất cả</button>}</div></>
      : word ? <div className="hsk-recall">{focusedReview && <p className="eyebrow">Ôn riêng từ cần luyện thêm</p>}<p role="status">Đã tự nhớ {session.total - session.queue.length}/{session.total} từ trong lượt này</p>
        {direction === 'character' ? <p className="course-glyphs" lang="zh">{word.text}</p> : <p lang="vi">{word.meaning}</p>}
        <p>{direction === 'character' ? 'Đọc thành tiếng và nhớ nghĩa trước khi mở đáp án.' : 'Thử viết chữ và đọc thành tiếng trước khi mở đáp án. Một nghĩa có thể có nhiều cách diễn đạt; hãy đối chiếu từ trong nhóm này.'}</p>
        {!revealed ? <button onClick={() => setRevealed(true)}>Hiện đáp án</button> : <>{direction === 'meaning' && <p className="course-glyphs" lang="zh">{word.text}</p>}<p><strong>{word.pinyin}</strong></p>{direction === 'character' && <p lang="vi">{word.meaning}</p>}<div className="actions"><button className="secondary" onClick={() => grade(false)}>Chưa nhớ · thử lại</button><button onClick={() => grade(true)}>Đã nhớ</button></div></>}
        <button className="text-button" onClick={() => setSession(null)}>Dừng để xem lại nhóm từ</button></div>
      : <div role="status"><h3>{focusedReview ? 'Đã hoàn thành lượt luyện từ đã chọn.' : 'Đã tự nhớ hết nhóm từ trong lượt này.'}</h3><p>{session.total - session.mistakes.length}/{session.total} từ nhớ ngay lần đầu trong lượt này.</p>
        {!!session.mistakes.length && <button onClick={retryMistakes}>Ôn riêng {session.mistakes.length} từ cần luyện thêm</button>}
        {!!session.mistakes.length && <details><summary>Xem lại cách đọc và nghĩa của {session.mistakes.length} từ cần ôn</summary><ul className="hsk-word-list">{session.mistakes.map(index => <li key={index}><strong lang="zh">{words[index].text}</strong><span>{words[index].pinyin}<small lang="vi">{words[index].meaning}</small></span></li>)}</ul></details>}
        <p>Hãy quay lại ở buổi sau để kiểm tra khả năng nhớ lâu. Kết quả lượt này chưa lưu sau khi rời trang.</p><div className="actions"><button onClick={start}>Luyện lại nhóm</button><button className="secondary" onClick={() => setSession(null)}>Đổi cách luyện</button>{(batch + 1) * 5 < lesson.words.length && <button className="secondary" onClick={() => { selectGroup(batch + 1); }}>Sang nhóm tiếp theo →</button>}</div></div>}
    <details><summary>Ngữ pháp của bài</summary>{lesson.grammar.length ? lesson.grammar.map((item, index) => <article className="hsk-grammar" key={index}>
      <h3 lang="zh">{item.pattern}</h3><p lang="vi">{item.meaning}</p>{item.example && <><p lang="zh">{item.example}</p><p>{item.pinyin}</p><p lang="vi">{item.translation}</p></>}</article>) : <p>Nguồn hiện chưa có mục ngữ pháp được đánh số cho bài này. Xem phần phát âm và nội dung trong sách.</p>}</details>
    {coverage.characters.length > 0 && <a className="button-link" href={`/?textbook=${lesson.bookId}&lesson=${lesson.number}`}>Luyện {coverage.characters.length} chữ có trong bài →</a>}
    {!!coverage.missing.length && <p className="muted">{coverage.missing.length} chữ chưa có mẫu luyện trong kho hiện tại: {coverage.missing.join('、')}. Vẫn có thể học từ vựng ở trên.</p>}
  </section>;
}
