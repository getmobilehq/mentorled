'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { fellowsAPI, deliveryAPI, checkInsAPI, riskAPI, cohortsAPI, attendanceAPI, teamsAPI } from '@/lib/api';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Shield,
  Eye,
  Search,
  Calendar,
} from 'lucide-react';
import type { Fellow, RiskAssessment, Cohort, CheckIn, RiskAssessmentDetail, Team, Attendance } from '@/types';

export default function FellowsPage() {
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFellow, setSelectedFellow] = useState<Fellow | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [assessingRisk, setAssessingRisk] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Cohort filter + search
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Teams lookup
  const [teams, setTeams] = useState<Team[]>([]);

  // Milestone modal
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [milestoneFellow, setMilestoneFellow] = useState<Fellow | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    milestone_1_score: '',
    milestone_2_score: '',
    milestone_3_score: '',
    final_score: '',
  });
  const [savingMilestones, setSavingMilestones] = useState(false);

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailFellow, setDetailFellow] = useState<Fellow | null>(null);
  const [fellowCheckIns, setFellowCheckIns] = useState<CheckIn[]>([]);
  const [fellowRiskHistory, setFellowRiskHistory] = useState<RiskAssessmentDetail[]>([]);
  const [fellowAttendance, setFellowAttendance] = useState<Attendance[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchCohorts();
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchFellows();
  }, [selectedCohortId]);

  const fetchCohorts = async () => {
    try {
      const response = await cohortsAPI.list();
      setCohorts(response.data);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await teamsAPI.list();
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchFellows = async () => {
    try {
      const response = await fellowsAPI.list(selectedCohortId || undefined);
      setFellows(response.data);
    } catch (error) {
      console.error('Error fetching fellows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssessRisk = async (fellow: Fellow) => {
    setAssessingRisk(fellow.id);
    try {
      const response = await deliveryAPI.assessRisk(fellow.id);
      setRiskAssessment(response.data);
      setSelectedFellow(fellow);
      setModalOpen(true);
      await fetchFellows();
    } catch (error) {
      console.error('Error assessing risk:', error);
      alert('Failed to assess risk. Please try again.');
    } finally {
      setAssessingRisk(null);
    }
  };

  const handleViewDetail = async (fellow: Fellow) => {
    setDetailFellow(fellow);
    setDetailModalOpen(true);
    setLoadingDetail(true);

    try {
      const [checkInsRes, riskRes, attRes] = await Promise.all([
        checkInsAPI.getFellowCheckIns(fellow.id).catch(() => ({ data: [] })),
        riskAPI.getFellowHistory(fellow.id).catch(() => ({ data: [] })),
        attendanceAPI.getFellowHistory(fellow.id).catch(() => ({ data: [] })),
      ]);
      setFellowCheckIns(checkInsRes.data);
      setFellowRiskHistory(riskRes.data);
      setFellowAttendance(attRes.data);
    } catch (error) {
      console.error('Error fetching fellow details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenMilestones = (fellow: Fellow, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMilestoneFellow(fellow);
    setMilestoneForm({
      milestone_1_score: fellow.milestone_1_score?.toString() || '',
      milestone_2_score: fellow.milestone_2_score?.toString() || '',
      milestone_3_score: fellow.milestone_3_score?.toString() || '',
      final_score: fellow.final_score?.toString() || '',
    });
    setMilestoneModalOpen(true);
  };

  const handleSaveMilestones = async () => {
    if (!milestoneFellow) return;
    setSavingMilestones(true);
    try {
      const data: Record<string, number> = {};
      if (milestoneForm.milestone_1_score) data.milestone_1_score = parseFloat(milestoneForm.milestone_1_score);
      if (milestoneForm.milestone_2_score) data.milestone_2_score = parseFloat(milestoneForm.milestone_2_score);
      if (milestoneForm.milestone_3_score) data.milestone_3_score = parseFloat(milestoneForm.milestone_3_score);
      if (milestoneForm.final_score) data.final_score = parseFloat(milestoneForm.final_score);
      await fellowsAPI.updateMilestones(milestoneFellow.id, data);
      setMilestoneModalOpen(false);
      await fetchFellows();
    } catch (error) {
      console.error('Error saving milestones:', error);
      alert('Failed to save milestones.');
    } finally {
      setSavingMilestones(false);
    }
  };

  const getRiskBadgeVariant = (level?: string) => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      on_track: 'success',
      monitor: 'info',
      at_risk: 'warning',
      critical: 'danger',
    };
    return map[level || 'on_track'] || 'default';
  };

  // Filtered fellows
  const filteredFellows = useMemo(() => {
    return fellows.filter(f => {
      if (searchQuery && !f.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [fellows, searchQuery]);

  // Calculate stats
  const stats = {
    total: fellows.length,
    active: fellows.filter(f => f.status === 'active').length,
    at_risk: fellows.filter(f => ['at_risk', 'warned_once', 'warned_twice'].includes(f.status)).length,
    completed: fellows.filter(f => f.status === 'completed').length,
  };

  const riskStats = {
    on_track: fellows.filter(f => f.current_risk_level === 'on_track').length,
    monitor: fellows.filter(f => f.current_risk_level === 'monitor').length,
    at_risk: fellows.filter(f => f.current_risk_level === 'at_risk').length,
    critical: fellows.filter(f => f.current_risk_level === 'critical').length,
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Fellows</h1>
          <p className="mt-2 text-gray-600">
            Monitor fellow progress and manage risk assessments
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              <option value="">All Cohorts</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Fellows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">At Risk</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.at_risk}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Risk Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-900">On Track</p>
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <p className="mt-2 text-3xl font-bold text-green-600">{riskStats.on_track}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-blue-900">Monitor</p>
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <p className="mt-2 text-3xl font-bold text-blue-600">{riskStats.monitor}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-yellow-900">At Risk</p>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <p className="mt-2 text-3xl font-bold text-yellow-600">{riskStats.at_risk}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-red-900">Critical</p>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <p className="mt-2 text-3xl font-bold text-red-600">{riskStats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fellows table */}
        <Card padding={false}>
          <CardHeader className="px-6 pt-6">
            <CardTitle>All Fellows ({filteredFellows.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {filteredFellows.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {searchQuery ? 'No fellows match your search' : 'No fellows yet'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'Try adjusting your search query.' : 'Fellows will appear here once applicants are accepted.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>M1</TableHead>
                    <TableHead>M2</TableHead>
                    <TableHead>M3</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFellows.map((fellow) => (
                    <TableRow key={fellow.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleViewDetail(fellow)}>
                      <TableCell className="font-medium">{fellow.name}</TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {fellow.role.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {fellow.team_id ? (
                          <Badge variant="info">
                            {teams.find(t => t.id === fellow.team_id)?.name || 'Team'}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No team</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(fellow.status)}>
                          {fellow.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fellow.current_risk_level ? (
                          <Badge variant={getRiskBadgeVariant(fellow.current_risk_level)}>
                            {fellow.current_risk_level.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Not assessed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {fellow.warnings_count && fellow.warnings_count > 0 ? (
                            <Badge variant="warning">
                              {fellow.warnings_count} {fellow.warnings_count === 1 ? 'warning' : 'warnings'}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {fellow.milestone_1_score ? (
                          <span className={fellow.milestone_1_score >= 70 ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                            {fellow.milestone_1_score}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fellow.milestone_2_score ? (
                          <span className={fellow.milestone_2_score >= 70 ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                            {fellow.milestone_2_score}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fellow.milestone_3_score ? (
                          <span className={fellow.milestone_3_score >= 70 ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                            {fellow.milestone_3_score}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fellow.final_score != null ? (
                          <span className={fellow.final_score >= 2.5 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {fellow.final_score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => handleViewDetail(fellow)}>
                            <Eye className="mr-1 h-4 w-4" /> View
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => handleOpenMilestones(fellow, e)}>
                            <TrendingUp className="mr-1 h-4 w-4" /> Milestones
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAssessRisk(fellow)}
                            disabled={assessingRisk === fellow.id}
                          >
                            {assessingRisk === fellow.id ? (
                              'Assessing...'
                            ) : (
                              <>
                                <TrendingUp className="mr-1 h-4 w-4" />
                                Assess Risk
                              </>
                            )}
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

        {/* Risk Assessment Modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Risk Assessment Results"
          size="lg"
        >
          {selectedFellow && riskAssessment && (
            <div className="space-y-6">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Fellow</p>
                <p className="text-lg font-semibold text-gray-900">{selectedFellow.name}</p>
                <p className="text-sm text-gray-600 capitalize">{selectedFellow.role.replace('_', ' ')}</p>
              </div>

              <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-6 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Risk Score</p>
                    <p className="mt-1 text-4xl font-bold text-gray-900">
                      {(riskAssessment.risk_score * 100).toFixed(1)}
                    </p>
                  </div>
                  <Badge
                    variant={getRiskBadgeVariant(riskAssessment.risk_level)}
                    className="text-lg px-4 py-2"
                  >
                    {riskAssessment.risk_level.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>

              {riskAssessment.signals && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Signal Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(riskAssessment.signals).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className={`text-sm font-semibold ${
                          (value as number) >= 0.7 ? 'text-green-600' : (value as number) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>{Math.round((value as number) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {riskAssessment.concerns && riskAssessment.concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Concerns</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {riskAssessment.concerns.map((concern: { description: string }, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700">{concern.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm font-medium text-blue-900">Recommended Action</p>
                <p className="mt-1 text-base font-semibold text-blue-700 capitalize">
                  {riskAssessment.recommended_action.replace('_', ' ')}
                </p>
              </div>

              <div className="text-sm text-gray-500">
                Assessed: {new Date(riskAssessment.assessed_at).toLocaleString()}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Milestone Recording Modal */}
        <Modal
          open={milestoneModalOpen}
          onOpenChange={setMilestoneModalOpen}
          title={milestoneFellow ? `Record Milestones - ${milestoneFellow.name}` : 'Record Milestones'}
        >
          {milestoneFellow && (
            <div className="space-y-5">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium">{milestoneFellow.name}</p>
                <p className="text-sm text-gray-600 capitalize">{milestoneFellow.role.replace('_', ' ')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'milestone_1_score', label: 'Milestone 1 Score (%)' },
                  { key: 'milestone_2_score', label: 'Milestone 2 Score (%)' },
                  { key: 'milestone_3_score', label: 'Milestone 3 Score (%)' },
                  { key: 'final_score', label: 'Final Score (0-5)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={key === 'final_score' ? 5 : 100}
                      value={(milestoneForm as any)[key]}
                      onChange={(e) => setMilestoneForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={key === 'final_score' ? '0.0 - 5.0' : '0 - 100'}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setMilestoneModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveMilestones} disabled={savingMilestones}>
                  {savingMilestones ? 'Saving...' : 'Save Milestones'}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Fellow Detail Modal */}
        <Modal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          title={detailFellow ? `Fellow - ${detailFellow.name}` : 'Fellow Detail'}
          size="lg"
        >
          {loadingDetail ? (
            <div className="py-8 text-center text-gray-500">Loading details...</div>
          ) : detailFellow ? (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Fellow Info Header */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-lg font-semibold">{detailFellow.name}</p>
                <p className="text-sm text-gray-600">{detailFellow.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant={getStatusBadgeVariant(detailFellow.status)}>{detailFellow.status}</Badge>
                  <span className="capitalize text-sm text-gray-600">{detailFellow.role.replace('_', ' ')}</span>
                  {detailFellow.current_risk_level && (
                    <Badge variant={getRiskBadgeVariant(detailFellow.current_risk_level)}>
                      {detailFellow.current_risk_level.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Milestone Scores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Milestone Progress</h4>
                  <Button size="sm" variant="secondary" onClick={() => handleOpenMilestones(detailFellow)}>
                    <TrendingUp className="mr-1 h-3 w-3" /> Record Milestones
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'M1', value: detailFellow.milestone_1_score, pct: true },
                    { label: 'M2', value: detailFellow.milestone_2_score, pct: true },
                    { label: 'M3', value: detailFellow.milestone_3_score, pct: true },
                    { label: 'Final', value: detailFellow.final_score, pct: false },
                  ].map(({ label, value, pct }) => (
                    <div key={label} className="rounded-lg border p-3 text-center">
                      <p className="text-sm text-gray-600">{label}</p>
                      <p className={`text-2xl font-bold ${value != null ? (pct ? (value >= 70 ? 'text-green-600' : 'text-yellow-600') : (value >= 2.5 ? 'text-green-600' : 'text-red-600')) : 'text-gray-400'}`}>
                        {value != null ? (pct ? `${value}%` : value.toFixed(1)) : '-'}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-sm text-gray-600">Warnings</p>
                    <p className={`text-2xl font-bold ${detailFellow.warnings_count && detailFellow.warnings_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {detailFellow.warnings_count || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Risk History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Risk Assessment History</h4>
                {fellowRiskHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No risk assessments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {fellowRiskHistory.map((assessment) => (
                      <div key={assessment.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">Week {assessment.week}</Badge>
                          <Badge variant={getRiskBadgeVariant(assessment.risk_level)}>
                            {assessment.risk_level.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                assessment.risk_score < 0.25 ? 'bg-green-600' :
                                assessment.risk_score < 0.5 ? 'bg-yellow-600' :
                                assessment.risk_score < 0.75 ? 'bg-orange-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${assessment.risk_score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{assessment.risk_score.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Attendance History</h4>
                {fellowAttendance.length === 0 ? (
                  <p className="text-sm text-gray-500">No attendance records yet.</p>
                ) : (
                  <div>
                    {/* Attendance summary */}
                    {(() => {
                      const total = fellowAttendance.length;
                      const present = fellowAttendance.filter(a => a.status === 'present').length;
                      const late = fellowAttendance.filter(a => a.status === 'late').length;
                      const veryLate = fellowAttendance.filter(a => a.status === 'very_late').length;
                      const absent = fellowAttendance.filter(a => a.status === 'absent').length;
                      const scoreMap: Record<string, number> = { present: 1.0, late: 0.8, very_late: 0.5, absent: 0.0, approved_absence: 0.7 };
                      const avgScore = total > 0 ? fellowAttendance.reduce((sum, a) => sum + (scoreMap[a.status] ?? 0.5), 0) / total : 0;
                      return (
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          <div className="rounded-lg bg-green-50 p-2 text-center">
                            <p className="text-xs text-green-700">Present</p>
                            <p className="text-lg font-bold text-green-600">{present}</p>
                          </div>
                          <div className="rounded-lg bg-yellow-50 p-2 text-center">
                            <p className="text-xs text-yellow-700">Late</p>
                            <p className="text-lg font-bold text-yellow-600">{late}</p>
                          </div>
                          <div className="rounded-lg bg-orange-50 p-2 text-center">
                            <p className="text-xs text-orange-700">Very Late</p>
                            <p className="text-lg font-bold text-orange-600">{veryLate}</p>
                          </div>
                          <div className="rounded-lg bg-red-50 p-2 text-center">
                            <p className="text-xs text-red-700">Absent</p>
                            <p className="text-lg font-bold text-red-600">{absent}</p>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-2 text-center">
                            <p className="text-xs text-blue-700">Score</p>
                            <p className={`text-lg font-bold ${avgScore >= 0.9 ? 'text-green-600' : avgScore >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {(avgScore * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {fellowAttendance.slice(0, 12).map((att) => (
                        <div key={att.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600 capitalize">{att.meeting_type?.replace('_', ' ') || 'Meeting'}</span>
                            {att.scheduled_at && (
                              <span className="text-xs text-gray-400">{new Date(att.scheduled_at).toLocaleDateString()}</span>
                            )}
                          </div>
                          <Badge
                            variant={
                              att.status === 'present' ? 'success' :
                              att.status === 'late' ? 'warning' :
                              att.status === 'very_late' ? 'warning' :
                              att.status === 'absent' ? 'danger' : 'default'
                            }
                          >
                            {att.status.replace('_', ' ')}
                            {att.minutes_late ? ` (${att.minutes_late}m)` : ''}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Check-in History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Check-in History</h4>
                {fellowCheckIns.length === 0 ? (
                  <p className="text-sm text-gray-500">No check-ins submitted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {fellowCheckIns.slice(0, 8).map((checkIn) => (
                      <div key={checkIn.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary">Week {checkIn.week}</Badge>
                          <span className="text-xs text-gray-500">{new Date(checkIn.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600">
                          {checkIn.energy_level !== undefined && <span>Energy: {checkIn.energy_level}/10</span>}
                          {checkIn.sentiment_score !== undefined && checkIn.sentiment_score !== null && <span>Sentiment: {checkIn.sentiment_score.toFixed(2)}</span>}
                          {checkIn.self_assessment && <span className="capitalize">Self: {checkIn.self_assessment}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
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
