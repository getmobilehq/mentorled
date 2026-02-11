'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
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
} from 'lucide-react';
import type {
  CheckIn,
  CheckInAnalysisResponse,
  Fellow,
  Cohort,
} from '@/types';

export default function CheckInsPage() {
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
      alert('Failed to analyze check-in. Please try again.');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleBulkAnalyze = async () => {
    if (!confirm(`Analyze all ${stats.pending} pending check-ins? This may take a while.`)) return;
    setBulkAnalyzing(true);
    try {
      const response = await checkInsAPI.analyzeBulk(
        weekFilter || undefined,
        selectedCohortId || undefined
      );
      alert(`Analyzed ${response.data.analyzed} check-ins.${response.data.errors > 0 ? ` ${response.data.errors} errors.` : ''}`);
      await fetchCheckIns();
    } catch (error) {
      console.error('Error bulk analyzing:', error);
      alert('Bulk analysis failed.');
    } finally {
      setBulkAnalyzing(false);
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
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Check-ins</h1>
          <p className="mt-2 text-gray-600">
            Review and analyze fellow check-ins using AI
          </p>
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
                      <TableRow key={checkIn.id}>
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
