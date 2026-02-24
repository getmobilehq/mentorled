'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI, screeningAPI, healthAPI, analyticsAPI, challengesAPI, teamsAPI, sprintsAPI, meetingsAPI, activityAPI } from '@/lib/api';
import {
  Users,
  ClipboardCheck,
  AlertCircle,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Activity,
  Flag,
  Calendar,
  ArrowRight,
  Repeat,
  Target,
  Clock,
  Bell,
  Shield,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { Applicant, QueueStats, HealthCheck, ChallengeAnalytics, Team, Sprint, Meeting } from '@/types';

interface AnalyticsDashboard {
  applicants: { total: number; by_status: Record<string, number>; by_role: Record<string, number> };
  fellows: { total: number; by_status: Record<string, number>; by_risk_level: Record<string, number> };
  evaluations: { total: number; by_outcome: Record<string, number>; average_score: number; average_confidence: number; human_review_rate: number };
  ai_usage: { total_ai_calls_30d: number; total_cost_30d_usd: number; average_cost_per_call: number };
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

export default function Dashboard() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [challengeAnalytics, setChallengeAnalytics] = useState<ChallengeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Fellowship execution state
  const [teams, setTeams] = useState<Team[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [applicantsRes, queueRes, healthRes, dashboardRes, funnelRes, challengeRes, teamsRes, sprintsRes, meetingsRes, activityRes] = await Promise.all([
        applicantsAPI.list(),
        screeningAPI.getQueue(),
        healthAPI.check(),
        analyticsAPI.getDashboard().catch(() => null),
        analyticsAPI.getConversionFunnel().catch(() => null),
        challengesAPI.getAnalytics().catch(() => null),
        teamsAPI.list().catch(() => ({ data: [] })),
        sprintsAPI.list().catch(() => ({ data: [] })),
        meetingsAPI.upcoming(undefined, 7).catch(() => ({ data: [] })),
        activityAPI.feed(10).catch(() => ({ data: [] })),
      ]);

      setApplicants(applicantsRes.data);
      setQueueStats(queueRes.data);
      setHealth(healthRes.data);
      if (dashboardRes) setDashboard(dashboardRes.data);
      if (funnelRes) setFunnel(funnelRes.data);
      if (challengeRes) setChallengeAnalytics(challengeRes.data);
      setTeams(teamsRes.data);
      setSprints(sprintsRes.data);
      setUpcomingMeetings(meetingsRes.data);
      if (activityRes) setActivityFeed(activityRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      name: 'Total Applicants',
      value: dashboard?.applicants.total ?? applicants.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Active Fellows',
      value: dashboard?.fellows.total ?? 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'AI Evaluations',
      value: dashboard?.evaluations.total ?? 0,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'AI Cost (30d)',
      value: `$${dashboard?.ai_usage.total_cost_30d_usd?.toFixed(2) ?? '0.00'}`,
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  const recentApplicants = applicants.slice(0, 5);

  return (
    <AppLayout>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Page header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome to the MentorLed AI-Ops Platform
            </p>
          </div>

          {/* System Health */}
          {health && (
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">System Status</p>
                    <p className="text-sm text-gray-600">{health.service} - v{health.version}</p>
                  </div>
                </div>
                <Badge variant="success">{health.status}</Badge>
              </div>
            </Card>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.name}>
                  <div className="flex items-center">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Conversion Funnel */}
          {funnel && (
            <Card>
              <CardHeader>
                <CardTitle>Application Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {[
                    { label: 'Applied', value: funnel.applied, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Screening', value: funnel.screening, color: 'bg-yellow-100 text-yellow-800' },
                    { label: 'Eligible', value: funnel.eligible, color: 'bg-purple-100 text-purple-800' },
                    { label: 'Microship', value: funnel.microship_submitted, color: 'bg-teal-100 text-teal-800' },
                    { label: 'Accepted', value: funnel.accepted, color: 'bg-green-100 text-green-800' },
                  ].map((stage, idx, arr) => (
                    <React.Fragment key={stage.label}>
                      <div className="text-center flex-1">
                        <p className="text-2xl font-bold text-gray-900">{stage.value}</p>
                        <p className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded-full ${stage.color}`}>
                          {stage.label}
                        </p>
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

          {/* Fellowship Execution Section */}
          {sprints.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Active Sprints */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Active Sprints</CardTitle>
                    <Link href="/sprints">
                      <Button variant="ghost" size="sm">Sprint Board</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const activeSprints = sprints.filter(s => s.status === 'active');
                    if (activeSprints.length === 0) {
                      return <p className="text-center text-sm text-gray-500 py-4">No active sprints</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {activeSprints.map(sprint => {
                          const team = teams.find(t => t.id === sprint.team_id);
                          const progressPct = sprint.objective_count
                            ? Math.round(((sprint.completed_objectives || 0) / sprint.objective_count) * 100)
                            : 0;
                          return (
                            <div key={sprint.id} className="rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-gray-900">
                                  {team?.name || 'Team'} — Sprint {sprint.sprint_number}
                                </span>
                                <Badge variant="info">{sprint.status}</Badge>
                              </div>
                              {sprint.goal && (
                                <p className="text-xs text-gray-500 mb-2 truncate">{sprint.goal}</p>
                              )}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-green-500 transition-all"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-600">
                                  {sprint.completed_objectives || 0}/{sprint.objective_count || 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Fellowship Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Fellowship Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-900">Active Teams</p>
                      <p className="mt-1 text-2xl font-bold text-green-600">
                        {teams.filter(t => t.status === 'active').length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Total Sprints</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{sprints.length}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-900">Completed</p>
                      <p className="mt-1 text-2xl font-bold text-purple-600">
                        {sprints.filter(s => s.status === 'completed').length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm font-medium text-orange-900">Upcoming Meetings</p>
                      <p className="mt-1 text-2xl font-bold text-orange-600">{upcomingMeetings.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Two column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Applicants */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Applicants</CardTitle>
                  <Link href="/applicants">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentApplicants.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">No applicants yet</p>
                ) : (
                  <div className="space-y-4">
                    {recentApplicants.map((applicant) => (
                      <div key={applicant.id} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-gray-900">{applicant.name}</p>
                          <p className="text-sm text-gray-600">{applicant.role.replace('_', ' ')}</p>
                        </div>
                        <Badge variant={applicant.status === 'accepted' ? 'success' : 'default'}>
                          {applicant.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Challenge Activity */}
            {challengeAnalytics && challengeAnalytics.total_challenges > 0 ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Challenge Activity</CardTitle>
                    <Link href="/challenges">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Total Challenges</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{challengeAnalytics.total_challenges}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-900">Submissions</p>
                      <p className="mt-1 text-2xl font-bold text-green-600">{challengeAnalytics.total_submissions}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-900">Evaluated</p>
                      <p className="mt-1 text-2xl font-bold text-purple-600">{challengeAnalytics.total_evaluated}</p>
                    </div>
                    <div className="text-center p-3 bg-teal-50 rounded-lg">
                      <p className="text-sm font-medium text-teal-900">Pass Rate</p>
                      <p className="mt-1 text-2xl font-bold text-teal-600">{challengeAnalytics.pass_rate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Link href="/screening" className="block">
                      <Button variant="primary" className="w-full justify-start">
                        <ClipboardCheck className="mr-2 h-5 w-5" />
                        Review Screening Queue
                        {queueStats && queueStats.requires_review > 0 && (
                          <Badge variant="danger" className="ml-auto">{queueStats.requires_review}</Badge>
                        )}
                      </Button>
                    </Link>
                    <Link href="/challenges" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <Flag className="mr-2 h-5 w-5" />
                        Manage Challenges
                      </Button>
                    </Link>
                    <Link href="/cohorts" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <Calendar className="mr-2 h-5 w-5" />
                        Manage Cohorts
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Activity Feed */}
          {activityFeed.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Recent Activity
                  </CardTitle>
                  <Link href="/audit-log">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityFeed.slice(0, 8).map((item: any, idx: number) => {
                    const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
                      risk_alert: <AlertTriangle className="h-4 w-4 text-orange-500" />,
                      warning_issued: <Shield className="h-4 w-4 text-red-500" />,
                      evaluation: <ClipboardCheck className="h-4 w-4 text-purple-500" />,
                      acceptance: <CheckCircle className="h-4 w-4 text-green-500" />,
                      meeting: <Calendar className="h-4 w-4 text-blue-500" />,
                      sprint: <Repeat className="h-4 w-4 text-teal-500" />,
                      system: <Zap className="h-4 w-4 text-gray-500" />,
                    };
                    const icon = ACTIVITY_ICONS[item.type || item.action] || <Bell className="h-4 w-4 text-gray-400" />;
                    return (
                      <div key={item.id || idx} className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{item.title || item.message || item.action}</p>
                          {item.message && item.title && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.message}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions + Screening Queue */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Quick Actions (always shown when challenge activity is above) */}
            {challengeAnalytics && challengeAnalytics.total_challenges > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Link href="/screening" className="block">
                      <Button variant="primary" className="w-full justify-start">
                        <ClipboardCheck className="mr-2 h-5 w-5" />
                        Review Screening Queue
                        {queueStats && queueStats.requires_review > 0 && (
                          <Badge variant="danger" className="ml-auto">{queueStats.requires_review}</Badge>
                        )}
                      </Button>
                    </Link>
                    <Link href="/challenges" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <Flag className="mr-2 h-5 w-5" />
                        Manage Challenges
                      </Button>
                    </Link>
                    <Link href="/cohorts" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <Calendar className="mr-2 h-5 w-5" />
                        Manage Cohorts
                      </Button>
                    </Link>
                    <Link href="/sprints" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <Repeat className="mr-2 h-5 w-5" />
                        Sprint Board
                      </Button>
                    </Link>
                    <Link href="/risk" className="block">
                      <Button variant="secondary" className="w-full justify-start">
                        <AlertCircle className="mr-2 h-5 w-5" />
                        Risk Dashboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Screening Queue Summary */}
            {queueStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Screening Queue Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-900">Pending Applications</p>
                      <p className="mt-1 text-3xl font-bold text-blue-600">{queueStats.pending_applications}</p>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-4">
                      <p className="text-sm font-medium text-yellow-900">Pending Microships</p>
                      <p className="mt-1 text-3xl font-bold text-yellow-600">{queueStats.pending_microships}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-900">Requires Review</p>
                      <p className="mt-1 text-3xl font-bold text-red-600">{queueStats.requires_review}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
