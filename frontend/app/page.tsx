'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, GraduationCap, RefreshCw, Target, Users, BarChart3, ListChecks, FileCheck2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { analyticsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { DashboardOverview } from '@/types';
import { MetricCard, Sparkline, ProgressBar } from '@/components/dashboard/MetricCard';
import { TrackBarChart, OutcomeDonut } from '@/components/dashboard/Charts';
import { trackMeta } from '@/components/dashboard/theme';
import { RecentSubmissions } from '@/components/dashboard/RecentSubmissions';

const REFRESH_MS = 60_000;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Section({
  title,
  subtitle,
  icon: Icon,
  action,
  delay = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Panel({ title, subtitle, children, delay = 0 }: { title: string; subtitle?: string; children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg dark:border-gray-700/80 dark:bg-gray-800 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-5">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await analyticsAPI.getOverview();
      setData(res.data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      console.error('Error loading dashboard overview:', e);
      setError('Could not load dashboard data. Is the backend running?');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const firstName = (user as { full_name?: string; username?: string } | null)?.full_name?.split(' ')[0]
    || (user as { username?: string } | null)?.username;

  return (
    <AppLayout>
      {!data && !error ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-10">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#23292E] via-[#1f3a33] to-[#2b6b4a] px-6 py-8 text-white shadow-xl sm:px-10 animate-fade-up">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-green/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  Live programme data
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {greeting()}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="mt-2 max-w-xl text-white/70">
                  {data
                    ? `${data.metrics.total_applications.toLocaleString()} applications, ${data.metrics.alumni} alumni and ${data.metrics.cohorts} cohorts across ${data.metrics.tracks} tracks.`
                    : 'MentorLed programme overview'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {updatedAt && (
                  <span className="text-xs text-white/60">
                    Updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition-all hover:bg-white/20 active:scale-95 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Section 1 — headline metrics */}
              <Section title="Programme at a glance" subtitle="Headline numbers across every cohort" icon={Target} delay={100}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <MetricCard
                    label="Total applications"
                    value={data.metrics.total_applications}
                    icon={Users}
                    gradient="from-violet-500 to-fuchsia-500"
                    accent="#8b5cf6"
                    caption={
                      <>
                        <span className="font-semibold text-violet-600 dark:text-violet-400">{data.metrics.committed}</span> pledged full-time commitment
                      </>
                    }
                    footer={<Sparkline data={data.applications_by_month.map((m) => m.count)} color="#8b5cf6" />}
                    delay={150}
                  />
                  <MetricCard
                    label="Alumni"
                    value={data.metrics.alumni}
                    icon={GraduationCap}
                    gradient="from-emerald-500 to-teal-500"
                    accent="#10b981"
                    caption={<>Graduated fellows across {data.by_track.filter((t) => t.alumni > 0).length} tracks</>}
                    footer={
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        {data.by_track
                          .filter((t) => t.alumni > 0)
                          .map((t, i) => (
                            <div
                              key={t.track}
                              title={`${trackMeta(t.track).label}: ${t.alumni}`}
                              className="h-full origin-left animate-grow-right transition-opacity hover:opacity-80"
                              style={{
                                width: `${(t.alumni / Math.max(data.metrics.alumni, 1)) * 100}%`,
                                background: trackMeta(t.track).color,
                                animationDelay: `${300 + i * 80}ms`,
                              }}
                            />
                          ))}
                      </div>
                    }
                    delay={250}
                  />
                  <MetricCard
                    label="Selection rate"
                    value={data.metrics.selection_rate}
                    decimals={1}
                    suffix="%"
                    icon={FileCheck2}
                    gradient="from-sky-500 to-blue-600"
                    accent="#0ea5e9"
                    caption={
                      <>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">{data.metrics.selected}</span> of {data.metrics.decided} screened applicants progressed
                      </>
                    }
                    footer={<ProgressBar percent={data.metrics.selection_rate} gradient="from-sky-400 to-blue-600" />}
                    delay={350}
                  />
                </div>
              </Section>

              {/* Section 2 — charts */}
              <Section title="Pipeline insights" subtitle="Where applicants come from and how screening lands" icon={BarChart3} delay={200}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                  <div className="lg:col-span-3">
                    <Panel title="Applications by track" subtitle="Hover a bar to see alumni per track" delay={300}>
                      <TrackBarChart data={data.by_track} />
                    </Panel>
                  </div>
                  <div className="lg:col-span-2">
                    <Panel title="Screening outcomes" subtitle="Every applicant, by current decision" delay={400}>
                      <OutcomeDonut data={data.outcomes} />
                    </Panel>
                  </div>
                </div>
              </Section>

              {/* Section 3 — recent submissions */}
              <Section
                title="Recent submissions"
                subtitle="The five latest challenge submissions"
                icon={ListChecks}
                delay={300}
                action={
                  <Link
                    href="/challenges"
                    className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    View all
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                }
              >
                <div className="rounded-2xl border border-gray-200/80 bg-white px-6 pb-2 shadow-sm dark:border-gray-700/80 dark:bg-gray-800">
                  <RecentSubmissions rows={data.recent_submissions} />
                </div>
              </Section>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
