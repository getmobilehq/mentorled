'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { fellowsAPI, deliveryAPI } from '@/lib/api';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Shield,
} from 'lucide-react';
import type { Fellow, RiskAssessment } from '@/types';

export default function FellowsPage() {
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFellow, setSelectedFellow] = useState<Fellow | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [assessingRisk, setAssessingRisk] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchFellows();
  }, []);

  const fetchFellows = async () => {
    try {
      const response = await fellowsAPI.list();
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

      // Refresh fellows list to show updated risk level
      await fetchFellows();
    } catch (error) {
      console.error('Error assessing risk:', error);
      alert('Failed to assess risk. Please try again.');
    } finally {
      setAssessingRisk(null);
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

  const getRiskColor = (level?: string) => {
    const map: Record<string, string> = {
      on_track: 'text-green-600',
      monitor: 'text-blue-600',
      at_risk: 'text-yellow-600',
      critical: 'text-red-600',
    };
    return map[level || 'on_track'] || 'text-gray-600';
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Fellows</h1>
        <p className="mt-2 text-gray-600">
          Monitor fellow progress and manage risk assessments
        </p>
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
          <CardTitle>All Fellows</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {fellows.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Fellows will appear here once applicants are accepted.
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
                  <TableHead>Milestone 1</TableHead>
                  <TableHead>Milestone 2</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fellows.map((fellow) => (
                  <TableRow key={fellow.id}>
                    <TableCell className="font-medium">{fellow.name}</TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {fellow.role.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {fellow.team_id ? (
                        <Badge variant="info">Team {fellow.team_id.slice(0, 8)}</Badge>
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
                    <TableCell className="text-right">
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
            {/* Fellow Info */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Fellow</p>
              <p className="text-lg font-semibold text-gray-900">{selectedFellow.name}</p>
              <p className="text-sm text-gray-600 capitalize">{selectedFellow.role.replace('_', ' ')}</p>
            </div>

            {/* Risk Score */}
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

            {/* Contributing Factors */}
            {riskAssessment.contributing_factors && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Contributing Factors</h4>
                <div className="space-y-2">
                  {Object.entries(riskAssessment.contributing_factors).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                      <span className="text-sm text-gray-700 capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Concerns */}
            {riskAssessment.ai_concerns && riskAssessment.ai_concerns.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">AI-Identified Concerns</h4>
                <ul className="list-disc list-inside space-y-1">
                  {riskAssessment.ai_concerns.map((concern, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{concern}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Action */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-900">Recommended Action</p>
              <p className="mt-1 text-base font-semibold text-blue-700 capitalize">
                {riskAssessment.recommended_action.replace('_', ' ')}
              </p>
            </div>

            {/* Assessed Date */}
            <div className="text-sm text-gray-500">
              Assessed: {new Date(riskAssessment.assessed_at).toLocaleString()}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setModalOpen(false)}>
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
