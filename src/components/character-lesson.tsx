'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { contextChoices, lessonExample, matchesHanViet, matchesPinyin } from '@/lib/lesson';
import { restoreLessonDraft, saveLessonDraft } from '@/lib/lesson-draft';
import { introduceCharacter } from '@/lib/study';
import type { Character, Word } from '@/lib/types';
import type { WritingResult } from '@/lib/writing';
import { useStudy } from './study-provider';
import { WritingPractice } from './writing-practice';

const STEPS = ['Hiểu chữ', 'Nhớ âm', 'Viết chữ', 'Dùng trong từ'];
const SHORT_STEPS = ['Hiểu', 'Nhớ âm', 'Viết', 'Dùng từ'];

function Pronunciation({ text }: { text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const spoken = useRef(false);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const speech = window.speechSynthesis;
    const update = () => {
      // Chỉ chọn giọng Mandarin, không thay bằng giọng Quảng Đông hoặc giọng mặc định khác ngôn ngữ.
      const voices = speech.getVoices();
      setVoice(voices.find(entry => /^zh[-_](CN|Hans)/i.test(entry.lang))
        ?? voices.find(entry => /^zh[-_]TW/i.test(entry.lang)) ?? null);
    };
    update(); speech.addEventListener('voiceschanged', update);
    return () => {
      speech.removeEventListener('voiceschanged', update);
      if (spoken.current) speech.cancel();
    };
  }, []);
  function speak() {
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.8;
    spoken.current = true; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }
  return <div className="lesson-audio">
    <button type="button" className="secondary" disabled={!voice} onClick={speak}>Nghe cách đọc</button>
    <small className="muted">{voice ? 'Nghe một lần rồi đọc thành tiếng theo mẫu.' : 'Thiết bị chưa có giọng đọc Mandarin. Bạn có thể đọc theo Pinyin.'}</small>
  </div>;
}

function CharacterExplanation({ character, characters, mnemonic }: { character: Character; characters: Character[]; mnemonic: string }) {
  return <div className="character-explanation">
    <div className="lesson-identity"><div className="hanzi">{character.id}</div><div>
      <h2>{character.meaning.join(' · ')}</h2><p><strong>{character.pinyin.join(' / ')}</strong> · Hán Việt: {character.hanViet.join(' / ')}</p>
      <Pronunciation text={character.id} />
    </div></div>
    {character.readingSource === 'unihan' && <small className="muted">Âm Việt theo kho Unihan; có thể gồm cách đọc Hán Nôm.</small>}
    {character.meaningLanguage === 'en' && <p className="muted">Nghĩa của chữ này hiện dùng tiếng Anh trong từ điển.</p>}
    {character.meaningTranslation === 'machine' && <p className="muted">Nghĩa tiếng Việt được dịch máy; hãy đối chiếu ngữ cảnh khi học.</p>}
    <div className="lesson-association">
      <h3>Nhìn thành phần để nhớ hình</h3>
      {character.components.length > 0 ? <ul className="component-parts">{character.components.map((part, index) => {
        const found = characters.find(entry => entry.id === part);
        return <li key={`${part}:${index}`}><strong>{part}</strong><span>{found?.meaning.join(' · ') ?? 'Thành phần chữ'}</span></li>;
      })}</ul> : <p>Quan sát hình tổng thể và thứ tự nét của chữ.</p>}
      <p>{mnemonic || 'Hãy gắn hình chữ với một hình ảnh hoặc tình huống quen thuộc của bạn.'}</p>
      <small className="muted">Câu chuyện giúp nhớ hình chữ; không phải giải thích nguồn gốc lịch sử.</small>
    </div>
  </div>;
}

export function CharacterLesson({ character, characters, words, peers, contentVersion, onPracticeStart, onSaved, preferLessonWords = false }: {
  character: Character; characters: Character[]; words: Word[]; peers: Character[]; contentVersion: string;
  onPracticeStart: () => void; onSaved: () => void;
  preferLessonWords?: boolean;
}) {
  const { database } = useStudy();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [mnemonic, setMnemonic] = useState(character.mnemonic);
  const [pinyin, setPinyin] = useState('');
  const [hanViet, setHanViet] = useState('');
  const [recallErrors, setRecallErrors] = useState({ pinyin: '', hanViet: '' });
  const [recalled, setRecalled] = useState(false);
  const [writing, setWriting] = useState<WritingResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [resumed, setResumed] = useState(false);
  const lessonHost = useRef<HTMLElement>(null);
  const example = lessonExample(character, words, preferLessonWords);
  const choices = contextChoices(character, peers);

  useEffect(() => {
    if (!database) return;
    let active = true;
    void database.lessonDrafts.get(character.id).then(stored => {
      if (!active) return;
      const draft = restoreLessonDraft(character, stored, contentVersion);
      if (draft) {
        setStep(draft.step); setMnemonic(draft.mnemonic); setPinyin(draft.pinyin); setHanViet(draft.hanViet);
        setWriting(draft.writing ?? null); setApplied(draft.applied);
        setRecalled(matchesPinyin(draft.pinyin, character.pinyin) && matchesHanViet(draft.hanViet, character.hanViet));
        setResumed(draft.step > 0);
      }
      setDraftReady(true);
    }).catch(() => { if (active) { setDraftReady(true); setDraftStatus('Chưa mở được bài dở. Bạn vẫn có thể học tiếp.'); } });
    return () => { active = false; };
  }, [database, character, contentVersion]);

  useEffect(() => {
    if (!database || !draftReady) return;
    let active = true;
    void saveLessonDraft(database, {
      id: character.id, contentVersion, updatedAt: Date.now(), step, mnemonic, pinyin, hanViet,
      ...(writing ? { writing } : {}), applied,
    }).then(saved => { if (active && saved) setDraftStatus('Bài dở đã lưu trên thiết bị'); })
      .catch(() => { if (active) setDraftStatus('Chưa lưu được bài dở. Hãy giữ trang mở cho đến khi lưu bài.'); });
    return () => { active = false; };
  }, [database, draftReady, character.id, contentVersion, step, mnemonic, pinyin, hanViet, writing, applied]);

  useEffect(() => {
    if (!draftReady || step === 0) return;
    // Đưa tiêu điểm vào bước vừa mở để dùng bàn phím và màn hình đọc không bị lạc sau nút đã biến mất.
    lessonHost.current?.focus({ preventScroll: true });
    lessonHost.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [step, draftReady]);

  function checkRecall(event: FormEvent) {
    event.preventDefault();
    const pinyinCorrect = matchesPinyin(pinyin, character.pinyin);
    const hanVietCorrect = matchesHanViet(hanViet, character.hanViet);
    setRecallErrors({
      pinyin: pinyinCorrect ? '' : 'Chưa đúng Pinyin hoặc thanh điệu. Xem lại rồi thử một lần nữa.',
      hanViet: hanVietCorrect ? '' : 'Chưa khớp âm Hán Việt trong bộ học. Kiểm tra cả dấu tiếng Việt.',
    });
    if (pinyinCorrect && hanVietCorrect) {
      onPracticeStart(); setRecalled(true); setStep(2); setFeedback('Bạn đã nhớ đúng cả hai cách đọc. Tiếp theo hãy nhớ hình và viết chữ.');
    }
  }
  function apply(id: string) {
    if (id === character.id) {
      setApplied(true); setFeedback('Đúng rồi! Đọc từ này thành tiếng và nghĩ đến một tình huống bạn sẽ dùng nó.');
    } else setFeedback('Chữ này chưa khớp với từ được học. Dựa vào nghĩa và hình chữ rồi thử lại.');
  }
  async function save() {
    if (!database || !recalled || !writing || !applied || busy) return;
    setBusy(true); setError('');
    try {
      // Kết quả các bước nằm trong phiên; transaction hiện có lưu chữ và bài tự viết cùng nhau.
      await introduceCharacter(character, mnemonic, new Date(), database, writing);
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không lưu được bài học.'); }
    finally { setBusy(false); }
  }

  if (!draftReady) return <section className="panel lesson-loading" role="status">Đang mở bài học…</section>;
  return <section ref={lessonHost} tabIndex={-1} className="panel character-lesson" aria-label="Bài học chữ mới">
    <div className="lesson-topline"><span className="eyebrow">{resumed ? 'TIẾP TỤC BÀI HỌC' : 'CHỮ MỚI'} · BƯỚC {step + 1}/4</span>
      <span className="draft-status" role="status">{draftStatus}</span></div>
    {/* Chỉ báo là tiến trình, không cho nhảy qua các bước kiểm tra bắt buộc. */}
    <ol className="lesson-steps" aria-label="Tiến trình bài học">{STEPS.map((label, index) =>
      <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
        <span className="step-number">{index < step ? '✓' : index + 1}</span><span className="step-label-full">{label}</span><span className="step-label-short">{SHORT_STEPS[index]}</span>
      </li>)}</ol>

    {step === 0 && <>
      <CharacterExplanation character={character} characters={characters} mnemonic={mnemonic} />
      {example && <div className="lesson-context"><h3>Gặp chữ trong một từ</h3><strong lang="zh-CN">{example.text}</strong><p>{example.translation}</p></div>}
      <details><summary>Viết câu chuyện nhớ chữ của riêng bạn</summary>
        <label>Mẹo nhớ<textarea maxLength={2000} value={mnemonic} onChange={event => setMnemonic(event.target.value)} /></label>
      </details>
      <p className="muted">Nhìn chữ, đọc Pinyin và âm Hán Việt thành tiếng. Sau đó thử gọi lại cách đọc khi đáp án đã ẩn.</p>
      <button onClick={() => { onPracticeStart(); setStep(1); setFeedback(''); }}>Ẩn đáp án và thử nhớ →</button>
    </>}

    {step === 1 && <>
      <h2>Chữ này đọc thế nào?</h2><div className="hanzi">{character.id}</div>
      <p className="muted">Thử nhớ trước khi mở lại bài. Bạn có thể nhập Pinyin có dấu hoặc số thanh.</p>
      <form onSubmit={checkRecall}>
        <label>Pinyin<input required autoComplete="off" autoCapitalize="none" spellCheck={false} value={pinyin} onChange={event => setPinyin(event.target.value)}
          placeholder="Nhập Pinyin có dấu hoặc số thanh" aria-invalid={!!recallErrors.pinyin} aria-describedby="pinyin-error" /></label>
        <p id="pinyin-error" className="error" role="status">{recallErrors.pinyin}</p>
        <label>Âm Hán Việt<input required autoComplete="off" value={hanViet} onChange={event => setHanViet(event.target.value)}
          placeholder="Nhập âm Hán Việt có dấu" aria-invalid={!!recallErrors.hanViet} aria-describedby="hanviet-error" /></label>
        <p id="hanviet-error" className="error" role="status">{recallErrors.hanViet}</p>
        <button>Kiểm tra và luyện viết →</button>
      </form>
      <details className="lesson-help"><summary>Chưa nhớ? Xem lại và nghe cách đọc</summary>
        <CharacterExplanation character={character} characters={characters} mnemonic={mnemonic} />
      </details>
    </>}

    {step === 2 && <>
      <h2>Nhớ hình và tự viết</h2><p>{character.meaning.join(' · ')} · {character.hanViet.join(' / ')}</p>
      <p className="success" role="status">{feedback}</p>
      {/* Giữ quy trình tô mẫu rồi tự viết; chỉ kết quả tự viết được dùng để lưu và lên lịch ôn. */}
      <WritingPractice character={character.id} onResult={setWriting} disabled={busy} />
      <button disabled={!writing} onClick={() => { onPracticeStart(); setStep(3); setFeedback(''); }}>Dùng chữ trong một từ →</button>
      {!writing && <p className="muted">Hoàn thành viết theo mẫu, rồi ẩn mẫu và tự viết để tiếp tục.</p>}
    </>}

    {step === 3 && <>
      <h2>Đưa chữ vào ngữ cảnh</h2>
      {example ? <div className="lesson-context">
        <p>Điền chữ vừa học để có nghĩa: <strong>{example.translation}</strong></p>
        <div className="context-word" lang="zh-CN">{applied ? example.text : example.text.split(character.id).join('□')}</div>
        {!applied && <div className="context-choices" role="group" aria-label="Chọn chữ điền vào từ">
          {choices.map(id => <button key={id} className="secondary" onClick={() => apply(id)} aria-label={`Điền chữ ${id}`}>{id}</button>)}
        </div>}
        {applied && <><p>{example.pinyin}</p><Pronunciation text={example.text} /></>}
      </div> : <div className="lesson-context">
        <p><strong>{character.id}</strong> · {character.meaning.join(' · ')}</p>
        <p>Gắn chữ này với một người, vật hoặc tình huống bạn thường gặp. Nói thành tiếng ý nghĩa và cách đọc của chữ.</p>
        <button className="secondary" onClick={() => { setApplied(true); setFeedback('Hãy giữ liên hệ này cho lần ôn tiếp theo.'); }}>Tôi đã tạo liên hệ cho chữ</button>
      </div>}
      <p className={applied ? 'success' : 'muted'} role="status">{feedback}</p>
      {applied && <div className="lesson-finish"><p>Đã luyện âm đọc, tự viết và dùng chữ. Các lần ôn sau sẽ giúp kiểm tra bạn còn nhớ đến đâu.</p>
        <button disabled={busy} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu và học chữ tiếp theo →'}</button>
      </div>}
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
