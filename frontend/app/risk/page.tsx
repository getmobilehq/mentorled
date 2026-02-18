'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { riskAPI, cohortsAPI } from '@/lib/api';
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Users, Shield, BarChart3, Activity, Target, Calendar,
  Clock, Eye, Zap,
} from 'lucide-react';
import type { Cohort, RiskAssessmentDetail, RiskSignals, RiskConcern, RiskAlert } from '@/types';

// Signal display configuration
const SIGNAL_CONFIG: Record<keyof RiskSignals, { label: string; weight: string; icon: React.ReactNode }> = {
  attendance_score: { label: 'Attendance', weight: '20%', icon: <Calendar className="h-4 w-4" /> },
  check_in_sentiment: { label: 'Sentiment', weight: '15%', icon: <Activity className="h-4 w-4" /> },
  check_in_completeness: { label: 'Completeness', weight: '10%', icon: <CheckCircle className="h-4 w-4" /> },
  sprint_delivery: { label: 'Sprint Delivery', weight: '25%', icon: <Target className="h-4 w-4" /> },
  evidence_submission: { label: 'Evidence', weight: '15%', icon: <Eye className="h-4 w-4" /> },
  mentor_flags: { label: 'Mentor Flags', weight: '10%', icon: <Shield className="h-4 w-4" /> },
  trend: { label: 'Trend', weight: '5%', icon: <TrendingUp className="h-4 w-4" /> },
};

interface RiskDashboardFellow {
  id: string;
  name: string;
  email?: string;
  role: string;
  team_id?: string | null;
  team_name?: string | null;
  risk_level: string;
  risk_score: number;
  signals: RiskSignals;
  concerns: RiskConcern[];
  recommended_action?: string;
  warnings_count: number;
}

interface RiskDashboardData {
  summary: {
    on_track: number;
    monitor: number;
    at_risk: number;
    critical: number;
  };
  fellows: RiskDashboardFellow[];
}

const RISK_COLORS: Record<string, { bg: string; text: string; bar: string; badge: 'success' | 'warning' | 'danger' | 'info' }> = {
  on_track: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', badge: 'success' },
  monitor: { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500', badge: 'warning' },
  at_risk: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', badge: 'danger' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', badge: 'danger' },
};

function getSignalColor(value: number): string {
  if (value >= 0.7) return 'bg-green-500';
  if (value >= 0.5) return 'bg-yellow-500';
  if (value >= 0.3) return 'bg-orange-500';
  return 'bg-red-500';
}

function formatRiskLevel(level: string): string {
  return level.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function RiskDashboardPage() {
  const [dashboardData, setDashboardData] = useState<RiskDashboardData | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'on_track' | 'monitor' | 'at_risk' | 'critical'>('all');

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFellow, setSelectedFellow] = useState<RiskDashboardFellow | null>(null);
  const [fellowRiskHistory, setFellowRiskHistory] = useState<RiskAssessmentDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [recordingAction, setRecordingAction] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessResult, setAssessResult] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    if (selectedCohortId) {
      fetchDashboard();
      fetchAlerts();
    }
  }, [selectedCohortId, currentWeek]);

  const fetchCohorts = async () => {
    try {
      const res = await cohortsAPI.list();
      setCohorts(res.data);
      if (res.data.length > 0) setSelectedCohortId(res.data[0].id);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchDashboard = async () => {
    if (!selectedCohortId) return;
    setLoading(true);
    try {
      const res = await riskAPI.getDashboard(selectedCohortId, currentWeek);
      setDashboardData(res.data);
    } catch (error) {
      console.error('Error fetching risk dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    if (!selectedCohortId) return;
    try {
      const res = await riskAPI.getAlerts(selectedCohortId);
      setAlerts(res.data);
      setAlertsDismissed(new Set());
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const dismissAlert = (key: string) => {
    setAlertsDismissed(prev => new Set([...prev, key]));
  };

  const handleViewFellow = async (fellow: RiskDashboardFellow) => {
    setSelectedFellow(fellow);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    setSelectedAction('');
    try {
      const res = await riskAPI.getFellowHistory(fellow.id);
      setFellowRiskHistory(res.data);
    } catch (error) {
      console.error('Error fetching risk history:', error);
      setFellowRiskHistory([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRecordAction = async () => {
    if (!selectedAction || fellowRiskHistory.length === 0) return;
    setRecordingAction(true);
    try {
      await riskAPI.recordAction(fellowRiskHistory[0].id, selectedAction);
      const res = await riskAPI.getFellowHistory(selectedFellow!.id);
      setFellowRiskHistory(res.data);
      setSelectedAction('');
    } catch (error) {
      console.error('Error recording action:', error);
    } finally {
      setRecordingAction(false);
    }
  };

  const handleAssessAll = async () => {
    if (!selectedCohortId) return;
    setAssessing(true);
    setAssessResult(null);
    try {
      const res = await riskAPI.assessBulk(selectedCohortId, currentWeek);
      const data = res.data;
      setAssessResult(
        `Assessed ${data.assessed} fellows: ${data.summary.on_track} on track, ${data.summary.monitor} monitor, ${data.summary.at_risk} at risk, ${data.summary.critical} critical${data.errors > 0 ? ` (${data.errors} errors)` : ''}`
      );
      await fetchDashboard();
    } catch (error) {
      console.error('Error assessing all:', error);
      setAssessResult('Bulk assessment failed. Check console for details.');
    } finally {
      setAssessing(false);
    }
  };

  const filteredFellows = useMemo(() => {
    if (!dashboardData) return [];
    const sorted = [...dashboardData.fellows].sort((a, b) => a.risk_score - b.risk_score);
    if (filter === 'all') return sorted;
    return sorted.filter(f => f.risk_level === filter);
  }, [dashboardData, filter]);

  const totalFellows = dashboardData?.fellows.length || 0;

  if (loading && !dashboardData) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Dashboard</h1>
          <p className="mt-2 text-gray-600">
            7-signal weighted risk assessment for active fellows
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
            <input
              type="number"
              min="1"
              max="12"
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 w-20"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(parseInt(e.target.value) || 1)}
            />
          </div>
          <Button onClick={fetchDashboard} size="sm" variant="secondary">
            <Zap className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={handleAssessAll} size="sm" disabled={assessing || !selectedCohortId}>
            {assessing ? (
              <><Activity className="mr-1 h-4 w-4 animate-spin" /> Assessing...</>
            ) : (
              <><Target className="mr-1 h-4 w-4" /> Assess All</>
            )}
          </Button>
        </div>

        {assessResult && (
          <div className={`rounded-lg border p-3 text-sm ${assessResult.includes('failed') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {assessResult}
          </div>
        )}

        {/* Pattern Detection Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Pattern Alerts ({alerts.filter(a => !alertsDismissed.has(`${a.fellow_id}-${a.alert_type}`)).length})
            </h3>
            {alerts
              .filter(a => !alertsDismissed.has(`${a.fellow_id}-${a.alert_type}`))
              .map((alert) => {
                const key = `${alert.fellow_id}-${alert.alert_type}`;
                const severityStyles = {
                  critical: 'bg-red-50 border-red-300 text-red-800',
                  high: 'bg-orange-50 border-orange-300 text-orange-800',
                  medium: 'bg-yellow-50 border-yellow-300 text-yellow-800',
                };
                const alertIcons: Record<string, React.ReactNode> = {
                  high_absences: <Calendar className="h-4 w-4" />,
                  low_attendance: <Users className="h-4 w-4" />,
                  low_sentiment: <TrendingDown className="h-4 w-4" />,
                  persistent_risk: <Shield className="h-4 w-4" />,
                  low_energy: <Activity className="h-4 w-4" />,
                };
                const alertLabels: Record<string, string> = {
                  high_absences: 'High Absences',
                  low_attendance: 'Low Attendance',
                  low_sentiment: 'Low Sentiment',
                  persistent_risk: 'Persistent Risk',
                  low_energy: 'Low Energy',
                };
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg border p-3 ${severityStyles[alert.severity]}`}
                  >
                    <div className="flex items-center gap-3">
                      {alertIcons[alert.alert_type] || <AlertTriangle className="h-4 w-4" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{alert.fellow_name}</span>
                          <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}>
                            {alertLabels[alert.alert_type] || alert.alert_type}
                          </Badge>
                        </div>
                        <p className="text-xs mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-75">{alert.recommended_action}</span>
                      <button
                        onClick={() => dismissAlert(key)}
                        className="text-xs opacity-50 hover:opacity-100 ml-2"
                        title="Dismiss"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {dashboardData && (
          <>
            {/* Risk Distribution */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(['on_track', 'monitor', 'at_risk', 'critical'] as const).map((level) => {
                const count = dashboardData.summary[level];
                const pct = totalFellows > 0 ? Math.round((count / totalFellows) * 100) : 0;
                const colors = RISK_COLORS[level];
                const icons = {
                  on_track: <CheckCircle className="h-5 w-5 text-green-600" />,
                  monitor: <TrendingUp className="h-5 w-5 text-yellow-600" />,
                  at_risk: <AlertTriangle className="h-5 w-5 text-orange-600" />,
                  critical: <Shield className="h-5 w-5 text-red-600" />,
                };
                return (
                  <Card
                    key={level}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${filter === level ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setFilter(filter === level ? 'all' : level)}
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {icons[level]}
                        <span className="text-sm font-medium text-gray-600">{formatRiskLevel(level)}</span>
                      </div>
                      <p className={`mt-2 text-3xl font-bold ${colors.text}`}>{count}</p>
                      <p className="text-xs text-gray-500 mt-1">{pct}% of fellows</p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Risk Distribution Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                  Risk Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
                  {totalFellows > 0 && (['on_track', 'monitor', 'at_risk', 'critical'] as const).map((level) => {
                    const pct = (dashboardData.summary[level] / totalFellows) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={level}
                        className={`${RISK_COLORS[level].bar} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${formatRiskLevel(level)}: ${dashboardData.summary[level]} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> On Track</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Monitor</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> At Risk</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Critical</span>
                </div>
              </CardContent>
            </Card>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'on_track', 'monitor', 'at_risk', 'critical'] as const).map((f) => {
                const count = f === 'all' ? totalFellows : dashboardData.summary[f];
                return (
                  <Button
                    key={f}
                    variant={filter === f ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : formatRiskLevel(f)} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Fellows Table */}
            <Card padding={false}>
              <CardHeader className="px-6 pt-6">
                <CardTitle>Fellows ({filteredFellows.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {filteredFellows.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {filter === 'all'
                        ? 'No fellows found in this cohort.'
                        : `No fellows in "${formatRiskLevel(filter)}" category.`}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fellow</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Top Signals</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="text-right">-</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFellows.map((fellow) => {
                        const colors = RISK_COLORS[fellow.risk_level] || RISK_COLORS.on_track;
                        // Find lowest 2 signals
                        const signalEntries = fellow.signals
                          ? Object.entries(fellow.signals)
                            .sort(([, a], [, b]) => (a as number) - (b as number))
                            .slice(0, 2)
                          : [];
                        return (
                          <TableRow
                            key={fellow.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => handleViewFellow(fellow)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium text-gray-900">{fellow.name}</p>
                                <p className="text-xs text-gray-500 capitalize">{fellow.role.replace(/_/g, ' ')}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {fellow.team_name ? (
                                <Badge variant="secondary">{fellow.team_name}</Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={colors.badge}>
                                {formatRiskLevel(fellow.risk_level)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${colors.bar}`}
                                    style={{ width: `${fellow.risk_score * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold">{Math.round(fellow.risk_score * 100)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {signalEntries.map(([key, val]) => {
                                  const cfg = SIGNAL_CONFIG[key as keyof RiskSignals];
                                  const v = val as number;
                                  return (
                                    <span
                                      key={key}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                        v < 0.5 ? 'bg-red-100 text-red-700' : v < 0.7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                      }`}
                                      title={`${cfg?.label}: ${Math.round(v * 100)}%`}
                                    >
                                      {cfg?.label.substring(0, 4)} {Math.round(v * 100)}%
                                    </span>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {fellow.recommended_action && (
                                <span className="text-xs text-gray-600 capitalize">
                                  {fellow.recommended_action.replace(/_/g, ' ')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="secondary" onClick={() => handleViewFellow(fellow)}>
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Detail Modal */}
        <Modal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          title={selectedFellow ? `Risk Detail - ${selectedFellow.name}` : 'Risk Detail'}
          size="lg"
        >
          {loadingDetail ? (
            <div className="py-8 text-center text-gray-500">Loading risk details...</div>
          ) : selectedFellow ? (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Fellow Header */}
              <div className={`rounded-lg p-4 ${RISK_COLORS[selectedFellow.risk_level]?.bg || 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{selectedFellow.name}</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedFellow.role.replace(/_/g, ' ')}</p>
                    {selectedFellow.team_name && (
                      <Badge variant="info" className="mt-1">{selectedFellow.team_name}</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={RISK_COLORS[selectedFellow.risk_level]?.badge || 'info'}
                      className="text-lg px-3 py-1"
                    >
                      {formatRiskLevel(selectedFellow.risk_level)}
                    </Badge>
                    <p className="text-3xl font-bold mt-1">{Math.round(selectedFellow.risk_score * 100)}<span className="text-sm text-gray-500">/100</span></p>
                  </div>
                </div>
              </div>

              {/* 7-Signal Breakdown */}
              {selectedFellow.signals && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Signal Breakdown
                  </h4>
                  <div className="space-y-3">
                    {(Object.keys(SIGNAL_CONFIG) as Array<keyof RiskSignals>).map((key) => {
                      const cfg = SIGNAL_CONFIG[key];
                      const val = selectedFellow.signals?.[key] ?? 0;
                      const pct = Math.round(val * 100);
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-36 text-sm text-gray-700">
                            {cfg.icon}
                            <span>{cfg.label}</span>
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                            <div
                              className={`h-3 rounded-full transition-all ${getSignalColor(val)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-16 text-right">
                            <span className={`text-sm font-semibold ${
                              val >= 0.7 ? 'text-green-600' : val >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {pct}%
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 w-8">{cfg.weight}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Concerns */}
              {selectedFellow.concerns && selectedFellow.concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" /> Concerns
                  </h4>
                  <div className="space-y-2">
                    {selectedFellow.concerns.map((concern, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border p-3 ${
                          concern.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={concern.severity === 'high' ? 'danger' : 'warning'}>
                            {concern.severity}
                          </Badge>
                          <span className="text-xs text-gray-500 capitalize">{concern.type}</span>
                        </div>
                        <p className="text-sm text-gray-800">{concern.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest Assessment Action */}
              {fellowRiskHistory.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Latest Assessment (Week {fellowRiskHistory[0].week})</h4>

                  {/* Recommended Action */}
                  {fellowRiskHistory[0].recommended_action && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-3">
                      <p className="text-sm font-medium text-blue-900">Recommended Action</p>
                      <p className="text-base font-semibold text-blue-700 capitalize mt-1">
                        {fellowRiskHistory[0].recommended_action.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {/* Action Taken or Record */}
                  {fellowRiskHistory[0].action_taken ? (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <p className="text-sm font-medium text-green-900">Action Taken</p>
                      <p className="text-base text-green-700 capitalize">
                        {fellowRiskHistory[0].action_taken.replace(/_/g, ' ')}
                      </p>
                      {fellowRiskHistory[0].actioned_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Recorded: {new Date(fellowRiskHistory[0].actioned_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900 mb-2">Record Action Taken</p>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          value={selectedAction}
                          onChange={(e) => setSelectedAction(e.target.value)}
                        >
                          <option value="">Select action...</option>
                          <option value="continue_monitoring">Continue Monitoring</option>
                          <option value="scheduled_1_on_1">Scheduled 1-on-1</option>
                          <option value="issued_warning">Issued Warning</option>
                          <option value="final_warning">Final Warning</option>
                          <option value="immediate_intervention">Immediate Intervention</option>
                          <option value="referred_to_mentor">Referred to Mentor</option>
                          <option value="no_action_needed">No Action Needed</option>
                        </select>
                        <Button
                          size="sm"
                          disabled={!selectedAction || recordingAction}
                          onClick={handleRecordAction}
                        >
                          {recordingAction ? 'Saving...' : 'Record'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Risk Score History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Risk Score History
                </h4>
                {fellowRiskHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No risk assessment history.</p>
                ) : (
                  <>
                    {/* Bar chart */}
                    <div className="flex items-end gap-2 h-28 mb-4">
                      {[...fellowRiskHistory].reverse().map((assessment) => {
                        const pct = assessment.risk_score * 100;
                        const colors = RISK_COLORS[assessment.risk_level] || RISK_COLORS.on_track;
                        return (
                          <div key={assessment.id} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className="text-xs font-semibold mb-1">{Math.round(pct)}</span>
                            <div
                              className={`w-full rounded-t ${colors.bar}`}
                              style={{ height: `${Math.max(pct, 4)}%` }}
                              title={`Week ${assessment.week}: ${Math.round(pct)} (${formatRiskLevel(assessment.risk_level)})`}
                            />
                            <span className="text-xs text-gray-500 mt-1">W{assessment.week}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* History list */}
                    <div className="space-y-2">
                      {fellowRiskHistory.map((assessment) => {
                        const colors = RISK_COLORS[assessment.risk_level] || RISK_COLORS.on_track;
                        return (
                          <div key={assessment.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary">Week {assessment.week}</Badge>
                              <Badge variant={colors.badge}>
                                {formatRiskLevel(assessment.risk_level)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold">{Math.round(assessment.risk_score * 100)}/100</span>
                              {assessment.action_taken && (
                                <Badge variant="success" className="capitalize text-xs">
                                  {assessment.action_taken.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </AppLayout>
  );
}
