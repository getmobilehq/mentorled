'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { deliveryAPI } from '@/lib/api';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Send,
  Edit3,
} from 'lucide-react';
import type { RiskDashboard, Warning } from '@/types';

export default function DeliveryPage() {
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftingWarning, setDraftingWarning] = useState<string | null>(null);
  const [warningDraft, setWarningDraft] = useState<Warning | null>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await deliveryAPI.getRiskDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching risk dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDraftWarning = async (fellowId: string) => {
    setDraftingWarning(fellowId);
    try {
      const response = await deliveryAPI.draftWarning(fellowId);
      setWarningDraft(response.data.draft);
      setEditedMessage(response.data.draft.message || '');
      setWarningModalOpen(true);
    } catch (error) {
      console.error('Error drafting warning:', error);
      alert('Failed to draft warning. Make sure fellow has a risk assessment first.');
    } finally {
      setDraftingWarning(null);
    }
  };

  const handleSendWarning = async (approved: boolean) => {
    if (!warningDraft) return;

    try {
      await deliveryAPI.approveWarning(
        warningDraft.id,
        approved,
        approved ? editedMessage : undefined
      );
      setWarningModalOpen(false);
      setWarningDraft(null);
      setEditedMessage('');
      await fetchDashboard();
    } catch (error) {
      console.error('Error sending warning:', error);
      alert('Failed to send warning. Please try again.');
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

  // Sort fellows by risk level (critical first)
  const sortedFellows = dashboard?.fellows.sort((a, b) => {
    const riskOrder = { critical: 0, at_risk: 1, monitor: 2, on_track: 3 };
    const aRisk = a.risk_level || 'on_track';
    const bRisk = b.risk_level || 'on_track';
    return riskOrder[aRisk] - riskOrder[bRisk];
  }) || [];

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
        <h1 className="text-3xl font-bold text-gray-900">Risk & Delivery Management</h1>
        <p className="mt-2 text-gray-600">
          Monitor fellow risk levels and manage intervention workflows
        </p>
      </div>

      {/* Risk Summary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">On Track</p>
              <p className="text-2xl font-bold text-green-600">
                {dashboard?.summary.on_track || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Monitor</p>
              <p className="text-2xl font-bold text-blue-600">
                {dashboard?.summary.monitor || 0}
              </p>
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
              <p className="text-2xl font-bold text-yellow-600">
                {dashboard?.summary.at_risk || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">
                {dashboard?.summary.critical || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Risk-sorted Fellows Table */}
      <Card padding={false}>
        <CardHeader className="px-6 pt-6">
          <CardTitle>Fellows by Risk Level (Critical First)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {sortedFellows.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows to monitor</h3>
              <p className="mt-1 text-sm text-gray-500">
                Fellows will appear here once they are active in the program.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Warnings Sent</TableHead>
                  <TableHead>Milestone 1</TableHead>
                  <TableHead>Milestone 2</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFellows.map((fellow) => (
                  <TableRow key={fellow.id}>
                    <TableCell className="font-medium">{fellow.name}</TableCell>
                    <TableCell>
                      <span className="capitalize">{fellow.role.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell>
                      {fellow.risk_level ? (
                        <Badge variant={getRiskBadgeVariant(fellow.risk_level)}>
                          {fellow.risk_level.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">Not assessed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {fellow.warnings_count > 0 ? (
                        <Badge variant="warning">
                          {fellow.warnings_count} {fellow.warnings_count === 1 ? 'warning' : 'warnings'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">None</span>
                      )}
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
                      {['at_risk', 'critical'].includes(fellow.risk_level || '') && (
                        <Button
                          size="sm"
                          variant={fellow.risk_level === 'critical' ? 'danger' : 'secondary'}
                          onClick={() => handleDraftWarning(fellow.id)}
                          disabled={draftingWarning === fellow.id}
                        >
                          {draftingWarning === fellow.id ? (
                            'Drafting...'
                          ) : (
                            <>
                              <MessageSquare className="mr-1 h-4 w-4" />
                              Draft Warning
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Warning Draft Modal */}
      <Modal
        open={warningModalOpen}
        onOpenChange={setWarningModalOpen}
        title="Review AI-Drafted Warning"
        size="xl"
      >
        {warningDraft && (
          <div className="space-y-6">
            {/* Warning Info */}
            <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Warning #{warningDraft.warning_number}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Tone: <span className="font-semibold capitalize">{warningDraft.tone}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Warning Message</h4>
                <Badge variant="info" className="flex items-center">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Editable
                </Badge>
              </div>
              <textarea
                className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                placeholder="AI-generated warning message..."
              />
              <p className="mt-2 text-sm text-gray-500">
                You can edit the message above before sending. The AI draft is shown by default.
              </p>
            </div>

            {/* Required Actions */}
            {warningDraft.required_actions && warningDraft.required_actions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Required Actions</h4>
                <ul className="list-disc list-inside space-y-1 bg-gray-50 p-4 rounded-lg">
                  {warningDraft.required_actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{action}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Consequences */}
            {warningDraft.consequences && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Consequences if Not Addressed</h4>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-sm text-red-800">{warningDraft.consequences}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setWarningModalOpen(false);
                  setEditedMessage('');
                }}
              >
                Cancel
              </Button>
              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => handleSendWarning(false)}
                >
                  Discard Draft
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSendWarning(true)}
                  disabled={!editedMessage.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Warning
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
