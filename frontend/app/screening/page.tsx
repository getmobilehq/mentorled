'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI, screeningAPI, cohortsAPI, bulkAPI } from '@/lib/api';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Search,
  Users,
  Zap,
  Filter,
  Clock,
} from 'lucide-react';
import type { Applicant, Evaluation, Cohort, QueueStats } from '@/types';

type StatusFilter = 'all' | 'applied' | 'screening' | 'eligible' | 'not_eligible' | 'accepted' | 'rejected';

export default function ScreeningPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [batchEvaluating, setBatchEvaluating] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    cohortsAPI.list().then(res => setCohorts(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchApplicants();
    fetchQueueStats();
  }, [selectedCohortId]);

  const fetchApplicants = async () => {
    try {
      const response = await applicantsAPI.list(selectedCohortId || undefined);
      setApplicants(response.data);
    } catch (error) {
      console.error('Error fetching applicants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await screeningAPI.getQueue();
      setQueueStats(response.data);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const handleEvaluate = async (applicantId: string) => {
    setEvaluating(applicantId);
    try {
      const response = await screeningAPI.evaluateApplication(applicantId);
      setSelectedEvaluation(response.data);
      setModalOpen(true);
      await fetchApplicants();
      await fetchQueueStats();
    } catch (error) {
      console.error('Error evaluating applicant:', error);
      alert('Failed to evaluate applicant. Please try again.');
    } finally {
      setEvaluating(null);
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!selectedEvaluation) return;

    try {
      await screeningAPI.approveEvaluation(
        selectedEvaluation.evaluation_id,
        approved
      );
      setModalOpen(false);
      setSelectedEvaluation(null);
      await fetchApplicants();
      await fetchQueueStats();
    } catch (error) {
      console.error('Error approving evaluation:', error);
      alert('Failed to save decision. Please try again.');
    }
  };

  const handleBatchEvaluate = async () => {
    const pending = applicants.filter(a => a.status === 'applied');
    if (pending.length === 0) return;

    if (!confirm(`Evaluate ${pending.length} pending applicants using AI?`)) return;

    setBatchEvaluating(true);
    try {
      const ids = pending.map(a => a.id);
      await bulkAPI.evaluateApplications(ids);
      alert(`Batch evaluation started for ${ids.length} applicants.`);
      await fetchApplicants();
      await fetchQueueStats();
    } catch (error) {
      console.error('Error batch evaluating:', error);
      alert('Failed to start batch evaluation.');
    } finally {
      setBatchEvaluating(false);
    }
  };

  // Computed filtered applicants
  const filteredApplicants = useMemo(() => {
    let filtered = applicants;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (selectedRole) {
      filtered = filtered.filter(a => a.role === selectedRole);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [applicants, statusFilter, selectedRole, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    pending: applicants.filter(a => a.status === 'applied').length,
    screening: applicants.filter(a => a.status === 'screening').length,
    eligible: applicants.filter(a => a.status === 'eligible').length,
    notEligible: applicants.filter(a => a.status === 'not_eligible').length,
    accepted: applicants.filter(a => a.status === 'accepted').length,
    rejected: applicants.filter(a => a.status === 'rejected').length,
  }), [applicants]);

  const STATUS_FILTERS: { label: string; value: StatusFilter; count: number }[] = [
    { label: 'All', value: 'all', count: applicants.length },
    { label: 'Pending', value: 'applied', count: stats.pending },
    { label: 'Screening', value: 'screening', count: stats.screening },
    { label: 'Eligible', value: 'eligible', count: stats.eligible },
    { label: 'Not Eligible', value: 'not_eligible', count: stats.notEligible },
    { label: 'Accepted', value: 'accepted', count: stats.accepted },
    { label: 'Rejected', value: 'rejected', count: stats.rejected },
  ];

  const ROLES = [
    { label: 'All Roles', value: '' },
    { label: 'Product Manager', value: 'product_manager' },
    { label: 'Product Designer', value: 'product_designer' },
    { label: 'Frontend', value: 'frontend' },
    { label: 'Backend', value: 'backend' },
    { label: 'QA', value: 'qa' },
  ];

  const getEligibilityBadge = (status: string) => {
    const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'secondary'; label: string }> = {
      eligible: { variant: 'success', label: 'Eligible' },
      not_eligible: { variant: 'danger', label: 'Not Eligible' },
      screening: { variant: 'info', label: 'In Review' },
      accepted: { variant: 'success', label: 'Accepted' },
      rejected: { variant: 'danger', label: 'Rejected' },
    };
    return map[status] || { variant: 'secondary' as const, label: status };
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Screening Queue</h1>
            <p className="mt-2 text-gray-600">
              Review and evaluate applicants using AI-powered screening
            </p>
          </div>
          {stats.pending > 0 && (
            <Button
              onClick={handleBatchEvaluate}
              disabled={batchEvaluating}
            >
              {batchEvaluating ? (
                'Evaluating...'
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Batch Evaluate ({stats.pending})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="mt-2 text-2xl font-bold text-orange-600">{stats.pending}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">In Review</p>
              <p className="mt-2 text-2xl font-bold text-blue-600">{stats.screening}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Eligible</p>
              <p className="mt-2 text-2xl font-bold text-green-600">{stats.eligible}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Not Eligible</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{stats.notEligible}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Accepted</p>
              <p className="mt-2 text-2xl font-bold text-green-700">{stats.accepted}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="mt-2 text-2xl font-bold text-gray-600">{stats.rejected}</p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Cohort filter */}
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Role filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(sf => (
              <Button
                key={sf.value}
                variant={statusFilter === sf.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter(sf.value)}
              >
                {sf.label} ({sf.count})
              </Button>
            ))}
          </div>
        </div>

        {/* Applicants table */}
        <Card padding={false}>
          <CardHeader className="px-6 pt-6">
            <CardTitle>
              Applicants ({filteredApplicants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {filteredApplicants.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No applicants found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Links</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplicants.map((applicant) => {
                    const eligibility = getEligibilityBadge(applicant.status);
                    const canEvaluate = applicant.status === 'applied' || applicant.status === 'screening';

                    return (
                      <TableRow key={applicant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{applicant.name}</p>
                            <p className="text-sm text-gray-500">{applicant.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-sm">
                            {applicant.role.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={eligibility.variant}>
                            {eligibility.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(applicant.applied_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {applicant.portfolio_url && (
                              <a
                                href={applicant.portfolio_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="Portfolio"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            {applicant.github_url && (
                              <a
                                href={applicant.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="GitHub"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEvaluate && (
                            <Button
                              size="sm"
                              onClick={() => handleEvaluate(applicant.id)}
                              disabled={evaluating === applicant.id}
                            >
                              {evaluating === applicant.id ? (
                                <>Evaluating...</>
                              ) : (
                                <>
                                  <Play className="mr-1 h-4 w-4" />
                                  Evaluate
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Evaluation Results Modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="AI Evaluation Results"
          size="lg"
        >
          {selectedEvaluation && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overall Score</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {selectedEvaluation.overall_score || selectedEvaluation.weighted_score}/100
                    </p>
                  </div>
                  <Badge
                    variant={getStatusBadgeVariant(
                      selectedEvaluation.eligibility || selectedEvaluation.outcome || 'default'
                    )}
                    className="text-lg px-4 py-2"
                  >
                    {selectedEvaluation.eligibility || selectedEvaluation.outcome}
                  </Badge>
                </div>
              </div>

              {/* Scores Breakdown */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Scores Breakdown</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedEvaluation.scores).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600 capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">AI Reasoning</h4>
                <p className="text-sm text-gray-700">{selectedEvaluation.reasoning}</p>
              </div>

              {/* Strengths */}
              {selectedEvaluation.strengths && selectedEvaluation.strengths.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Strengths</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedEvaluation.strengths.map((strength, idx) => (
                      <li key={idx} className="text-sm text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {selectedEvaluation.concerns && selectedEvaluation.concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Concerns</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedEvaluation.concerns.map((concern, idx) => (
                      <li key={idx} className="text-sm text-gray-700">{concern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Action */}
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">Recommended Action</p>
                <p className="mt-1 text-lg font-semibold text-blue-700 capitalize">
                  {selectedEvaluation.recommended_action.replace(/_/g, ' ')}
                </p>
              </div>

              {/* Confidence */}
              <div>
                <p className="text-sm text-gray-600">
                  AI Confidence: <span className="font-semibold">{(selectedEvaluation.confidence * 100).toFixed(0)}%</span>
                </p>
                {selectedEvaluation.requires_human_review && (
                  <p className="mt-1 text-sm text-yellow-600 font-medium">
                    Requires human review (low confidence)
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="danger"
                  onClick={() => handleApprove(false)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleApprove(true)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
