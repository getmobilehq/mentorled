'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { microshipAPI, applicantsAPI } from '@/lib/api';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type {
  MicroshipSubmission,
  MicroshipEvaluationResponse,
  Applicant
} from '@/types';

export default function MicroshipPage() {
  const [submissions, setSubmissions] = useState<MicroshipSubmission[]>([]);
  const [applicants, setApplicants] = useState<{ [key: string]: Applicant }>({});
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<MicroshipEvaluationResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'evaluated'>('all');

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

      // Create a map of applicants by ID for quick lookup
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

      // Refresh submissions list
      await fetchSubmissions();
    } catch (error) {
      console.error('Error evaluating submission:', error);
      alert('Failed to evaluate submission. Please try again.');
    } finally {
      setEvaluating(null);
    }
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
  const filteredSubmissions = submissions.filter((submission) => {
    if (filter === 'pending') return !submission.raw_analysis;
    if (filter === 'evaluated') return submission.raw_analysis;
    return true;
  });

  // Calculate stats
  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => !s.raw_analysis).length,
    evaluated: submissions.filter(s => s.raw_analysis).length,
    progress: submissions.filter(s => s.raw_analysis?.outcome === 'progress').length,
    borderline: submissions.filter(s => s.raw_analysis?.outcome === 'borderline').length,
    doNotProgress: submissions.filter(s => s.raw_analysis?.outcome === 'do_not_progress').length,
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Microship Submissions</h1>
          <p className="mt-2 text-gray-600">
            Review and evaluate Microship Challenge submissions using AI
          </p>
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

      {/* Filter Tabs */}
      <div className="flex space-x-2">
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

      {/* Submissions table */}
      <Card padding={false}>
        <CardHeader className="px-6 pt-6">
          <CardTitle>Submissions</CardTitle>
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
                  <TableHead>Challenge</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>On Time</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => {
                  const applicant = applicants[submission.applicant_id];
                  const evaluation = submission.raw_analysis;

                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {applicant?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {applicant?.role?.replace('_', ' ') || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {submission.challenge_id || '-'}
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
                            {evaluation.outcome.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Not Evaluated</Badge>
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
                      <TableCell>
                        {submission.submission_url ? (
                          <a
                            href={submission.submission_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
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
                  {selectedEvaluation.evaluation.outcome.replace('_', ' ')}
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

            {/* Evidence */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Evidence</h4>
              <div className="space-y-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Technical</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedEvaluation.evaluation.evidence.technical}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Execution</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedEvaluation.evaluation.evidence.execution}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Professional</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedEvaluation.evaluation.evidence.professional}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Instructions</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedEvaluation.evaluation.evidence.instructions}
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

            {/* Strengths */}
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

            {/* Concerns */}
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
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
