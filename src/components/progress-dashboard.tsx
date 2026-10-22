'use client';

import { AppHeader } from '@/components/app-header';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadContent } from '@/lib/content';
import { INTERVAL_LABELS, MATURE_STABILITY_DAYS, RETENTION_WINDOW_DAYS, niceMax, rate, summarizeProgress, type IntervalBucket, type Retention } from '@/lib/progress';
import { dayKey } from '@/lib/time';
import { APP_NAME, cheer } from '@/lib/personal';
import { CARD_TYPES, TYPE_LABELS, type Character } from '@/lib/types';
import { MobileNavigation } from './mobile-navigation';
import { useStudy } from './study-provider';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
// Dưới ngưỡng này tỷ lệ còn dao động mạnh; vẫn hiện số nhưng nói rõ để học viên không kết luận vội.
const SMALL_SAMPLE = 10;
const shortDate = (day: Date) => `${day.getDate()}/${day.getMonth() + 1}`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

interface Column { key: string; axis: string; tooltip: string; value: number }
function ColumnChart({ columns, summary, unit }: { columns: Column[]; summary: string; unit: string }) {
  const [active, setActive] = useState<number>();
  const max = niceMax(Math.max(...columns.map(column => column.value)));
  const ticks = max % 2 === 0 ? [max, max / 2, 0] : [max, 0];
  const align = active === undefined ? '' : active < columns.length * 0.2 ? 'start' : active > columns.length * 0.8 ? 'end' : '';
  return <figure className="column-chart">
    <div className="chart-body">
      <div className="chart-ticks" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ bottom: `${tick / max * 100}%` }}>{tick.toLocaleString('vi-VN')}</span>)}</div>
      {/* Vùng chạm là cả cột dọc, lớn hơn thanh; bảng bên dưới phục vụ bàn phím và trình đọc màn hình. */}
      <div className="chart-plot" role="img" aria-label={summary} onPointerLeave={() => setActive(undefined)}
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {ticks.map(tick => <span key={tick} className="chart-grid" style={{ bottom: `${tick / max * 100}%` }} />)}
        {columns.map((column, index) => <div key={column.key} className={`chart-slot ${active === index ? 'active' : ''}`}
          onPointerEnter={() => setActive(index)} onClick={() => setActive(index)}>
          {column.value > 0 && <span className="chart-bar" style={{ height: `${column.value / max * 100}%` }} />}
        </div>)}
        {active !== undefined && <div className={`chart-tooltip ${align}`} style={{ left: `${(active + 0.5) / columns.length * 100}%` }}>
          <strong>{columns[active].value.toLocaleString('vi-VN')} {unit}</strong><span>{columns[active].tooltip}</span>
        </div>}
      </div>
    </div>
    <div className="chart-axis" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map(column => <span key={column.key}>{column.axis}</span>)}
    </div>
    <details className="chart-table"><summary>Xem bảng số liệu</summary>
      <table><thead><tr><th scope="col">Ngày</th><th scope="col">{unit[0].toUpperCase() + unit.slice(1)}</th></tr></thead>
        <tbody>{columns.map(column => <tr key={column.key}><td>{column.tooltip}</td><td>{column.value.toLocaleString('vi-VN')}</td></tr>)}</tbody></table>
    </details>
  </figure>;
}

function RetentionRow({ label, value }: { label: string; value: Retention }) {
  const ratio = rate(value);
  return <div className="retention-row">
    <div><span>{label}</span><strong>{ratio === undefined ? '—' : percent(ratio)}</strong></div>
    <progress value={value.recalled} max={Math.max(1, value.total)} aria-label={`${label}: ${ratio === undefined ? 'chưa có lượt ôn' : percent(ratio)}`} />
    <small>{value.total ? `Nhớ ${value.recalled}/${value.total} lượt${value.total < SMALL_SAMPLE ? ' · ít dữ liệu' : ''}` : 'Chưa có lượt ôn'}</small>
  </div>;
}

export function ProgressDashboard() {
  const { database, authReady } = useStudy();
  const [now, setNow] = useState(() => new Date());
  const [characters, setCharacters] = useState<Map<string, Character>>(new Map());
  useEffect(() => {
    let active = true;
    // Tên chữ chỉ làm rõ danh sách hay quên; thiếu từ điển vẫn hiện thống kê từ IndexedDB.
    void loadContent().then(content => { if (active) setCharacters(new Map(content.characters.map(item => [item.id, item]))); }).catch(() => {});
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const local = useLiveQuery(async () => {
    if (!database) return undefined;
    const [cards, reviews, learned] = await Promise.all([database.cards.toArray(), database.reviews.toArray(), database.learned.toArray()]);
    return { cards, reviews, learned };
  }, [database]);
  const summary = useMemo(() => local ? summarizeProgress({ ...local, now }) : undefined, [local, dayKey(now), now.getHours()]);
  const reviewsInPeriod = summary?.activity.reduce((total, day) => total + day.reviews, 0) ?? 0;
  const dueThisWeek = summary?.forecast.reduce((total, day) => total + day.cards, 0) ?? 0;
  const overall = summary ? rate(summary.retention) : undefined;

  return <main className="shell">
    <AppHeader current={'progress'} />
    <div id="page-content" tabIndex={-1} className="intro"><span className="eyebrow">TIẾN ĐỘ HỌC</span><h1>Nhìn lại để học đều hơn.</h1>
      <p>Tỷ lệ nhớ là số lượt bạn chấm Khó, Tốt hoặc Dễ khi ôn lại sau ít nhất 12 giờ. Số liệu tính trên thiết bị này.</p></div>
    {!authReady || !summary ? <section className="panel" role="status">Đang tính tiến độ…</section>
      : !summary.learned ? <section className="panel"><h2>Chưa có dữ liệu học.</h2><p>Học chữ đầu tiên để bắt đầu theo dõi chuỗi ngày học và tỷ lệ nhớ.</p><a href="/">Học chữ mới →</a></section>
      : <>
        {summary.streak.current >= 2 && <p className="cheer">{cheer('streak', dayKey(now), summary.streak.current)}</p>}
        <div className="stats progress-stats">
          <div><span>Chuỗi ngày học</span><strong>{summary.streak.current}<small> ngày</small></strong><small className="muted">
            {summary.streak.activeToday ? `Dài nhất ${summary.streak.longest} ngày` : summary.streak.current ? 'Học hôm nay để giữ chuỗi' : `Dài nhất ${summary.streak.longest} ngày`}</small></div>
          <div><span>Tỷ lệ nhớ {RETENTION_WINDOW_DAYS} ngày</span><strong>{overall === undefined ? '—' : percent(overall)}</strong><small className="muted">
            {summary.retention.total ? `${summary.retention.total} lượt ôn` : 'Chưa có lượt ôn lại'}</small></div>
          <div><span>Chữ đã học</span><strong>{summary.learned}<small> chữ</small></strong></div>
          <div><span>Chữ đã vững</span><strong>{summary.mature}<small> chữ</small></strong><small className="muted">Ổn định từ {MATURE_STABILITY_DAYS} ngày, đủ {CARD_TYPES.length} kỹ năng</small></div>
        </div>
        <div className="progress-layout">
          <section className="panel"><span className="eyebrow">TRÍ NHỚ DÀI HẠN</span><h2>Tỷ lệ nhớ theo khoảng cách ôn</h2>
            <p className="muted">Khoảng cách càng xa thì nhớ được càng chứng tỏ chữ đã vào trí nhớ dài hạn. {RETENTION_WINDOW_DAYS} ngày gần nhất.</p>
            {(Object.keys(INTERVAL_LABELS) as IntervalBucket[]).map(key => <RetentionRow key={key} label={INTERVAL_LABELS[key]} value={summary.byInterval[key]} />)}
            <h3>Theo kỹ năng</h3>
            {CARD_TYPES.map(type => <RetentionRow key={type} label={TYPE_LABELS[type]} value={summary.bySkill[type]} />)}
          </section>
          <div>
            <section className="panel"><span className="eyebrow">30 NGÀY QUA</span><h2>Lượt ôn mỗi ngày</h2>
              <p className="muted">{reviewsInPeriod.toLocaleString('vi-VN')} lượt ôn, gồm cả bài viết khi học chữ mới.</p>
              <ColumnChart unit="lượt ôn" summary={`Lượt ôn 30 ngày qua: tổng ${reviewsInPeriod} lượt.`} columns={summary.activity.map((day, index, all) => ({
                key: dayKey(day.day), value: day.reviews,
                axis: index === all.length - 1 ? 'Hôm nay' : index % 7 === 1 ? shortDate(day.day) : '',
                tooltip: `${WEEKDAYS[day.day.getDay()]} ${shortDate(day.day)}${day.introduced ? ` · ${day.introduced} chữ mới` : ''}`,
              }))} />
            </section>
            <section className="panel"><span className="eyebrow">7 NGÀY TỚI</span><h2>Thẻ đến hạn</h2>
              <p className="muted">{dueThisWeek.toLocaleString('vi-VN')} thẻ cần ôn; thẻ quá hạn được tính vào hôm nay.</p>
              <ColumnChart unit="thẻ" summary={`Thẻ đến hạn 7 ngày tới: tổng ${dueThisWeek} thẻ.`} columns={summary.forecast.map((day, index) => ({
                key: dayKey(day.day), value: day.cards, axis: index === 0 ? 'Hôm nay' : WEEKDAYS[day.day.getDay()],
                tooltip: `${index === 0 ? 'Hôm nay' : WEEKDAYS[day.day.getDay()]} ${shortDate(day.day)}`,
              }))} />
            </section>
          </div>
        </div>
        <section className="panel"><span className="eyebrow">CẦN CHÚ Ý</span><h2>Chữ hay quên</h2>
          {summary.hard.length ? <><ul className="hard-characters">{summary.hard.map(entry => {
            const character = characters.get(entry.id);
            return <li key={entry.id}><span className="daily-glyph">{entry.id}</span>
              <span>{character?.pinyin.join(' / ') || entry.id}<small>{character?.meaning.join(' · ')}</small></span>
              <strong>Quên {entry.forgotten}/{entry.reviews} lượt</strong></li>;
          })}</ul><p className="muted">Thử viết một mẹo nhớ mới cho các chữ này trong <a href="/?view=settings">Nhịp học</a>.</p></>
            : <p className="muted">Chưa có chữ nào bị quên từ hai lần trở lên trong {RETENTION_WINDOW_DAYS} ngày.</p>}
        </section>
      </>}
    <footer>{APP_NAME} · Thống kê tính từ tiến độ trên thiết bị. <a href="/">Tiếp tục học →</a></footer>
    <MobileNavigation current="progress" />
  </main>;
}
