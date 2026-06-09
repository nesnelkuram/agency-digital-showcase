/**
 * ScheduleBuilder — periyot için yapısal (cron'suz) zamanlama seçici.
 * Frekans: Saatlik / Günlük / Haftalık / Aylık / Özel. Altta canlı açıklama +
 * "sıradaki çalışma" önizlemesi gösterir. Dışarıya tek bir cron string emit eder.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  describeCron,
  isValidCron,
  getNextRunDate,
  formatNextRun,
} from '@/shared/utils/cron';

const TZ = 'Europe/Istanbul';

type Freq = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

interface Structured {
  freq: Freq;
  time: string;          // "HH:MM"
  weekdays: number[];    // cron dow: 0=Paz … 6=Cmt
  monthDay: number;      // 1–31
  raw: string;           // custom cron
}

// Pzt başlangıçlı görsel sıra (cron değerleriyle)
const WEEKDAY_BTNS: { label: string; dow: number }[] = [
  { label: 'Pzt', dow: 1 },
  { label: 'Sal', dow: 2 },
  { label: 'Çar', dow: 3 },
  { label: 'Per', dow: 4 },
  { label: 'Cum', dow: 5 },
  { label: 'Cmt', dow: 6 },
  { label: 'Paz', dow: 0 },
];

const FREQ_TABS: { label: string; value: Freq }[] = [
  { label: 'Saatlik', value: 'hourly' },
  { label: 'Günlük', value: 'daily' },
  { label: 'Haftalık', value: 'weekly' },
  { label: 'Aylık', value: 'monthly' },
  { label: 'Özel', value: 'custom' },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function expandDow(expr: string): number[] {
  const out: number[] = [];
  for (const part of expr.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10));
      if (!isNaN(a) && !isNaN(b)) for (let i = a; i <= b; i++) out.push(i);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) out.push(n);
    }
  }
  return out;
}

// cron → yapısal (round-trip için)
function parseCron(expr: string): Structured {
  const base: Structured = { freq: 'daily', time: '09:00', weekdays: [1], monthDay: 1, raw: expr };
  if (!isValidCron(expr)) return { ...base, freq: 'custom', raw: expr };

  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
  const mi = parseInt(m, 10);
  const hh = parseInt(h, 10);

  // Saatlik: dakika sabit, saat *
  if (h === '*' && !isNaN(mi) && dom === '*' && mon === '*' && dow === '*') {
    return { ...base, freq: 'hourly', time: `${pad(0)}:${pad(mi)}` };
  }

  if (isNaN(mi) || isNaN(hh) || mon !== '*') return { ...base, freq: 'custom', raw: expr };
  const time = `${pad(hh)}:${pad(mi)}`;

  // Aylık: ayın günü sabit, haftanın günü *
  if (dom !== '*' && dow === '*') {
    const d = parseInt(dom, 10);
    if (!isNaN(d)) return { ...base, freq: 'monthly', monthDay: d, time };
    return { ...base, freq: 'custom', raw: expr };
  }

  // Haftalık: haftanın günü(leri) sabit
  if (dow !== '*' && dom === '*') {
    const days = expandDow(dow);
    if (days.length) return { ...base, freq: 'weekly', weekdays: days, time };
    return { ...base, freq: 'custom', raw: expr };
  }

  // Günlük
  if (dom === '*' && dow === '*') return { ...base, freq: 'daily', time };

  return { ...base, freq: 'custom', raw: expr };
}

// yapısal → cron
function buildCron(s: Structured): string {
  const [hh, mm] = s.time.split(':').map((x) => parseInt(x, 10));
  const H = isNaN(hh) ? 9 : hh;
  const M = isNaN(mm) ? 0 : mm;
  switch (s.freq) {
    case 'hourly':
      return `${M} * * * *`;
    case 'daily':
      return `${M} ${H} * * *`;
    case 'weekly': {
      const days = [...new Set(s.weekdays)].sort((a, b) => a - b);
      return `${M} ${H} * * ${(days.length ? days : [1]).join(',')}`;
    }
    case 'monthly':
      return `${M} ${H} ${Math.min(31, Math.max(1, s.monthDay))} * *`;
    case 'custom':
      return s.raw;
  }
}

interface Props {
  value: string;
  onChange: (cron: string) => void;
}

const ScheduleBuilder: React.FC<Props> = ({ value, onChange }) => {
  const [state, setState] = useState<Structured>(() => parseCron(value));
  const lastEmitted = useRef<string>(value);

  // Dışarıdan value değişirse (ör. başka şablon düzenleniyor) yeniden parse et
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setState(parseCron(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const update = (next: Structured) => {
    setState(next);
    const cron = buildCron(next);
    lastEmitted.current = cron;
    onChange(cron);
  };

  const toggleWeekday = (dow: number) => {
    const has = state.weekdays.includes(dow);
    const weekdays = has ? state.weekdays.filter((d) => d !== dow) : [...state.weekdays, dow];
    update({ ...state, weekdays: weekdays.length ? weekdays : state.weekdays });
  };

  const cron = buildCron(state);
  const valid = isValidCron(cron);
  const preview = valid ? getNextRunDate(cron, TZ, new Date()) : null;

  return (
    <div className="space-y-2.5">
      {/* Frekans sekmeleri */}
      <div className="flex flex-wrap gap-1">
        {FREQ_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => update({ ...state, freq: t.value })}
            className={`px-2.5 py-1 rounded-lg font-commons text-xs transition-colors ${
              state.freq === t.value
                ? 'bg-[#171717] text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Frekansa göre kontroller */}
      {state.freq === 'hourly' && (
        <p className="font-commons text-[11px] text-neutral-500">Her saat başında çalışır.</p>
      )}

      {state.freq === 'daily' && (
        <label className="flex items-center gap-2 font-commons text-xs text-neutral-600">
          Saat
          <input
            type="time"
            value={state.time}
            onChange={(e) => update({ ...state, time: e.target.value })}
            className="px-2 py-1 rounded-md border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
          />
        </label>
      )}

      {state.freq === 'weekly' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_BTNS.map((d) => (
              <button
                key={d.dow}
                type="button"
                onClick={() => toggleWeekday(d.dow)}
                className={`w-9 h-8 rounded-md font-commons text-[11px] transition-colors ${
                  state.weekdays.includes(d.dow)
                    ? 'bg-violet-600 text-white'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 font-commons text-xs text-neutral-600">
            Saat
            <input
              type="time"
              value={state.time}
              onChange={(e) => update({ ...state, time: e.target.value })}
              className="px-2 py-1 rounded-md border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
            />
          </label>
        </div>
      )}

      {state.freq === 'monthly' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-commons text-xs text-neutral-600">
            Her ayın
            <select
              value={state.monthDay}
              onChange={(e) => update({ ...state, monthDay: parseInt(e.target.value, 10) })}
              className="px-2 py-1 rounded-md border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}.</option>
              ))}
            </select>
            günü, saat
            <input
              type="time"
              value={state.time}
              onChange={(e) => update({ ...state, time: e.target.value })}
              className="px-2 py-1 rounded-md border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
            />
          </div>
          {state.monthDay > 28 && (
            <p className="font-commons text-[10px] text-amber-600">
              {state.monthDay}. günü olmayan aylarda (ör. Şubat) o ay atlanır.
            </p>
          )}
        </div>
      )}

      {state.freq === 'custom' && (
        <input
          value={state.raw}
          onChange={(e) => update({ ...state, raw: e.target.value })}
          placeholder="dakika saat gün ay haftanıngünü — ör. 0 9 * * 1-5"
          className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none ${
            valid ? 'border-neutral-200 focus:border-violet-400' : 'border-rose-300'
          }`}
        />
      )}

      {/* Canlı açıklama + sıradaki çalışma */}
      <p className="font-commons text-[11px] text-neutral-500">
        {valid ? (
          <>
            <span className="text-neutral-700">{describeCron(cron)}</span>
            {preview && <> · sıradaki: <span className="text-violet-600">{formatNextRun(preview)}</span></>}
          </>
        ) : (
          <span className="text-rose-600">Geçersiz zamanlama</span>
        )}
      </p>
    </div>
  );
};

export default ScheduleBuilder;
