'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI, screeningAPI } from '@/lib/api';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { Applicant, Evaluation } from '@/types';

export default function ScreeningPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchApplicants();
  }, []);

  const fetchApplicants = async () => {
    try {
      const response = await applicantsAPI.list();
      setApplicants(response.data);
    } catch (error) {
      console.error('Error fetching applicants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (applicantId: string) => {
    setEvaluating(applicantId);
    try {
      const response = await screeningAPI.evaluateApplication(applicantId);
      setSelectedEvaluation(response.data);
      setModalOpen(true);

      // Refresh applicants list
      await fetchApplicants();
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
        selectedEvaluation.evaluation_id,  // Fixed: Use evaluation_id, not applicant_id
        approved
      );
      setModalOpen(false);
      setSelectedEvaluation(null);
      await fetchApplicants();
    } catch (error) {
      console.error('Error approving evaluation:', error);
      alert('Failed to save decision. Please try again.');
    }
  };

  // Filter applicants by status
  const pendingApplicants = applicants.filter(
    (a) => a.status === 'applied' || a.status === 'screening'
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Screening Queue</h1>
        <p className="mt-2 text-gray-600">
          Review and evaluate applicants using AI-powered screening
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Pending Evaluation</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {pendingApplicants.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Applicants</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {applicants.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Accepted</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {applicants.filter((a) => a.status === 'accepted').length}
            </p>
          </div>
        </Card>
      </div>

      {/* Applicants table */}
      <Card padding={false}>
        <CardHeader className="px-6 pt-6">
          <CardTitle>Applicants</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {pendingApplicants.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending applicants</h3>
              <p className="mt-1 text-sm text-gray-500">
                All applicants have been evaluated.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApplicants.map((applicant) => (
                  <TableRow key={applicant.id}>
                    <TableCell className="font-medium">{applicant.name}</TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {applicant.role.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{applicant.email}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(applicant.status)}>
                        {applicant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
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
                      {key.replace('_', ' ')}
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
                {selectedEvaluation.recommended_action.replace('_', ' ')}
              </p>
            </div>

            {/* Confidence */}
            <div>
              <p className="text-sm text-gray-600">
                AI Confidence: <span className="font-semibold">{(selectedEvaluation.confidence * 100).toFixed(0)}%</span>
              </p>
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
    </ProtectedRoute>
  );
}
