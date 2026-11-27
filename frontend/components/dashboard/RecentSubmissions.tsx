'use client';

import React from 'react';
import { CheckCircle2, Clock, ExternalLink, Inbox } from 'lucide-react';
import type { DashboardOverview } from '@/types';
import { trackMeta } from './theme';

type Submission = DashboardOverview['recent_submissions'][number];

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  progress: { label: 'Progress', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300' },
  borderline: { label: 'Borderline', cls: 'bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300' },
  do_not_progress: { label: 'Not progressing', cls: 'bg-rose-100 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300' },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RecentSubmissions({ rows }: { rows: Submission[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <Inbox className="h-6 w-6 text-gray-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No submissions yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Challenge submissions will appear here as they arrive.</p>
      </div>
    );
  }

  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-gray-100 bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            <th className="px-6 py-3">Applicant</th>
            <th className="px-4 py-3">Track</th>
            <th className="px-4 py-3">Challenge</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3">Timing</th>
            <th className="px-6 py-3 text-right">Evaluation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
          {rows.map((r, i) => {
            const meta = trackMeta(r.track);
            const outcome = r.outcome ? OUTCOME_STYLE[r.outcome] : null;
            return (
              <tr
                key={r.id}
                className="group transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 animate-fade-up"
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)` }}
                    >
                      {initials(r.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-white">{r.name}</p>
                      {r.email && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{r.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.soft} ${meta.text}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                </td>
                <td className="max-w-[220px] px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-gray-700 dark:text-gray-200">{r.challenge}</span>
                    {r.submission_url && (
                      <a
                        href={r.submission_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-blue-600 group-hover:opacity-100"
                        aria-label="Open submission"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-gray-600 dark:text-gray-300" title={new Date(r.submitted_at).toLocaleString()}>
                  {relativeTime(r.submitted_at)}
                </td>
                <td className="px-4 py-3.5">
                  {r.on_time === false ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Late
                    </span>
                  ) : r.on_time ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> On time
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  {outcome ? (
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${outcome.cls}`}>
                      {outcome.label}
                      {r.score != null && <span className="font-semibold tabular-nums">{Number(r.score).toFixed(1)}/4</span>}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" /> Awaiting review
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
