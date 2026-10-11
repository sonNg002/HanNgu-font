'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type HanziWriter from 'hanzi-writer';
import type { CharacterJson } from 'hanzi-writer';
import { loadStrokeData, type WritingResult } from '@/lib/writing';
import { createWritingTarget } from '@/lib/writing-target';

type Mode = 'trace' | 'free';
type Phase = 'loading' | 'writing' | 'complete' | 'animating' | 'error';
interface Props {
  character: string; initialMode?: Mode; disabled?: boolean;
  onResult: (result: WritingResult | null) => void;
}
export function WritingPractice({ character, initialMode = 'trace', disabled = false, onResult }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const callback = useRef(onResult);
  const currentStroke = useRef(0);
  const hinted = useRef(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<CharacterJson | null>(null);
  const [stroke, setStroke] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [traceCompleted, setTraceCompleted] = useState(initialMode === 'free');
  const [usedHint, setUsedHint] = useState(false);
  const [message, setMessage] = useState('');
  const [transform, setTransform] = useState('');
  const arrowId = useId().replace(/:/g, '');
  useEffect(() => { callback.current = onResult; }, [onResult]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    let instance: HanziWriter | null = null;
    let resize: ResizeObserver | undefined;
    const controller = new AbortController();
    setPhase('loading'); setStroke(0); setMistakes(0); setUsedHint(false); setMessage('');
    currentStroke.current = 0; hinted.current = false; callback.current(null);
    const startedAt = performance.now();
    // Import chỉ ở client. Effect hủy request và callback cũ khi đổi chữ/chế độ hoặc unmount.
    void Promise.all([import('hanzi-writer'), loadStrokeData(character)]).then(([module, strokeData]) => {
      if (!active) return;
      const Writer = module.default;
      setData(strokeData); setTransform(Writer.getScalingTransform(320, 320, 22).transform);
      instance = Writer.create(element, character, {
        width: element.clientWidth, height: element.clientWidth, padding: element.clientWidth * 22 / 320,
        showCharacter: false, showOutline: mode === 'trace',
        strokeColor: '#22745e', outlineColor: '#d8ddd4', drawingColor: '#183a35', highlightColor: '#bd8d46',
        drawingWidth: 7, strokeAnimationSpeed: 1.5, delayBetweenStrokes: 180, strokeFadeDuration: 120,
        charDataLoader: () => strokeData,
        rendererOverride: { createRenderTarget: (target, width, height) =>
          createWritingTarget(target as HTMLElement, width, height, controller.signal) },
      });
      writer.current = instance;
      const activeWriter = instance;
      const start = async () => {
        await activeWriter.getCharacterData();
        if (!active) return;
        setPhase('writing');
        setMessage(mode === 'trace' ? 'Bắt đầu tại chấm tròn, viết đè lên nét màu vàng theo hướng mũi tên.'
          : 'Tự viết từng nét trên ô trống. Hệ thống kiểm tra ngay khi bạn nhấc bút.');
        // Không tự cho qua nét sai hoặc nét viết ngược. Chế độ tự viết tắt toàn bộ gợi ý tự động.
        await activeWriter.quiz({
          leniency: 1, acceptBackwardsStrokes: false, markStrokeCorrectAfterMisses: false,
          showHintAfterMisses: false,
          onMistake: feedback => {
            if (!active) return;
            setMistakes(feedback.totalMistakes);
            setMessage(`Nét ${feedback.strokeNum + 1} chưa đúng. Kiểm tra hình dạng, vị trí và hướng viết rồi thử lại.`);
          },
          onCorrectStroke: feedback => {
            if (!active) return;
            const next = feedback.strokeNum + 1;
            currentStroke.current = next; setStroke(next); setMistakes(feedback.totalMistakes);
            setMessage(feedback.strokesRemaining ? `Đúng nét ${next}! Tiếp tục nét ${next + 1}.` : 'Đã viết đúng đủ các nét.');
          },
          onComplete: summary => {
            if (!active) return;
            setPhase('complete'); setStroke(strokeData.strokes.length); setMistakes(summary.totalMistakes);
            if (mode === 'trace') {
              setTraceCompleted(true); setMessage('Đã hoàn thành viết theo mẫu. Hãy chuyển sang Tự viết để kiểm tra trí nhớ.');
            } else {
              setMessage(`Bạn đã viết đúng đủ ${strokeData.strokes.length} nét · ${summary.totalMistakes} lần viết sai${hinted.current ? ' · có dùng gợi ý' : ''}.`);
              // Chỉ lượt tự viết hoàn thành mới tạo kết quả; tập tô không được tính là bài kiểm tra.
              callback.current({ character, strokeCount: strokeData.strokes.length, totalMistakes: summary.totalMistakes,
                usedHint: hinted.current, durationMs: Math.max(0, Math.round(performance.now() - startedAt)) });
            }
          },
        });
      };
      void start().catch(error => { if (active) { setPhase('error'); setMessage(String(error)); } });
      resize = new ResizeObserver(() => {
        const size = element.clientWidth;
        if (size > 0) activeWriter.updateDimensions({ width: size, height: size, padding: size * 22 / 320 });
      });
      resize.observe(element);
    }).catch(error => { if (active) { setPhase('error'); setMessage(error instanceof Error ? error.message : 'Không mở được ô viết.'); } });
    return () => {
      active = false; controller.abort(); resize?.disconnect();
      instance?.cancelQuiz(); void instance?.pauseAnimation();
      writer.current = null; element.replaceChildren();
    };
  }, [character, mode, round]);

  function reset(nextMode = mode) {
    callback.current(null); setMode(nextMode); setRound(value => value + 1);
  }
  async function animate() {
    const instance = writer.current;
    if (!instance) return;
    callback.current(null); setPhase('animating'); setMessage('Quan sát thứ tự và hướng từng nét…');
    instance.cancelQuiz();
    try {
      await instance.animateCharacter();
      // Callback animation cũ không được reset một quiz mới hoặc một component đã unmount.
      if (writer.current === instance) reset();
    } catch (error) {
      if (writer.current === instance) { setPhase('error'); setMessage(String(error)); }
    }
  }
  function hint() {
    if (!writer.current || !data || currentStroke.current >= data.strokes.length) return;
    hinted.current = true; setUsedHint(true);
    void writer.current.highlightStroke(currentStroke.current);
    setMessage(`Gợi ý nét ${currentStroke.current + 1}. Lượt kiểm tra này được ghi nhận có dùng gợi ý.`);
  }
  const nextMedian = data?.medians[stroke];
  const canInteract = !disabled && phase !== 'loading' && phase !== 'animating' && phase !== 'error';
  return <div className="writing-practice">
    <div className="writing-modes" role="group" aria-label="Chế độ luyện viết">
      <button type="button" className={mode === 'trace' ? 'selected' : 'secondary'} aria-pressed={mode === 'trace'}
        disabled={disabled || phase === 'animating'} onClick={() => reset('trace')}>1. Viết theo mẫu</button>
      <button type="button" className={mode === 'free' ? 'selected' : 'secondary'} aria-pressed={mode === 'free'}
        disabled={disabled || !traceCompleted || phase === 'animating'} onClick={() => reset('free')}>2. Tự viết</button>
    </div>
    <p className="muted writing-caption">{mode === 'trace' ? 'Tô từng nét lên chữ mẫu, theo đúng thứ tự.' : 'Chữ mẫu đã ẩn. Viết bằng chuột, ngón tay hoặc bút cảm ứng.'}</p>
    <div className="writing-board" data-disabled={disabled || phase !== 'writing'}>
      <div ref={host} className="writing-host" role="img" aria-label={mode === 'trace' ? `Ô viết theo mẫu chữ ${character}` : 'Ô tự viết chữ'} />
      {mode === 'trace' && phase === 'writing' && data && nextMedian && <svg className="stroke-guide" viewBox="0 0 320 320" aria-hidden="true">
        <defs><marker id={arrowId} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0L4 2L0 4" fill="#96691e" /></marker></defs>
        <g transform={transform}>
          <path d={data.strokes[stroke]} fill="#e8bd69" opacity="0.6" />
          <polyline points={nextMedian.slice(0, Math.min(3, nextMedian.length)).map(point => point.join(',')).join(' ')}
            fill="none" stroke="#96691e" strokeWidth="8" markerEnd={`url(#${arrowId})`} />
          <circle cx={nextMedian[0][0]} cy={nextMedian[0][1]} r="17" fill="#96691e" stroke="#fffefa" strokeWidth="6" />
        </g>
      </svg>}
      {phase === 'loading' && <span className="writing-loading">Đang tải mẫu nét…</span>}
    </div>
    <div className="writing-progress"><span>{data ? `${Math.min(stroke, data.strokes.length)}/${data.strokes.length} nét đúng` : 'Đang chuẩn bị'}</span>
      <span>{mistakes} lần sai{usedHint ? ' · có gợi ý' : ''}</span></div>
    <p className={`writing-feedback ${phase === 'complete' ? 'success' : ''} ${phase === 'error' ? 'error' : ''}`} role={phase === 'error' ? 'alert' : 'status'}>{message}</p>
    <div className="actions writing-actions">
      <button type="button" className="secondary" disabled={disabled || phase === 'animating'} onClick={() => reset()}>Viết lại</button>
      <button type="button" className="secondary" disabled={!canInteract} onClick={() => void animate()}>Xem thứ tự nét</button>
      {mode === 'free' && phase === 'writing' && <button type="button" className="text-button" disabled={disabled} onClick={hint}>Gợi ý nét đang viết</button>}
      {mode === 'trace' && phase === 'complete' && <button type="button" disabled={disabled} onClick={() => reset('free')}>Ẩn mẫu và tự viết →</button>}
    </div>
    <p className="muted writing-note">Hệ thống kiểm tra hình dạng, hướng và thứ tự từng nét khi nhấc bút. Nét sai cần viết lại.</p>
  </div>;
}