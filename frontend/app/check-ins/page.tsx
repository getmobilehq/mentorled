'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { checkInsAPI, fellowsAPI, cohortsAPI } from '@/lib/api';
import {
  Play,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Battery,
  Users,
  Zap,
  Plus,
} from 'lucide-react';
import type {
  CheckIn,
  CheckInAnalysisResponse,
  Fellow,
  Cohort,
} from '@/types';

export default function CheckInsPage() {
  const { toast, confirm } = useToast();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [fellows, setFellows] = useState<{ [key: string]: Fellow }>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CheckInAnalysisResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'analyzed' | 'pending'>('all');
  const [weekFilter, setWeekFilter] = useState<number | null>(null);

  // Cohort filter
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');

  // Bulk analyze
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [selectedCheckInFellow, setSelectedCheckInFellow] = useState<Fellow | null>(null);

  // Submit check-in modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    fellow_id: '',
    week: 1,
    accomplishments: '',
    next_focus: '',
    blockers: '',
    needs_help: '',
    self_assessment: '',
    collaboration_rating: '',
    energy_level: 5,
  });

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    fetchCheckIns();
  }, [weekFilter, selectedCohortId]);

  const fetchCohorts = async () => {
    try {
      const response = await cohortsAPI.list();
      setCohorts(response.data);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchCheckIns = async () => {
    try {
      const [checkInsRes, fellowsRes] = await Promise.all([
        checkInsAPI.list(weekFilter || undefined, selectedCohortId || undefined),
        fellowsAPI.list(selectedCohortId || undefined),
      ]);

      setCheckIns(checkInsRes.data);

      const fellowsMap: { [key: string]: Fellow } = {};
      fellowsRes.data.forEach((fellow: Fellow) => {
        fellowsMap[fellow.id] = fellow;
      });
      setFellows(fellowsMap);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (checkInId: string) => {
    setAnalyzing(checkInId);
    try {
      const response = await checkInsAPI.analyze(checkInId);
      setSelectedAnalysis(response.data);
      setModalOpen(true);
      await fetchCheckIns();
    } catch (error) {
      console.error('Error analyzing check-in:', error);
      toast('Failed to analyze check-in. Please try again.', 'error');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleBulkAnalyze = async () => {
    confirm(`Analyze all ${stats.pending} pending check-ins? This may take a while.`, async () => {
      setBulkAnalyzing(true);
      try {
        const response = await checkInsAPI.analyzeBulk(
          weekFilter || undefined,
          selectedCohortId || undefined
        );
        toast(`Analyzed ${response.data.analyzed} check-ins.${response.data.errors > 0 ? ` ${response.data.errors} errors.` : ''}`, 'success');
        await fetchCheckIns();
      } catch (error) {
        console.error('Error bulk analyzing:', error);
        toast('Bulk analysis failed.', 'error');
      } finally {
        setBulkAnalyzing(false);
      }
    });
  };

  const handleViewCheckIn = (checkIn: CheckIn) => {
    setSelectedCheckIn(checkIn);
    setSelectedCheckInFellow(fellows[checkIn.fellow_id] || null);
    setDetailModalOpen(true);
  };

  const handleSubmitCheckIn = async () => {
    if (!submitForm.fellow_id || !submitForm.week) return;
    setSubmitting(true);
    try {
      await checkInsAPI.create({
        fellow_id: submitForm.fellow_id,
        week: submitForm.week,
        accomplishments: submitForm.accomplishments || null,
        next_focus: submitForm.next_focus || null,
        blockers: submitForm.blockers || null,
        needs_help: submitForm.needs_help || null,
        self_assessment: submitForm.self_assessment || null,
        collaboration_rating: submitForm.collaboration_rating || null,
        energy_level: submitForm.energy_level,
      });
      setSubmitModalOpen(false);
      setSubmitForm({
        fellow_id: '', week: 1, accomplishments: '', next_focus: '',
        blockers: '', needs_help: '', self_assessment: '',
        collaboration_rating: '', energy_level: 5,
      });
      await fetchCheckIns();
    } catch (error) {
      console.error('Error submitting check-in:', error);
      toast('Failed to submit check-in.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getSentimentColor = (score?: number) => {
    if (score === undefined || score === null) return 'text-gray-400';
    if (score >= 0.5) return 'text-green-600';
    if (score >= 0) return 'text-yellow-600';
    if (score >= -0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSentimentIcon = (score?: number) => {
    if (score === undefined || score === null) return null;
    if (score >= 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const getRiskBadgeVariant = (score?: number) => {
    if (!score) return 'secondary';
    if (score < 0.2) return 'success';
    if (score < 0.4) return 'warning';
    if (score < 0.6) return 'danger';
    return 'danger';
  };

  const getRiskLabel = (score?: number) => {
    if (!score) return 'Not Analyzed';
    if (score < 0.2) return 'On Track';
    if (score < 0.4) return 'Monitor';
    if (score < 0.6) return 'At Risk';
    return 'Critical';
  };

  // Filter check-ins
  const filteredCheckIns = checkIns.filter((checkIn) => {
    if (filter === 'analyzed') return checkIn.analyzed_at;
    if (filter === 'pending') return !checkIn.analyzed_at;
    return true;
  });

  // Calculate stats
  const stats = {
    total: checkIns.length,
    analyzed: checkIns.filter(c => c.analyzed_at).length,
    pending: checkIns.filter(c => !c.analyzed_at).length,
    atRisk: checkIns.filter(c => c.risk_contribution && c.risk_contribution >= 0.6).length,
  };

  // Get unique weeks for filter
  const weeks = Array.from(new Set(checkIns.map(c => c.week))).sort((a, b) => b - a);

  // Calculate weekly sentiment/energy trends
  const weeklyTrends = useMemo(() => {
    const weekMap: Record<number, { sentiments: number[]; energies: number[] }> = {};

    checkIns.forEach(c => {
      if (!weekMap[c.week]) weekMap[c.week] = { sentiments: [], energies: [] };
      if (c.sentiment_score !== undefined && c.sentiment_score !== null) weekMap[c.week].sentiments.push(c.sentiment_score);
      if (c.energy_level !== undefined && c.energy_level !== null) weekMap[c.week].energies.push(c.energy_level);
    });

    return Object.entries(weekMap)
      .map(([week, data]) => ({
        week: parseInt(week),
        avgSentiment: data.sentiments.length ? data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length : null,
        avgEnergy: data.energies.length ? data.energies.reduce((a, b) => a + b, 0) / data.energies.length : null,
      }))
      .sort((a, b) => a.week - b.week);
  }, [checkIns]);

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Check-ins</h1>
            <p className="mt-2 text-gray-600">
              Review and analyze fellow check-ins using AI
            </p>
          </div>
          <Button onClick={() => setSubmitModalOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Submit Check-in
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Pending Analysis</p>
              <p className="mt-2 text-2xl font-bold text-orange-600">{stats.pending}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Analyzed</p>
              <p className="mt-2 text-2xl font-bold text-blue-600">{stats.analyzed}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">At Risk</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{stats.atRisk}</p>
            </div>
          </Card>
        </div>

        {/* Sentiment & Energy Trends */}
        {weeklyTrends.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Sentiment Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">Average Sentiment by Week</p>
                  <div className="flex items-end gap-2 h-32">
                    {weeklyTrends.map(w => {
                      const normalizedHeight = w.avgSentiment !== null ? ((w.avgSentiment + 1) / 2) * 100 : 0;
                      const color = w.avgSentiment !== null
                        ? (w.avgSentiment >= 0.5 ? 'bg-green-500' : w.avgSentiment >= 0 ? 'bg-yellow-500' : w.avgSentiment >= -0.5 ? 'bg-orange-500' : 'bg-red-500')
                        : 'bg-gray-300';
                      return (
                        <div key={w.week} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className={`w-full rounded-t ${color}`}
                            style={{ height: `${Math.max(normalizedHeight, 4)}%` }}
                            title={`Week ${w.week}: ${w.avgSentiment?.toFixed(2) ?? 'N/A'}`}
                          />
                          <span className="text-xs text-gray-500 mt-1">W{w.week}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Energy Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">Average Energy by Week</p>
                  <div className="flex items-end gap-2 h-32">
                    {weeklyTrends.map(w => {
                      const normalizedHeight = w.avgEnergy !== null ? (w.avgEnergy / 10) * 100 : 0;
                      const color = w.avgEnergy !== null
                        ? (w.avgEnergy >= 7 ? 'bg-green-500' : w.avgEnergy >= 4 ? 'bg-yellow-500' : 'bg-red-500')
                        : 'bg-gray-300';
                      return (
                        <div key={w.week} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className={`w-full rounded-t ${color}`}
                            style={{ height: `${Math.max(normalizedHeight, 4)}%` }}
                            title={`Week ${w.week}: ${w.avgEnergy?.toFixed(1) ?? 'N/A'}/10`}
                          />
                          <span className="text-xs text-gray-500 mt-1">W{w.week}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filter === 'pending' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({stats.pending})
          </Button>
          <Button
            variant={filter === 'analyzed' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('analyzed')}
          >
            Analyzed ({stats.analyzed})
          </Button>

          {stats.pending > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkAnalyze}
              disabled={bulkAnalyzing}
              className="ml-2"
            >
              <Zap className="mr-1 h-4 w-4" />
              {bulkAnalyzing ? 'Analyzing...' : `Bulk Analyze (${stats.pending})`}
            </Button>
          )}

          <div className="ml-auto flex gap-2">
            <select
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              <option value="">All Cohorts</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
              ))}
            </select>
            <select
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={weekFilter || ''}
              onChange={(e) => setWeekFilter(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">All Weeks</option>
              {weeks.map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Check-ins table */}
        <Card padding={false}>
          <CardHeader className="px-6 pt-6">
            <CardTitle>Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {filteredCheckIns.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No check-ins</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'pending'
                    ? 'All check-ins have been analyzed.'
                    : filter === 'analyzed'
                    ? 'No check-ins have been analyzed yet.'
                    : 'No check-ins found.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fellow</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Energy</TableHead>
                    <TableHead>Self-Assessment</TableHead>
                    <TableHead>Collaboration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCheckIns.map((checkIn) => {
                    const fellow = fellows[checkIn.fellow_id];

                    return (
                      <TableRow key={checkIn.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleViewCheckIn(checkIn)}>
                        <TableCell className="font-medium">
                          {fellow?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {fellow?.role?.replace('_', ' ') || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Week {checkIn.week}</Badge>
                        </TableCell>
                        <TableCell>
                          {checkIn.energy_level ? (
                            <div className="flex items-center space-x-1">
                              <Battery className={`h-4 w-4 ${
                                checkIn.energy_level >= 7 ? 'text-green-600' :
                                checkIn.energy_level >= 4 ? 'text-yellow-600' :
                                'text-red-600'
                              }`} />
                              <span>{checkIn.energy_level}/10</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {checkIn.self_assessment ? (
                            <Badge
                              variant={
                                checkIn.self_assessment === 'exceeded' ? 'success' :
                                checkIn.self_assessment === 'met' ? 'warning' :
                                'danger'
                              }
                              className="capitalize"
                            >
                              {checkIn.self_assessment}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {checkIn.collaboration_rating ? (
                            <Badge
                              variant={
                                checkIn.collaboration_rating === 'great' ? 'success' :
                                checkIn.collaboration_rating === 'good' ? 'warning' :
                                checkIn.collaboration_rating === 'okay' ? 'warning' :
                                'danger'
                              }
                              className="capitalize"
                            >
                              {checkIn.collaboration_rating}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {checkIn.sentiment_score !== undefined && checkIn.sentiment_score !== null ? (
                            <div className={`flex items-center space-x-1 ${getSentimentColor(checkIn.sentiment_score)}`}>
                              {getSentimentIcon(checkIn.sentiment_score)}
                              <span className="font-semibold">
                                {checkIn.sentiment_score.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {checkIn.risk_contribution !== undefined && checkIn.risk_contribution !== null ? (
                            <Badge variant={getRiskBadgeVariant(checkIn.risk_contribution)}>
                              {getRiskLabel(checkIn.risk_contribution)}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Analyzed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(checkIn.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleAnalyze(checkIn.id)}
                            disabled={analyzing === checkIn.id}
                            variant={checkIn.analyzed_at ? 'secondary' : 'primary'}
                          >
                            {analyzing === checkIn.id ? (
                              <>Analyzing...</>
                            ) : (
                              <>
                                <Play className="mr-1 h-4 w-4" />
                                {checkIn.analyzed_at ? 'Re-analyze' : 'Analyze'}
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Check-in Detail Modal */}
        <Modal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          title={selectedCheckIn ? `Check-in Detail - Week ${selectedCheckIn.week}` : 'Check-in Detail'}
          size="lg"
        >
          {selectedCheckIn && (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Header */}
              <div className="rounded-lg bg-gray-50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{selectedCheckInFellow?.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 capitalize">{selectedCheckInFellow?.role?.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">Week {selectedCheckIn.week}</Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(selectedCheckIn.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-gray-500">Energy Level</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Battery className={`h-4 w-4 ${
                      (selectedCheckIn.energy_level || 0) >= 7 ? 'text-green-600' :
                      (selectedCheckIn.energy_level || 0) >= 4 ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                    <span className="text-lg font-bold">{selectedCheckIn.energy_level || '-'}</span>
                    <span className="text-sm text-gray-400">/10</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-gray-500">Self-Assessment</p>
                  {selectedCheckIn.self_assessment ? (
                    <Badge
                      variant={
                        selectedCheckIn.self_assessment === 'exceeded' ? 'success' :
                        selectedCheckIn.self_assessment === 'met' ? 'warning' : 'danger'
                      }
                      className="mt-1 capitalize"
                    >
                      {selectedCheckIn.self_assessment}
                    </Badge>
                  ) : <span className="text-gray-400 text-sm">-</span>}
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-gray-500">Collaboration</p>
                  {selectedCheckIn.collaboration_rating ? (
                    <Badge
                      variant={
                        selectedCheckIn.collaboration_rating === 'great' ? 'success' :
                        selectedCheckIn.collaboration_rating === 'good' ? 'warning' : 'danger'
                      }
                      className="mt-1 capitalize"
                    >
                      {selectedCheckIn.collaboration_rating}
                    </Badge>
                  ) : <span className="text-gray-400 text-sm">-</span>}
                </div>
              </div>

              {/* Submitted Content */}
              <div className="space-y-3">
                {selectedCheckIn.accomplishments && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Accomplishments</h4>
                    <p className="text-sm text-gray-900 bg-green-50 rounded-lg p-3">{selectedCheckIn.accomplishments}</p>
                  </div>
                )}
                {selectedCheckIn.next_focus && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Next Focus</h4>
                    <p className="text-sm text-gray-900 bg-blue-50 rounded-lg p-3">{selectedCheckIn.next_focus}</p>
                  </div>
                )}
                {selectedCheckIn.blockers && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Blockers</h4>
                    <p className="text-sm text-gray-900 bg-yellow-50 rounded-lg p-3">{selectedCheckIn.blockers}</p>
                  </div>
                )}
                {selectedCheckIn.needs_help && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Needs Help With</h4>
                    <p className="text-sm text-gray-900 bg-orange-50 rounded-lg p-3">{selectedCheckIn.needs_help}</p>
                  </div>
                )}
              </div>

              {/* AI Analysis Section */}
              {selectedCheckIn.analysis ? (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-600" /> AI Analysis
                    <span className="text-xs text-gray-400 font-normal">
                      {selectedCheckIn.analyzed_at && `Analyzed: ${new Date(selectedCheckIn.analyzed_at).toLocaleString()}`}
                    </span>
                  </h4>

                  {/* Sentiment & Risk */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-900">Sentiment Score</p>
                      <p className={`text-xl font-bold ${getSentimentColor(selectedCheckIn.analysis.sentiment_score)}`}>
                        {selectedCheckIn.analysis.sentiment_score.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-xs font-medium text-red-900">Risk Contribution</p>
                      <p className="text-xl font-bold text-red-700">
                        {selectedCheckIn.analysis.risk_contribution.toFixed(2)}
                      </p>
                      <Badge variant={getRiskBadgeVariant(selectedCheckIn.analysis.risk_contribution)} className="mt-1">
                        {getRiskLabel(selectedCheckIn.analysis.risk_contribution)}
                      </Badge>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Summary</p>
                    <p className="text-sm text-gray-800">{selectedCheckIn.analysis.summary}</p>
                  </div>

                  {/* Themes */}
                  {selectedCheckIn.analysis.themes?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Themes</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedCheckIn.analysis.themes.map((t, i) => (
                          <Badge key={i} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Positive Signals */}
                  {selectedCheckIn.analysis.positive_signals?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" /> Positive Signals
                      </p>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                        {selectedCheckIn.analysis.positive_signals.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Concerns */}
                  {selectedCheckIn.analysis.concerns?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-orange-600" /> Concerns
                      </p>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                        {selectedCheckIn.analysis.concerns.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Blockers & Actions */}
                  {selectedCheckIn.analysis.blockers_extracted?.length > 0 && (
                    <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                      <p className="text-sm font-medium text-yellow-900 mb-1">Blockers Identified</p>
                      <ul className="list-disc list-inside text-sm text-yellow-800 space-y-0.5">
                        {selectedCheckIn.analysis.blockers_extracted.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}

                  {selectedCheckIn.analysis.action_items?.length > 0 && (
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                      <p className="text-sm font-medium text-purple-900 mb-1">Recommended Actions</p>
                      <ul className="list-disc list-inside text-sm text-purple-800 space-y-0.5">
                        {selectedCheckIn.analysis.action_items.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    AI Confidence: {(selectedCheckIn.analysis.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-2">This check-in has not been analyzed yet.</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleAnalyze(selectedCheckIn.id);
                      }}
                      disabled={analyzing === selectedCheckIn.id}
                    >
                      <Play className="mr-1 h-4 w-4" /> Analyze Now
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Submit Check-in Modal */}
        <Modal
          open={submitModalOpen}
          onOpenChange={setSubmitModalOpen}
          title="Submit Weekly Check-in"
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fellow *</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={submitForm.fellow_id}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, fellow_id: e.target.value }))}
                >
                  <option value="">Select fellow...</option>
                  {Object.values(fellows).map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.role.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week *</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={submitForm.week}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, week: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accomplishments</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="What did you accomplish this week?"
                value={submitForm.accomplishments}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, accomplishments: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Focus</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="What will you focus on next week?"
                value={submitForm.next_focus}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, next_focus: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blockers</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Any blockers or challenges?"
                value={submitForm.blockers}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, blockers: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Need Help With</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="What do you need help with?"
                value={submitForm.needs_help}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, needs_help: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Self-Assessment</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={submitForm.self_assessment}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, self_assessment: e.target.value }))}
                >
                  <option value="">Select...</option>
                  <option value="exceeded">Exceeded expectations</option>
                  <option value="met">Met expectations</option>
                  <option value="below">Below expectations</option>
                  <option value="struggling">Struggling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collaboration</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={submitForm.collaboration_rating}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, collaboration_rating: e.target.value }))}
                >
                  <option value="">Select...</option>
                  <option value="great">Great</option>
                  <option value="good">Good</option>
                  <option value="okay">Okay</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Energy Level ({submitForm.energy_level}/10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  className="w-full mt-2"
                  value={submitForm.energy_level}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, energy_level: parseInt(e.target.value) }))}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setSubmitModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitCheckIn}
                disabled={submitting || !submitForm.fellow_id}
              >
                {submitting ? 'Submitting...' : 'Submit Check-in'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Analysis Results Modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Check-in Analysis"
          size="lg"
        >
          {selectedAnalysis && (
            <div className="space-y-6">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fellow</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      {selectedAnalysis.fellow_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Week {selectedAnalysis.week} &bull; Analyzed: {new Date(selectedAnalysis.analyzed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-900">Sentiment</p>
                    <div className={`flex items-center space-x-1 ${getSentimentColor(selectedAnalysis.analysis.sentiment_score)}`}>
                      {getSentimentIcon(selectedAnalysis.analysis.sentiment_score)}
                    </div>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {selectedAnalysis.analysis.sentiment_score.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600">-1.0 (negative) to 1.0 (positive)</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-900">Risk Level</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">
                    {getRiskLabel(selectedAnalysis.analysis.risk_contribution)}
                  </p>
                  <p className="text-xs text-red-600">
                    Score: {selectedAnalysis.analysis.risk_contribution.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">AI Summary</h4>
                <p className="text-sm text-gray-700">{selectedAnalysis.analysis.summary}</p>
              </div>

              {selectedAnalysis.analysis.themes.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Key Themes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnalysis.analysis.themes.map((theme, idx) => (
                      <Badge key={idx} variant="secondary">{theme}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedAnalysis.analysis.positive_signals.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    Positive Signals
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis.positive_signals.map((signal, idx) => (
                      <li key={idx} className="text-sm text-gray-700">{signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis.analysis.concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1 text-orange-600" />
                    Concerns
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis.concerns.map((concern, idx) => (
                      <li key={idx} className="text-sm text-gray-700">{concern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis.analysis.blockers_extracted.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <h4 className="font-medium text-yellow-900 mb-2">Blockers Identified</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis.blockers_extracted.map((blocker, idx) => (
                      <li key={idx} className="text-sm text-yellow-800">{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis.analysis.action_items.length > 0 && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Recommended Actions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis.action_items.map((action, idx) => (
                      <li key={idx} className="text-sm text-purple-800">{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600">
                  AI Confidence:{' '}
                  <span className="font-semibold">
                    {(selectedAnalysis.analysis.confidence * 100).toFixed(0)}%
                  </span>
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
