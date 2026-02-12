'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { analyticsAPI, challengesAPI, cohortsAPI } from '@/lib/api';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  Activity,
  AlertCircle,
  Download,
  Target,
  Flag,
  Shield,
  Zap,
  ArrowRight,
} from 'lucide-react';
import type { Cohort, ChallengeAnalytics } from '@/types';

interface AnalyticsDashboard {
  applicants: {
    total: number;
    by_status: Record<string, number>;
    by_role: Record<string, number>;
    by_source: Record<string, number>;
  };
  fellows: {
    total: number;
    by_status: Record<string, number>;
    by_risk_level: Record<string, number>;
    average_milestone_1: number;
    average_milestone_2: number;
  };
  evaluations: {
    total: number;
    by_outcome: Record<string, number>;
    average_score: number;
    average_confidence: number;
    human_review_rate: number;
  };
  risk_assessments: {
    total_assessments: number;
    by_risk_level: Record<string, number>;
  };
  ai_usage: {
    total_ai_calls_30d: number;
    total_cost_30d_usd: number;
    average_cost_per_call: number;
  };
  generated_at: string;
}

interface ConversionFunnel {
  applied: number;
  screening: number;
  eligible: number;
  microship_submitted: number;
  microship_evaluated: number;
  accepted: number;
  not_eligible: number;
  conversion_rate: number;
}

interface AIPerformance {
  total_evaluations: number;
  confidence_distribution: {
    'high (>= 80%)': number;
    'medium (60-79%)': number;
    'low (< 60%)': number;
  };
  human_override_count: number;
  human_override_rate: number;
}

interface TrendData {
  applications_by_day: Array<{ date: string; count: number }>;
  evaluations_by_day: Array<{ date: string; count: number }>;
  submissions_by_day: Array<{ date: string; count: number }>;
}

interface CohortComparison {
  cohorts: Array<{
    id: string;
    name: string;
    status: string;
    applicant_count: number;
    fellow_count: number;
    accepted_count: number;
    conversion_rate: number;
    average_eval_score: number;
  }>;
}

type TabKey = 'overview' | 'pipeline' | 'fellows' | 'challenges' | 'ai';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'fellows', label: 'Fellows & Risk' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'ai', label: 'AI Performance' },
];

const ROLE_LABELS: Record<string, string> = {
  product_manager: 'Product Manager',
  product_designer: 'Product Designer',
  frontend: 'Frontend',
  backend: 'Backend',
  qa: 'QA',
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-500',
  screening: 'bg-yellow-500',
  eligible: 'bg-purple-500',
  not_eligible: 'bg-red-400',
  microship_pending: 'bg-teal-400',
  microship_submitted: 'bg-teal-500',
  microship_evaluated: 'bg-teal-600',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  withdrawn: 'bg-gray-400',
};

const RISK_COLORS: Record<string, string> = {
  on_track: 'bg-green-500',
  monitor: 'bg-yellow-500',
  at_risk: 'bg-orange-500',
  critical: 'bg-red-500',
};

function HorizontalBar({ value, maxValue, color, label, count }: {
  value: number; maxValue: number; color: string; label: string; count: number;
}) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32 truncate capitalize">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
        <div
          className={`h-5 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(width, 1)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-900 w-10 text-right">{count}</span>
    </div>
  );
}

function TrendChart({ data, color, label }: {
  data: Array<{ date: string; count: number }>; color: string; label: string;
}) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No data available</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.map((d, i) => {
              const height = (d.count / maxCount) * 100;
              const dateObj = new Date(d.date + 'T00:00:00');
              const dayLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="absolute -top-6 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {dayLabel}: {d.count}
                  </div>
                  <div
                    className={`w-full rounded-t ${color} transition-all duration-300 min-h-[2px]`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {data.length <= 14 && (
                    <span className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-left whitespace-nowrap">
                      {dateObj.getDate()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [aiPerformance, setAIPerformance] = useState<AIPerformance | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [cohortComparison, setCohortComparison] = useState<CohortComparison | null>(null);
  const [challengeAnalytics, setChallengeAnalytics] = useState<ChallengeAnalytics | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async (cohortId?: string) => {
    try {
      const [dashboardRes, funnelRes, aiPerfRes, trendsRes, comparisonRes, challengeRes, cohortsRes] = await Promise.all([
        analyticsAPI.getDashboard(cohortId).catch(() => null),
        analyticsAPI.getConversionFunnel(cohortId).catch(() => null),
        analyticsAPI.getAIPerformance(cohortId).catch(() => null),
        analyticsAPI.getTrends(cohortId).catch(() => null),
        analyticsAPI.getCohortComparison().catch(() => null),
        challengesAPI.getAnalytics(cohortId).catch(() => null),
        cohortsAPI.list().catch(() => null),
      ]);

      if (dashboardRes) setDashboard(dashboardRes.data);
      if (funnelRes) setFunnel(funnelRes.data);
      if (aiPerfRes) setAIPerformance(aiPerfRes.data);
      if (trendsRes) setTrends(trendsRes.data);
      if (comparisonRes) setCohortComparison(comparisonRes.data);
      if (challengeRes) setChallengeAnalytics(challengeRes.data);
      if (cohortsRes) setCohorts(cohortsRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedCohortId || undefined);
  }, [selectedCohortId, fetchAnalytics]);

  const handleExportCSV = useCallback(() => {
    const rows: string[][] = [];
    rows.push(['MentorLed Analytics Report']);
    rows.push(['Generated', new Date().toLocaleString()]);
    if (selectedCohortId) {
      const cohort = cohorts.find(c => c.id === selectedCohortId);
      rows.push(['Cohort', cohort?.name || selectedCohortId]);
    }
    rows.push([]);

    if (dashboard) {
      rows.push(['--- Summary ---']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Applicants', String(dashboard.applicants.total)]);
      rows.push(['Total Fellows', String(dashboard.fellows.total)]);
      rows.push(['AI Evaluations', String(dashboard.evaluations.total)]);
      rows.push(['AI Cost (30d)', `$${dashboard.ai_usage.total_cost_30d_usd.toFixed(2)}`]);
      rows.push(['Avg Eval Score', dashboard.evaluations.average_score.toFixed(1)]);
      rows.push(['Avg Confidence', `${(dashboard.evaluations.average_confidence * 100).toFixed(1)}%`]);
      rows.push(['Human Review Rate', `${dashboard.evaluations.human_review_rate.toFixed(1)}%`]);
      rows.push([]);

      rows.push(['--- Applicants by Role ---']);
      rows.push(['Role', 'Count']);
      Object.entries(dashboard.applicants.by_role).forEach(([role, count]) => {
        rows.push([ROLE_LABELS[role] || role, String(count)]);
      });
      rows.push([]);

      rows.push(['--- Applicants by Status ---']);
      rows.push(['Status', 'Count']);
      Object.entries(dashboard.applicants.by_status).forEach(([status, count]) => {
        rows.push([status.replace(/_/g, ' '), String(count)]);
      });
      rows.push([]);

      rows.push(['--- Fellows by Risk Level ---']);
      rows.push(['Risk Level', 'Count']);
      Object.entries(dashboard.fellows.by_risk_level).forEach(([level, count]) => {
        rows.push([level.replace(/_/g, ' '), String(count)]);
      });
      rows.push([]);
    }

    if (funnel) {
      rows.push(['--- Conversion Funnel ---']);
      rows.push(['Stage', 'Count']);
      rows.push(['Applied', String(funnel.applied)]);
      rows.push(['Screening', String(funnel.screening)]);
      rows.push(['Eligible', String(funnel.eligible)]);
      rows.push(['Microship Submitted', String(funnel.microship_submitted)]);
      rows.push(['Microship Evaluated', String(funnel.microship_evaluated)]);
      rows.push(['Accepted', String(funnel.accepted)]);
      rows.push(['Not Eligible', String(funnel.not_eligible)]);
      rows.push(['Conversion Rate', `${funnel.conversion_rate.toFixed(1)}%`]);
      rows.push([]);
    }

    if (challengeAnalytics) {
      rows.push(['--- Challenge Analytics ---']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Challenges', String(challengeAnalytics.total_challenges)]);
      rows.push(['Total Submissions', String(challengeAnalytics.total_submissions)]);
      rows.push(['Pass Rate', `${challengeAnalytics.pass_rate}%`]);
      rows.push(['Avg Score', String(challengeAnalytics.average_score.toFixed(2))]);
      rows.push(['On-Time Rate', `${challengeAnalytics.on_time_rate}%`]);
      rows.push([]);

      if (challengeAnalytics.per_challenge.length > 0) {
        rows.push(['--- Per Challenge ---']);
        rows.push(['Title', 'Role', 'Submissions', 'Evaluated', 'Avg Score', 'Pass Rate']);
        challengeAnalytics.per_challenge.forEach(c => {
          rows.push([c.title, c.role_type, String(c.submission_count), String(c.evaluated_count), c.average_score.toFixed(2), `${c.pass_rate}%`]);
        });
        rows.push([]);
      }
    }

    const csvContent = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mentorled-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dashboard, funnel, challengeAnalytics, cohorts, selectedCohortId]);

  const maxByRole = useMemo(() => {
    if (!dashboard) return 0;
    return Math.max(...Object.values(dashboard.applicants.by_role), 1);
  }, [dashboard]);

  const maxBySource = useMemo(() => {
    if (!dashboard) return 0;
    return Math.max(...Object.values(dashboard.applicants.by_source), 1);
  }, [dashboard]);

  const maxByStatus = useMemo(() => {
    if (!dashboard) return 0;
    return Math.max(...Object.values(dashboard.applicants.by_status), 1);
  }, [dashboard]);

  const maxFellowStatus = useMemo(() => {
    if (!dashboard) return 0;
    return Math.max(...Object.values(dashboard.fellows.by_status), 1);
  }, [dashboard]);

  const maxRiskLevel = useMemo(() => {
    if (!dashboard) return 0;
    const riskValues = Object.values(dashboard.fellows.by_risk_level);
    return riskValues.length > 0 ? Math.max(...riskValues, 1) : 1;
  }, [dashboard]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics & Reporting</h1>
            <p className="mt-1 text-gray-600">
              Comprehensive metrics and insights across the platform
            </p>
            {dashboard && (
              <p className="mt-1 text-xs text-gray-400">
                Last updated: {new Date(dashboard.generated_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCohortId}
              onChange={(e) => { setSelectedCohortId(e.target.value); setLoading(true); }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 6 Key Metrics */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'Applicants', value: dashboard?.applicants.total || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
                { label: 'Fellows', value: dashboard?.fellows.total || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
                { label: 'AI Evaluations', value: dashboard?.evaluations.total || 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100' },
                { label: 'AI Cost (30d)', value: `$${dashboard?.ai_usage.total_cost_30d_usd?.toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-100' },
                { label: 'Conversion', value: `${funnel?.conversion_rate?.toFixed(1) || '0'}%`, icon: Target, color: 'text-teal-600', bg: 'bg-teal-100' },
                { label: 'Challenges', value: challengeAnalytics?.total_challenges || 0, icon: Flag, color: 'text-orange-600', bg: 'bg-orange-100' },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg} flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-500 truncate">{stat.label}</p>
                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Application Trend */}
            {trends && trends.applications_by_day.length > 0 && (
              <TrendChart
                data={trends.applications_by_day}
                color="bg-blue-400"
                label="Applications (Last 30 Days)"
              />
            )}

            {/* Role + Source Distribution */}
            {dashboard && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Applicants by Role</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard.applicants.by_role).map(([role, count]) => (
                        <HorizontalBar
                          key={role}
                          value={count}
                          maxValue={maxByRole}
                          color="bg-blue-400"
                          label={ROLE_LABELS[role] || role}
                          count={count}
                        />
                      ))}
                      {Object.keys(dashboard.applicants.by_role).length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-4">No data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Applicants by Source</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard.applicants.by_source).map(([source, count]) => (
                        <HorizontalBar
                          key={source}
                          value={count}
                          maxValue={maxBySource}
                          color="bg-purple-400"
                          label={source}
                          count={count}
                        />
                      ))}
                      {Object.keys(dashboard.applicants.by_source).length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-4">No data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Cohort Comparison */}
            {cohortComparison && cohortComparison.cohorts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cohort Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cohort</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Applicants</TableHead>
                          <TableHead>Fellows</TableHead>
                          <TableHead>Accepted</TableHead>
                          <TableHead>Conversion</TableHead>
                          <TableHead>Avg Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohortComparison.cohorts.map(c => (
                          <TableRow key={c.id}>
                            <TableCell><span className="font-medium">{c.name}</span></TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'default' : 'warning'}>
                                {c.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>{c.applicant_count}</TableCell>
                            <TableCell>{c.fellow_count}</TableCell>
                            <TableCell>{c.accepted_count}</TableCell>
                            <TableCell>
                              <span className="font-semibold">{c.conversion_rate}%</span>
                            </TableCell>
                            <TableCell>{c.average_eval_score || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Pipeline */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Visual Funnel */}
            {funnel && (
              <Card>
                <CardHeader>
                  <CardTitle>Application Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {[
                      { label: 'Applied', value: funnel.applied, color: 'bg-blue-100 text-blue-800' },
                      { label: 'Screening', value: funnel.screening, color: 'bg-yellow-100 text-yellow-800' },
                      { label: 'Eligible', value: funnel.eligible, color: 'bg-purple-100 text-purple-800' },
                      { label: 'Microship', value: funnel.microship_submitted, color: 'bg-teal-100 text-teal-800' },
                      { label: 'Evaluated', value: funnel.microship_evaluated, color: 'bg-indigo-100 text-indigo-800' },
                      { label: 'Accepted', value: funnel.accepted, color: 'bg-green-100 text-green-800' },
                    ].map((stage, idx, arr) => (
                      <React.Fragment key={stage.label}>
                        <div className="text-center flex-1 min-w-[80px]">
                          <p className="text-2xl font-bold text-gray-900">{stage.value}</p>
                          <p className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded-full ${stage.color}`}>
                            {stage.label}
                          </p>
                          {idx > 0 && arr[idx - 1].value > 0 && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {((stage.value / arr[idx - 1].value) * 100).toFixed(0)}% from prev
                            </p>
                          )}
                        </div>
                        {idx < arr.length - 1 && (
                          <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="text-center mt-4 pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Overall Conversion: </span>
                    <span className="text-lg font-bold text-gray-900">{funnel.conversion_rate.toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Applicants by Status */}
            {dashboard && (
              <Card>
                <CardHeader>
                  <CardTitle>Applicants by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(dashboard.applicants.by_status).map(([status, count]) => (
                      <HorizontalBar
                        key={status}
                        value={count}
                        maxValue={maxByStatus}
                        color={STATUS_COLORS[status] || 'bg-gray-400'}
                        label={status.replace(/_/g, ' ')}
                        count={count}
                      />
                    ))}
                    {Object.keys(dashboard.applicants.by_status).length === 0 && (
                      <p className="text-center text-sm text-gray-500 py-4">No applicant data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evaluation Outcomes */}
            {dashboard && Object.keys(dashboard.evaluations.by_outcome).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Evaluation Outcomes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Object.entries(dashboard.evaluations.by_outcome).map(([outcome, count]) => (
                      <div key={outcome} className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600 capitalize">{outcome.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{count}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Fellows & Risk */}
        {activeTab === 'fellows' && (
          <div className="space-y-6">
            {/* Fellow Summary */}
            {dashboard && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                  <div className="text-center p-2">
                    <p className="text-sm font-medium text-gray-600">Total Fellows</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">{dashboard.fellows.total}</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center p-2">
                    <p className="text-sm font-medium text-gray-600">Avg Milestone 1</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {dashboard.fellows.average_milestone_1 ? dashboard.fellows.average_milestone_1.toFixed(1) : '—'}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center p-2">
                    <p className="text-sm font-medium text-gray-600">Avg Milestone 2</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {dashboard.fellows.average_milestone_2 ? dashboard.fellows.average_milestone_2.toFixed(1) : '—'}
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* Fellows by Status + Risk Level */}
            {dashboard && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Fellows by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard.fellows.by_status).map(([status, count]) => (
                        <HorizontalBar
                          key={status}
                          value={count}
                          maxValue={maxFellowStatus}
                          color="bg-blue-400"
                          label={status.replace(/_/g, ' ')}
                          count={count}
                        />
                      ))}
                      {Object.keys(dashboard.fellows.by_status).length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-4">No fellow data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Risk Level Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['on_track', 'monitor', 'at_risk', 'critical'].map(level => {
                        const count = dashboard.fellows.by_risk_level[level] || 0;
                        return (
                          <HorizontalBar
                            key={level}
                            value={count}
                            maxValue={maxRiskLevel}
                            color={RISK_COLORS[level] || 'bg-gray-400'}
                            label={level.replace(/_/g, ' ')}
                            count={count}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Risk Assessment Stats */}
            {dashboard && (
              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-600">Total</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{dashboard.risk_assessments.total_assessments}</p>
                    </div>
                    {['on_track', 'monitor', 'at_risk', 'critical'].map(level => (
                      <div key={level} className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600 capitalize">{level.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {dashboard.risk_assessments.by_risk_level[level] || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Challenges */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            {challengeAnalytics ? (
              <>
                {/* Challenge Stats Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { label: 'Challenges', value: challengeAnalytics.total_challenges },
                    { label: 'Submissions', value: challengeAnalytics.total_submissions },
                    { label: 'Evaluated', value: challengeAnalytics.total_evaluated },
                    { label: 'Pending', value: challengeAnalytics.pending_evaluation },
                    { label: 'Pass Rate', value: `${challengeAnalytics.pass_rate}%` },
                    { label: 'Avg Score', value: challengeAnalytics.average_score.toFixed(2) },
                    { label: 'On-Time', value: `${challengeAnalytics.on_time_rate}%` },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <div className="text-center p-1">
                        <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Outcome Rates */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card>
                    <div className="text-center p-3">
                      <p className="text-sm font-medium text-green-700">Pass Rate</p>
                      <p className="mt-1 text-3xl font-bold text-green-600">{challengeAnalytics.pass_rate}%</p>
                    </div>
                  </Card>
                  <Card>
                    <div className="text-center p-3">
                      <p className="text-sm font-medium text-yellow-700">Borderline Rate</p>
                      <p className="mt-1 text-3xl font-bold text-yellow-600">{challengeAnalytics.borderline_rate}%</p>
                    </div>
                  </Card>
                  <Card>
                    <div className="text-center p-3">
                      <p className="text-sm font-medium text-red-700">Fail Rate</p>
                      <p className="mt-1 text-3xl font-bold text-red-600">{challengeAnalytics.fail_rate}%</p>
                    </div>
                  </Card>
                </div>

                {/* Per-Challenge Breakdown */}
                {challengeAnalytics.per_challenge.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Per-Challenge Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Challenge</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Submissions</TableHead>
                              <TableHead>Evaluated</TableHead>
                              <TableHead>Avg Score</TableHead>
                              <TableHead>Pass Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {challengeAnalytics.per_challenge.map(c => (
                              <TableRow key={c.challenge_id}>
                                <TableCell><span className="font-medium">{c.title}</span></TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{ROLE_LABELS[c.role_type] || c.role_type}</Badge>
                                </TableCell>
                                <TableCell>{c.submission_count}</TableCell>
                                <TableCell>{c.evaluated_count}</TableCell>
                                <TableCell>{c.average_score.toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                                      <div
                                        className="h-2 rounded-full bg-green-500"
                                        style={{ width: `${c.pass_rate}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium">{c.pass_rate}%</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Submissions Trend */}
                {challengeAnalytics.submissions_by_day && challengeAnalytics.submissions_by_day.length > 0 && (
                  <TrendChart
                    data={challengeAnalytics.submissions_by_day}
                    color="bg-teal-400"
                    label="Challenge Submissions (Last 14 Days)"
                  />
                )}
              </>
            ) : (
              <Card>
                <div className="text-center py-12 text-gray-500">
                  <Flag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No challenge data available</p>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Tab: AI Performance */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            {aiPerformance && dashboard ? (
              <>
                {/* Confidence + Summary */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Confidence Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(aiPerformance.confidence_distribution).map(([level, count]) => (
                          <div key={level}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{level}</span>
                              <span className="text-sm font-bold text-gray-900">{count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  level.includes('high') ? 'bg-green-500' :
                                  level.includes('medium') ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{
                                  width: `${aiPerformance.total_evaluations > 0 ? (count / aiPerformance.total_evaluations) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>AI Performance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: 'Average Score', value: `${dashboard.evaluations.average_score.toFixed(1)}/100` },
                          { label: 'Average Confidence', value: `${(dashboard.evaluations.average_confidence * 100).toFixed(1)}%` },
                          { label: 'Human Review Rate', value: `${dashboard.evaluations.human_review_rate.toFixed(1)}%` },
                          { label: 'Human Override Rate', value: `${aiPerformance.human_override_rate.toFixed(1)}%` },
                          { label: 'Total Evaluations', value: String(aiPerformance.total_evaluations) },
                          { label: 'Human Overrides', value: String(aiPerformance.human_override_count) },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                            <span className="text-lg font-bold text-gray-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Usage & Costs */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Usage & Cost (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Total AI Calls</p>
                        <p className="mt-1 text-2xl font-bold text-blue-600">
                          {dashboard.ai_usage.total_ai_calls_30d}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-900">Total Cost</p>
                        <p className="mt-1 text-2xl font-bold text-green-600">
                          ${dashboard.ai_usage.total_cost_30d_usd.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-purple-900">Avg Cost/Call</p>
                        <p className="mt-1 text-2xl font-bold text-purple-600">
                          ${dashboard.ai_usage.average_cost_per_call.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evaluations Trend */}
                {trends && trends.evaluations_by_day.length > 0 && (
                  <TrendChart
                    data={trends.evaluations_by_day}
                    color="bg-purple-400"
                    label="AI Evaluations (Last 30 Days)"
                  />
                )}
              </>
            ) : (
              <Card>
                <div className="text-center py-12 text-gray-500">
                  <Zap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No AI performance data available</p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
