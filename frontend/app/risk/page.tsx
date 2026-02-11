'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { riskAPI, cohortsAPI } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Shield,
} from 'lucide-react';
import type { Cohort, RiskAssessmentDetail } from '@/types';

interface RiskDashboardData {
  summary: {
    on_track: number;
    monitor: number;
    at_risk: number;
    critical: number;
  };
  fellows: Array<{
    id: string;
    name: string;
    role: string;
    team_id?: string | null;
    risk_level: string;
    risk_score: number;
    warnings_count: number;
    milestone_1_score?: number | null;
    milestone_2_score?: number | null;
  }>;
}

export default function RiskDashboardPage() {
  const [dashboardData, setDashboardData] = useState<RiskDashboardData | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'on_track' | 'monitor' | 'at_risk' | 'critical'>('all');

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFellow, setSelectedFellow] = useState<RiskDashboardData['fellows'][0] | null>(null);
  const [fellowRiskHistory, setFellowRiskHistory] = useState<RiskAssessmentDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [recordingAction, setRecordingAction] = useState(false);

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    if (selectedCohortId) {
      fetchDashboard();
    }
  }, [selectedCohortId, currentWeek]);

  const fetchCohorts = async () => {
    try {
      const response = await cohortsAPI.list();
      const cohortsList = response.data;
      setCohorts(cohortsList);

      if (cohortsList.length > 0) {
        setSelectedCohortId(cohortsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchDashboard = async () => {
    if (!selectedCohortId) return;

    setLoading(true);
    try {
      const response = await riskAPI.getDashboard(selectedCohortId, currentWeek);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching risk dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFellow = async (fellow: RiskDashboardData['fellows'][0]) => {
    setSelectedFellow(fellow);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    setSelectedAction('');

    try {
      const response = await riskAPI.getFellowHistory(fellow.id);
      setFellowRiskHistory(response.data);
    } catch (error) {
      console.error('Error fetching risk history:', error);
      setFellowRiskHistory([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRecordAction = async () => {
    if (!selectedAction || fellowRiskHistory.length === 0) return;

    const latestAssessment = fellowRiskHistory[0];
    setRecordingAction(true);

    try {
      await riskAPI.recordAction(latestAssessment.id, selectedAction);
      alert('Action recorded successfully.');
      const response = await riskAPI.getFellowHistory(selectedFellow!.id);
      setFellowRiskHistory(response.data);
      setSelectedAction('');
    } catch (error) {
      console.error('Error recording action:', error);
      alert('Failed to record action.');
    } finally {
      setRecordingAction(false);
    }
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'on_track':
        return 'success';
      case 'monitor':
        return 'warning';
      case 'at_risk':
        return 'danger';
      case 'critical':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'on_track':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'monitor':
        return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      case 'at_risk':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatRiskLevel = (level: string) => {
    return level.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Filter fellows
  const filteredFellows = dashboardData?.fellows.filter(fellow => {
    if (filter === 'all') return true;
    return fellow.risk_level === filter;
  }) || [];

  if (loading && !dashboardData) {
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
          <h1 className="text-3xl font-bold text-gray-900">Risk Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Monitor fellow risk levels and take proactive action
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week
            </label>
            <input
              type="number"
              min="1"
              max="12"
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
            />
          </div>

          <div className="ml-auto flex items-end">
            <Button onClick={fetchDashboard} size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {dashboardData && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('on_track')}>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600">On Track</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {dashboardData.summary.on_track}
                  </p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('monitor')}>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-yellow-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600">Monitor</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-yellow-600">
                    {dashboardData.summary.monitor}
                  </p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('at_risk')}>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600">At Risk</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-orange-600">
                    {dashboardData.summary.at_risk}
                  </p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('critical')}>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <Shield className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600">Critical</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-red-600">
                    {dashboardData.summary.critical}
                  </p>
                </div>
              </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({dashboardData.fellows.length})
              </Button>
              <Button
                variant={filter === 'on_track' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('on_track')}
              >
                On Track ({dashboardData.summary.on_track})
              </Button>
              <Button
                variant={filter === 'monitor' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('monitor')}
              >
                Monitor ({dashboardData.summary.monitor})
              </Button>
              <Button
                variant={filter === 'at_risk' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('at_risk')}
              >
                At Risk ({dashboardData.summary.at_risk})
              </Button>
              <Button
                variant={filter === 'critical' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('critical')}
              >
                Critical ({dashboardData.summary.critical})
              </Button>
            </div>

            {/* Fellows Table */}
            <Card padding={false}>
              <CardHeader className="px-6 pt-6">
                <CardTitle>Fellows</CardTitle>
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
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Milestone 1</TableHead>
                        <TableHead>Milestone 2</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFellows.map((fellow) => (
                        <TableRow key={fellow.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleViewFellow(fellow)}>
                          <TableCell className="font-medium">
                            {fellow.name}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">
                              {fellow.role.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell>
                            {fellow.team_id ? (
                              <Badge variant="secondary">Team {fellow.team_id.slice(0, 8)}</Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getRiskIcon(fellow.risk_level)}
                              <Badge variant={getRiskBadgeVariant(fellow.risk_level)}>
                                {formatRiskLevel(fellow.risk_level)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    fellow.risk_score < 0.25 ? 'bg-green-600' :
                                    fellow.risk_score < 0.50 ? 'bg-yellow-600' :
                                    fellow.risk_score < 0.75 ? 'bg-orange-600' :
                                    'bg-red-600'
                                  }`}
                                  style={{ width: `${fellow.risk_score * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold">
                                {fellow.risk_score.toFixed(2)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {fellow.milestone_1_score !== null && fellow.milestone_1_score !== undefined ? (
                              <span className={`font-semibold ${
                                fellow.milestone_1_score >= 3 ? 'text-green-600' :
                                fellow.milestone_1_score >= 2.5 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {fellow.milestone_1_score.toFixed(1)}/4
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fellow.milestone_2_score !== null && fellow.milestone_2_score !== undefined ? (
                              <span className={`font-semibold ${
                                fellow.milestone_2_score >= 3 ? 'text-green-600' :
                                fellow.milestone_2_score >= 2.5 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {fellow.milestone_2_score.toFixed(1)}/4
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fellow.warnings_count > 0 ? (
                              <Badge variant="danger">
                                {fellow.warnings_count}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleViewFellow(fellow)}
                              >
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Risk Detail Modal */}
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
              {/* Fellow Info */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{selectedFellow.name}</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedFellow.role.replace('_', ' ')}</p>
                    {selectedFellow.team_id && (
                      <Badge variant="info" className="mt-1">Team {selectedFellow.team_id.slice(0, 8)}</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={getRiskBadgeVariant(selectedFellow.risk_level)} className="text-lg px-3 py-1">
                      {formatRiskLevel(selectedFellow.risk_level)}
                    </Badge>
                    <p className="text-2xl font-bold mt-1">{selectedFellow.risk_score.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Latest Assessment Details */}
              {fellowRiskHistory.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Latest Assessment (Week {fellowRiskHistory[0].week})</h4>

                  {/* Concerns */}
                  {fellowRiskHistory[0].concerns && Object.keys(fellowRiskHistory[0].concerns).length > 0 && (
                    <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-3">
                      <p className="text-sm font-medium text-yellow-900 mb-2">Concerns</p>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.values(fellowRiskHistory[0].concerns).map((concern, idx) => (
                          <li key={idx} className="text-sm text-yellow-800">{String(concern)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                      <p className="text-base text-green-700 capitalize">{fellowRiskHistory[0].action_taken.replace(/_/g, ' ')}</p>
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
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <h4 className="font-medium text-gray-900 mb-3">Risk Score History</h4>
                {fellowRiskHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No risk assessment history.</p>
                ) : (
                  <>
                    {/* Bar visualization */}
                    <div className="flex items-end gap-2 h-24 mb-4">
                      {[...fellowRiskHistory].reverse().map((assessment) => {
                        const heightPct = assessment.risk_score * 100;
                        const color = assessment.risk_score < 0.25 ? 'bg-green-500' :
                          assessment.risk_score < 0.5 ? 'bg-yellow-500' :
                          assessment.risk_score < 0.75 ? 'bg-orange-500' : 'bg-red-500';
                        return (
                          <div key={assessment.id} className="flex-1 flex flex-col items-center justify-end h-full">
                            <div
                              className={`w-full rounded-t ${color}`}
                              style={{ height: `${Math.max(heightPct, 4)}%` }}
                              title={`Week ${assessment.week}: ${assessment.risk_score.toFixed(2)} (${formatRiskLevel(assessment.risk_level)})`}
                            />
                            <span className="text-xs text-gray-500 mt-1">W{assessment.week}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* List view */}
                    <div className="space-y-2">
                      {fellowRiskHistory.map((assessment) => (
                        <div key={assessment.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">Week {assessment.week}</Badge>
                            {getRiskIcon(assessment.risk_level)}
                            <Badge variant={getRiskBadgeVariant(assessment.risk_level)}>
                              {formatRiskLevel(assessment.risk_level)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">{assessment.risk_score.toFixed(2)}</span>
                            {assessment.action_taken && (
                              <Badge variant="success" className="capitalize">{assessment.action_taken.replace(/_/g, ' ')}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
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
