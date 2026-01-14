'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { checkInsAPI, fellowsAPI } from '@/lib/api';
import {
  Play,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Battery,
  Users,
} from 'lucide-react';
import type {
  CheckIn,
  CheckInAnalysisResponse,
  Fellow
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

  useEffect(() => {
    fetchCheckIns();
  }, [weekFilter]);

  const fetchCheckIns = async () => {
    try {
      const [checkInsRes, fellowsRes] = await Promise.all([
        checkInsAPI.list(weekFilter || undefined),
        fellowsAPI.list(),
      ]);

      setCheckIns(checkInsRes.data);

      // Create a map of fellows by ID
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

      // Refresh check-ins list
      await fetchCheckIns();
    } catch (error) {
      console.error('Error analyzing check-in:', error);
      alert('Failed to analyze check-in. Please try again.');
    } finally {
      setAnalyzing(null);
    }
  };

  const getSentimentColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 0.5) return 'text-green-600';
    if (score >= 0) return 'text-yellow-600';
    if (score >= -0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSentimentIcon = (score?: number) => {
    if (!score) return null;
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

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading...</div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
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

        <div className="ml-auto">
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
                        {checkIn.sentiment_score !== undefined ? (
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
                        {checkIn.risk_contribution !== undefined ? (
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
            {/* Fellow Info */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fellow</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {selectedAnalysis.fellow_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Week {selectedAnalysis.week} • Analyzed: {new Date(selectedAnalysis.analyzed_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Scores */}
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

            {/* Summary */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">AI Summary</h4>
              <p className="text-sm text-gray-700">{selectedAnalysis.analysis.summary}</p>
            </div>

            {/* Themes */}
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

            {/* Positive Signals */}
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

            {/* Concerns */}
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

            {/* Blockers */}
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

            {/* Action Items */}
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

            {/* Confidence */}
            <div>
              <p className="text-sm text-gray-600">
                AI Confidence:{' '}
                <span className="font-semibold">
                  {(selectedAnalysis.analysis.confidence * 100).toFixed(0)}%
                </span>
              </p>
            </div>

            {/* Actions */}
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
    </ProtectedRoute>
  );
}
