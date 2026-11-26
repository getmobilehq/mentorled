'use client';

import React, { useEffect, useState } from 'react';
import { trackMeta, OUTCOME_COLORS, useCountUp } from './theme';

/* ------------------------------------------------------------------ */
/* Bar chart — applications per track, with the alumni share inset     */
/* ------------------------------------------------------------------ */

interface TrackDatum {
  track: string;
  applications: number;
  alumni: number;
}

export function TrackBarChart({ data }: { data: TrackDatum[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.applications), 1);
  // round the axis up to a friendly number
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / magnitude) * magnitude;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t));

  return (
    <div>
      <div className="relative flex h-64 gap-3 pl-9 sm:gap-5">
        {/* grid + axis labels */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute left-0 right-0 flex h-0 items-center" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="w-8 pr-2 text-right text-[10px] tabular-nums text-gray-400">{t}</span>
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
          </div>
        ))}

        {data.map((d, i) => {
          const meta = trackMeta(d.track);
          const h = (d.applications / top) * 100;
          const alumniH = d.applications ? (d.alumni / d.applications) * 100 : 0;
          const dim = hover && hover !== d.track;
          return (
            <div
              key={d.track}
              className="relative z-10 flex flex-1 cursor-pointer flex-col items-center justify-end"
              onMouseEnter={() => setHover(d.track)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.track)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${meta.label}: ${d.applications} applications, ${d.alumni} alumni`}
            >
              {/* tooltip */}
              <div
                className={`pointer-events-none absolute z-20 w-40 -translate-y-2 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-xl transition-all duration-200 dark:bg-gray-700 ${
                  hover === d.track ? 'opacity-100' : 'translate-y-1 opacity-0'
                }`}
                style={{ bottom: `calc(${h}% + 8px)` }}
              >
                <p className="font-semibold">{meta.label}</p>
                <p className="mt-1 flex justify-between"><span className="text-gray-300">Applications</span><span className="font-semibold">{d.applications}</span></p>
                <p className="flex justify-between"><span className="text-gray-300">Alumni</span><span className="font-semibold">{d.alumni}</span></p>
              </div>

              <span className={`mb-1 text-xs font-semibold tabular-nums transition-opacity ${dim ? 'opacity-30' : 'text-gray-700 dark:text-gray-200'}`}>
                {d.applications}
              </span>
              <div
                className={`relative w-full max-w-[56px] origin-bottom overflow-hidden rounded-t-xl transition-all duration-300 animate-grow-up ${
                  dim ? 'opacity-30' : 'opacity-100'
                } ${hover === d.track ? 'scale-x-110 shadow-lg' : ''}`}
                style={{
                  height: `${h}%`,
                  background: `linear-gradient(180deg, ${meta.color}cc, ${meta.color}66)`,
                  animationDelay: `${150 + i * 90}ms`,
                }}
              >
                {/* alumni share (solid) */}
                <div
                  className="absolute inset-x-0 bottom-0 transition-all duration-500"
                  style={{ height: `${alumniH}%`, background: meta.color, minHeight: d.alumni ? 3 : 0 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* x labels */}
      <div className="mt-3 flex gap-3 pl-9 sm:gap-5">
        {data.map((d) => {
          const meta = trackMeta(d.track);
          return (
            <div key={d.track} className="flex flex-1 flex-col items-center text-center">
              <span className="h-1.5 w-6 rounded-full" style={{ background: meta.color }} />
              <span className="mt-1.5 text-[11px] leading-tight text-gray-600 dark:text-gray-400">{meta.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gradient-to-b from-gray-400/80 to-gray-400/40" /> Applications</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-500" /> Alumni (graduated)</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut (pie) chart — screening outcomes                              */
/* ------------------------------------------------------------------ */

interface Slice {
  label: string;
  value: number;
}

export function OutcomeDonut({ data }: { data: Slice[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  const GAP = data.length > 1 ? 4 : 0; // px gap between slices

  let offset = 0;
  const slices = data.map((d) => {
    const len = (d.value / total) * C;
    const s = { ...d, len, offset, color: OUTCOME_COLORS[d.label] || '#94a3b8', pct: (d.value / total) * 100 };
    offset += len;
    return s;
  });

  const active = slices.find((s) => s.label === hover);
  const centerValue = useCountUp(active ? active.value : total, 500);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-52 w-52 flex-shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" strokeWidth="26" className="stroke-gray-100 dark:stroke-gray-700" />
          {slices.map((s, i) => (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.label ? 34 : 26}
              strokeDasharray={`${drawn ? Math.max(0, s.len - GAP) : 0} ${C}`}
              strokeDashoffset={-s.offset}
              className="cursor-pointer"
              style={{
                transition: `stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms, stroke-width 200ms ease, opacity 200ms ease`,
                opacity: hover && hover !== s.label ? 0.35 : 1,
              }}
              onMouseEnter={() => setHover(s.label)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
            {Math.round(centerValue).toLocaleString()}
          </span>
          <span className="text-xs font-medium" style={{ color: active?.color }}>
            {active ? `${active.label} · ${active.pct.toFixed(1)}%` : <span className="text-gray-500 dark:text-gray-400">applicants</span>}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {slices.map((s) => (
          <li
            key={s.label}
            className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${
              hover === s.label ? 'bg-gray-50 translate-x-1 dark:bg-gray-700/50' : ''
            } ${hover && hover !== s.label ? 'opacity-50' : ''}`}
            onMouseEnter={() => setHover(s.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-3 w-3 flex-shrink-0 rounded-full ring-4" style={{ background: s.color, ['--tw-ring-color' as string]: `${s.color}33` }} />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{s.label}</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{s.value}</span>
            <span className="w-12 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
