'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/Toast';
import { microshipAPI, applicantsAPI, cohortsAPI } from '@/lib/api';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  FileText,
  Search,
  Zap,
  Eye,
  MessageSquare,
} from 'lucide-react';
import type {
  MicroshipSubmission,
  MicroshipEvaluationResponse,
  Applicant,
  Cohort,
} from '@/types';

export default function MicroshipPage() {
  const { toast, confirm } = useToast();
  const [submissions, setSubmissions] = useState<MicroshipSubmission[]>([]);
  const [applicants, setApplicants] = useState<{ [key: string]: Applicant }>({});
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<MicroshipEvaluationResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'evaluated'>('all');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkEvaluating, setBulkEvaluating] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<MicroshipSubmission | null>(null);

  useEffect(() => {
    cohortsAPI.list().then(res => setCohorts(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const [submissionsRes, applicantsRes] = await Promise.all([
        microshipAPI.listSubmissions(),
        applicantsAPI.list(),
      ]);

      setSubmissions(submissionsRes.data);

      const applicantsMap: { [key: string]: Applicant } = {};
      applicantsRes.data.forEach((applicant: Applicant) => {
        applicantsMap[applicant.id] = applicant;
      });
      setApplicants(applicantsMap);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (submissionId: string) => {
    setEvaluating(submissionId);
    try {
      const response = await microshipAPI.evaluateSubmission(submissionId);
      setSelectedEvaluation(response.data);
      setModalOpen(true);
      await fetchSubmissions();
    } catch (error) {
      console.error('Error evaluating submission:', error);
      toast('Failed to evaluate submission. Please try again.', 'error');
    } finally {
      setEvaluating(null);
    }
  };

  const handleBulkEvaluate = async () => {
    const pending = submissions.filter(s => !s.raw_analysis);
    if (pending.length === 0) return;

    confirm(`Evaluate ${pending.length} pending submissions using AI? This may take a while.`, async () => {
      setBulkEvaluating(true);
      try {
        const result = await microshipAPI.evaluateBulk();
        const data = result.data;
        toast(`Bulk evaluation complete: ${data.evaluated} evaluated, ${data.errors} errors.`, 'success');
        await fetchSubmissions();
      } catch (error) {
        console.error('Error bulk evaluating:', error);
        toast('Failed to start bulk evaluation.', 'error');
      } finally {
        setBulkEvaluating(false);
      }
    });
  };

  const handleViewDetail = (submission: MicroshipSubmission) => {
    setSelectedSubmission(submission);
    setDetailModalOpen(true);
  };

  const getOutcomeBadgeVariant = (outcome?: string) => {
    if (!outcome) return 'secondary';
    switch (outcome) {
      case 'progress':
        return 'success';
      case 'borderline':
        return 'warning';
      case 'do_not_progress':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    if (filter === 'pending') filtered = filtered.filter(s => !s.raw_analysis);
    if (filter === 'evaluated') filtered = filtered.filter(s => s.raw_analysis);

    if (selectedCohortId) {
      filtered = filtered.filter(s => {
        const app = applicants[s.applicant_id];
        return app && app.cohort_id === selectedCohortId;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const app = applicants[s.applicant_id];
        return app && (app.name.toLowerCase().includes(q) || app.email.toLowerCase().includes(q));
      });
    }

    return filtered;
  }, [submissions, filter, selectedCohortId, searchQuery, applicants]);

  // Stats
  const stats = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter(s => !s.raw_analysis).length,
    evaluated: submissions.filter(s => s.raw_analysis).length,
    progress: submissions.filter(s => s.raw_analysis?.outcome === 'progress').length,
    borderline: submissions.filter(s => s.raw_analysis?.outcome === 'borderline').length,
    doNotProgress: submissions.filter(s => s.raw_analysis?.outcome === 'do_not_progress').length,
  }), [submissions]);

  return (
    <AppLayout>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Microship Submissions</h1>
              <p className="mt-2 text-gray-600">
                Review and evaluate Microship Challenge submissions using AI
              </p>
            </div>
            {stats.pending > 0 && (
              <Button
                onClick={handleBulkEvaluate}
                disabled={bulkEvaluating}
              >
                {bulkEvaluating ? (
                  'Evaluating...'
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Bulk Evaluate ({stats.pending})
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="mt-2 text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Evaluated</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">{stats.evaluated}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Progress</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{stats.progress}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Borderline</p>
                <p className="mt-2 text-2xl font-bold text-yellow-600">{stats.borderline}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Do Not Progress</p>
                <p className="mt-2 text-2xl font-bold text-red-600">{stats.doNotProgress}</p>
              </div>
            </Card>
          </div>

          {/* Filters */}
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

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by applicant name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-2">
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
                variant={filter === 'evaluated' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('evaluated')}
              >
                Evaluated ({stats.evaluated})
              </Button>
            </div>
          </div>

          {/* Submissions table */}
          <Card padding={false}>
            <CardHeader className="px-6 pt-6">
              <CardTitle>Submissions ({filteredSubmissions.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {filteredSubmissions.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter === 'pending'
                      ? 'All submissions have been evaluated.'
                      : filter === 'evaluated'
                      ? 'No submissions have been evaluated yet.'
                      : 'No Microship submissions found.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>On Time</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => {
                      const applicant = applicants[submission.applicant_id];
                      const evaluation = submission.raw_analysis;

                      return (
                        <TableRow
                          key={submission.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleViewDetail(submission)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{applicant?.name || 'Unknown'}</p>
                              <p className="text-sm text-gray-500">{applicant?.email || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-sm">
                              {applicant?.role?.replace('_', ' ') || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {submission.submission_type || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {submission.submitted_at
                              ? new Date(submission.submitted_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {submission.on_time === true ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : submission.on_time === false ? (
                              <Clock className="h-4 w-4 text-red-600" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {evaluation ? (
                              <Badge variant={getOutcomeBadgeVariant(evaluation.outcome)}>
                                {evaluation.outcome.replace(/_/g, ' ')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {evaluation ? (
                              <span className="font-semibold">
                                {evaluation.weighted_score.toFixed(2)}/4.0
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {submission.submission_url && (
                                <a
                                  href={submission.submission_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleEvaluate(submission.id)}
                                disabled={evaluating === submission.id}
                                variant={evaluation ? 'secondary' : 'primary'}
                              >
                                {evaluating === submission.id ? (
                                  <>Evaluating...</>
                                ) : (
                                  <>
                                    <Play className="mr-1 h-4 w-4" />
                                    {evaluation ? 'Re-evaluate' : 'Evaluate'}
                                  </>
                                )}
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

          {/* Submission Detail Modal */}
          <Modal
            open={detailModalOpen}
            onOpenChange={setDetailModalOpen}
            title="Submission Details"
            size="lg"
          >
            {selectedSubmission && (() => {
              const app = applicants[selectedSubmission.applicant_id];
              const eval_ = selectedSubmission.raw_analysis;

              return (
                <div className="space-y-6">
                  {/* Applicant Info */}
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{app?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">{app?.email || ''}</p>
                        <p className="text-sm text-gray-500 capitalize mt-1">
                          {app?.role?.replace('_', ' ') || 'Unknown role'}
                        </p>
                      </div>
                      {eval_ && (
                        <Badge
                          variant={getOutcomeBadgeVariant(eval_.outcome)}
                          className="text-lg px-4 py-2"
                        >
                          {eval_.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Submission Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Submission Type</p>
                      <p className="mt-1 font-medium capitalize">{selectedSubmission.submission_type || '-'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">On Time</p>
                      <p className="mt-1 font-medium">
                        {selectedSubmission.on_time === true ? 'Yes' : selectedSubmission.on_time === false ? 'No (Late)' : '-'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Submitted</p>
                      <p className="mt-1 font-medium">
                        {selectedSubmission.submitted_at ? new Date(selectedSubmission.submitted_at).toLocaleString() : '-'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Deadline</p>
                      <p className="mt-1 font-medium">
                        {selectedSubmission.deadline ? new Date(selectedSubmission.deadline).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Submission URL */}
                  {selectedSubmission.submission_url && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Submission URL</p>
                      <a
                        href={selectedSubmission.submission_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm break-all"
                      >
                        {selectedSubmission.submission_url}
                      </a>
                    </div>
                  )}

                  {/* Communication Log */}
                  {selectedSubmission.communication_log && selectedSubmission.communication_log.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Communication Log</h4>
                      <div className="space-y-2">
                        {selectedSubmission.communication_log.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                            <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">{entry.type}</Badge>
                                <span className="text-xs text-gray-500">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{entry.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evaluation Results (if evaluated) */}
                  {eval_ && (
                    <>
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 mb-3">Evaluation Results</h4>

                        {/* Weighted Score */}
                        <div className="rounded-lg bg-blue-50 p-4 mb-4">
                          <p className="text-sm font-medium text-blue-900">Weighted Score</p>
                          <p className="mt-1 text-3xl font-bold text-blue-700">
                            {eval_.weighted_score.toFixed(2)}/4.0
                          </p>
                        </div>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-sm text-gray-600">Technical Execution (40%)</p>
                            <p className="mt-1 text-xl font-semibold">{eval_.scores.technical_execution}/4</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-sm text-gray-600">Execution Discipline (25%)</p>
                            <p className="mt-1 text-xl font-semibold">{eval_.scores.execution_discipline}/4</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-sm text-gray-600">Professional Behavior (25%)</p>
                            <p className="mt-1 text-xl font-semibold">{eval_.scores.professional_behavior}/4</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-sm text-gray-600">Instruction Following (10%)</p>
                            <p className="mt-1 text-xl font-semibold">{eval_.scores.instruction_following}/4</p>
                          </div>
                        </div>

                        {/* Evidence */}
                        {eval_.evidence && (
                          <div className="space-y-2 mb-4">
                            {Object.entries(eval_.evidence).map(([key, value]) => (
                              <div key={key} className="rounded-lg bg-gray-50 p-3">
                                <p className="text-sm font-medium text-gray-700 capitalize">{key}</p>
                                <p className="mt-1 text-sm text-gray-600">{value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Strengths & Concerns */}
                        {eval_.strengths && eval_.strengths.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Strengths</p>
                            <ul className="list-disc list-inside space-y-1">
                              {eval_.strengths.map((s, i) => (
                                <li key={i} className="text-sm text-gray-600">{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {eval_.concerns && eval_.concerns.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Concerns</p>
                            <ul className="list-disc list-inside space-y-1">
                              {eval_.concerns.map((c, i) => (
                                <li key={i} className="text-sm text-gray-600">{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Reasoning */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">AI Reasoning</p>
                          <p className="text-sm text-gray-600">{eval_.reasoning}</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>

          {/* Evaluation Results Modal (from evaluate button) */}
          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title="Microship Evaluation Results"
            size="lg"
          >
            {selectedEvaluation && (
              <div className="space-y-6">
                {/* Applicant Info */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Applicant</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {selectedEvaluation.applicant_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Evaluated: {new Date(selectedEvaluation.evaluated_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={getOutcomeBadgeVariant(selectedEvaluation.evaluation.outcome)}
                      className="text-lg px-4 py-2"
                    >
                      {selectedEvaluation.evaluation.outcome.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Weighted Score */}
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-900">Weighted Score</p>
                  <p className="mt-1 text-3xl font-bold text-blue-700">
                    {selectedEvaluation.evaluation.weighted_score.toFixed(2)}/4.0
                  </p>
                </div>

                {/* Scores Breakdown */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Scores Breakdown</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Technical Execution (40%)</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {selectedEvaluation.evaluation.scores.technical_execution}/4
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Execution Discipline (25%)</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {selectedEvaluation.evaluation.scores.execution_discipline}/4
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Professional Behavior (25%)</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {selectedEvaluation.evaluation.scores.professional_behavior}/4
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm text-gray-600">Instruction Following (10%)</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {selectedEvaluation.evaluation.scores.instruction_following}/4
                      </p>
                    </div>
                  </div>
                </div>

                {/* Disqualifiers */}
                {selectedEvaluation.evaluation.disqualifiers &&
                 selectedEvaluation.evaluation.disqualifiers.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900 mb-2">Disqualifiers</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedEvaluation.evaluation.disqualifiers.map((item, idx) => (
                            <li key={idx} className="text-sm text-red-700">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strengths & Concerns */}
                {selectedEvaluation.evaluation.strengths.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Strengths</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedEvaluation.evaluation.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEvaluation.evaluation.concerns.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Concerns</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedEvaluation.evaluation.concerns.map((concern, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Reasoning */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">AI Reasoning</h4>
                  <p className="text-sm text-gray-700">{selectedEvaluation.evaluation.reasoning}</p>
                </div>

                {/* Confidence */}
                <div>
                  <p className="text-sm text-gray-600">
                    AI Confidence:{' '}
                    <span className="font-semibold">
                      {(selectedEvaluation.evaluation.confidence * 100).toFixed(0)}%
                    </span>
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}
    </AppLayout>
  );
}
