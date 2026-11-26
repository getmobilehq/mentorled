'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from './theme';

interface MetricCardProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon: LucideIcon;
  /** Tailwind gradient stops, e.g. "from-violet-500 to-fuchsia-500" */
  gradient: string;
  /** Hex accent used for the sparkline / progress glow */
  accent: string;
  caption: React.ReactNode;
  footer?: React.ReactNode;
  delay?: number;
}

export function MetricCard({ label, value, decimals = 0, suffix = '', icon: Icon, gradient, accent, caption, footer, delay = 0 }: MetricCardProps) {
  const animated = useCountUp(value);
  const display = animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700/80 dark:bg-gray-800 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* soft colour wash that intensifies on hover */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-40"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white">
            {display}
            {suffix && <span className="ml-0.5 text-2xl font-semibold text-gray-400">{suffix}</span>}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>

      <div className="relative mt-3 text-sm text-gray-600 dark:text-gray-300">{caption}</div>
      {footer && <div className="relative mt-4">{footer}</div>}
    </div>
  );
}

/** Tiny area sparkline for a series of counts. */
export function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const w = 240;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => [i * step, height - 4 - (d / max) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  const id = `spark-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="animate-fade-up" style={{ animationDelay: '400ms' }} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray={1}
        style={{ strokeDashoffset: 1, animation: 'dash-draw 1.4s 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}
      />
    </svg>
  );
}

/** Animated progress bar. */
export function ProgressBar({ percent, gradient }: { percent: number; gradient: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
      <div
        className={`h-full origin-left rounded-full bg-gradient-to-r ${gradient} animate-grow-right`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, animationDelay: '300ms' }}
      />
    </div>
  );
}
