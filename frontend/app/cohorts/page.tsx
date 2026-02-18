'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { cohortsAPI, applicantsAPI, fellowsAPI } from '@/lib/api';
import {
  Plus,
  Calendar,
  Users,
  TrendingUp,
  ArrowRight,
  Pencil,
  GraduationCap,
} from 'lucide-react';
import type { Cohort, Applicant, Fellow } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  applications_open: 'Applications Open',
  microship: 'Microship',
  active: 'Active',
  completed: 'Completed',
};

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  planning: { next: 'applications_open', label: 'Open Applications' },
  applications_open: { next: 'microship', label: 'Start Microship' },
  microship: { next: 'active', label: 'Activate Cohort' },
  active: { next: 'completed', label: 'Complete Cohort' },
};

export default function CohortsPage() {
  const { toast } = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [fellowCounts, setFellowCounts] = useState<Record<string, number>>({});

  // Graduate modal
  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [graduatingCohort, setGraduatingCohort] = useState<Cohort | null>(null);
  const [graduating, setGraduating] = useState(false);
  const [graduateThresholds, setGraduateThresholds] = useState({
    distinction_threshold: 3.5,
    pass_threshold: 2.5,
  });
  const [graduateResult, setGraduateResult] = useState<any>(null);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    target_size: 100,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cohortsRes, applicantsRes, fellowsRes] = await Promise.all([
        cohortsAPI.list(),
        applicantsAPI.list(),
        fellowsAPI.list(),
      ]);
      setCohorts(cohortsRes.data);

      // Compute per-cohort counts
      const appCounts: Record<string, number> = {};
      (applicantsRes.data as Applicant[]).forEach(a => {
        appCounts[a.cohort_id] = (appCounts[a.cohort_id] || 0) + 1;
      });
      setApplicantCounts(appCounts);

      const felCounts: Record<string, number> = {};
      (fellowsRes.data as Fellow[]).forEach(f => {
        felCounts[f.cohort_id] = (felCounts[f.cohort_id] || 0) + 1;
      });
      setFellowCounts(felCounts);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', start_date: '', end_date: '', target_size: 100 });
    setEditingCohort(null);
  };

  const handleEdit = (cohort: Cohort) => {
    setEditingCohort(cohort);
    setFormData({
      name: cohort.name,
      start_date: cohort.start_date,
      end_date: cohort.end_date,
      target_size: cohort.target_size || 100,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCohort) {
        await cohortsAPI.update(editingCohort.id, formData);
      } else {
        await cohortsAPI.create(formData);
      }
      setModalOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Failed to save cohort.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (cohortId: string, newStatus: string) => {
    try {
      await cohortsAPI.updateStatus(cohortId, newStatus);
      await fetchData();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Failed to update status.', 'error');
    }
  };

  const handleGraduate = async () => {
    if (!graduatingCohort) return;
    setGraduating(true);
    try {
      const res = await cohortsAPI.graduate(graduatingCohort.id, graduateThresholds);
      setGraduateResult(res.data);
      await fetchData();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Failed to graduate cohort.', 'error');
    } finally {
      setGraduating(false);
    }
  };

  const stats = {
    total: cohorts.length,
    planning: cohorts.filter(c => c.status === 'planning').length,
    active: cohorts.filter(c => c.status === 'active' || c.status === 'applications_open' || c.status === 'microship').length,
    completed: cohorts.filter(c => c.status === 'completed').length,
  };

  return (
    <AppLayout>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cohorts</h1>
              <p className="mt-2 text-gray-600">
                Manage program cohorts and their lifecycle.
              </p>
            </div>
            <Button variant="primary" onClick={() => { resetForm(); setModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Cohort
            </Button>
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
                <p className="text-sm font-medium text-gray-600">Planning</p>
                <p className="mt-2 text-2xl font-bold text-gray-500">{stats.planning}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">{stats.completed}</p>
              </div>
            </Card>
          </div>

          {/* Cohort Cards */}
          {cohorts.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No cohorts</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new cohort to get started.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cohorts.map(cohort => {
                const transition = STATUS_TRANSITIONS[cohort.status];
                const appCount = applicantCounts[cohort.id] || 0;
                const felCount = fellowCounts[cohort.id] || 0;

                return (
                  <Card key={cohort.id}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{cohort.name}</h3>
                          <Badge variant={getStatusBadgeVariant(cohort.status)} className="mt-1">
                            {STATUS_LABELS[cohort.status] || cohort.status}
                          </Badge>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => handleEdit(cohort)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>
                            {new Date(cohort.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' '}&mdash;{' '}
                            {new Date(cohort.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span>{appCount} applicant{appCount !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-gray-400" />
                            <span>{felCount} fellow{felCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="text-gray-500">
                          Target size: {cohort.target_size}
                        </div>
                      </div>

                      {/* Actions */}
                      {(transition || cohort.status === 'active') && (
                        <div className="pt-3 border-t border-gray-100 flex gap-2">
                          {cohort.status === 'active' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setGraduatingCohort(cohort);
                                setGraduateResult(null);
                                setGraduateThresholds({ distinction_threshold: 3.5, pass_threshold: 2.5 });
                                setGraduateModalOpen(true);
                              }}
                            >
                              <GraduationCap className="mr-1 h-3 w-3" />
                              Graduate
                            </Button>
                          )}
                          {transition && cohort.status !== 'active' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleStatusChange(cohort.id, transition.next)}
                            >
                              <ArrowRight className="mr-1 h-3 w-3" />
                              {transition.label}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Graduate Modal */}
          <Modal
            open={graduateModalOpen}
            onOpenChange={setGraduateModalOpen}
            title={graduatingCohort ? `Graduate - ${graduatingCohort.name}` : 'Graduate Cohort'}
          >
            {graduatingCohort && (
              <div className="space-y-5">
                {graduateResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                      <GraduationCap className="mx-auto h-8 w-8 text-green-600 mb-2" />
                      <p className="text-lg font-semibold text-green-900">{graduateResult.message}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-sm text-gray-600">Graduated</p>
                        <p className="text-2xl font-bold text-green-600">{graduateResult.graduated}</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-sm text-gray-600">Distinction</p>
                        <p className="text-2xl font-bold text-blue-600">{graduateResult.graduated_with_distinction}</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-sm text-gray-600">Did Not Graduate</p>
                        <p className="text-2xl font-bold text-red-600">{graduateResult.did_not_graduate}</p>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                      <Button variant="primary" onClick={() => setGraduateModalOpen(false)}>Done</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      This will grade all active fellows based on their final scores and transition the cohort to completed.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Distinction Threshold</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={graduateThresholds.distinction_threshold}
                          onChange={(e) => setGraduateThresholds(prev => ({ ...prev, distinction_threshold: parseFloat(e.target.value) || 0 }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Final score &ge; this = Distinction</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pass Threshold</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={graduateThresholds.pass_threshold}
                          onChange={(e) => setGraduateThresholds(prev => ({ ...prev, pass_threshold: parseFloat(e.target.value) || 0 }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Final score &ge; this = Pass</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This action cannot be undone. Fellows with scores below the pass threshold will be marked as did not graduate.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button variant="secondary" onClick={() => setGraduateModalOpen(false)}>Cancel</Button>
                      <Button variant="primary" onClick={handleGraduate} disabled={graduating}>
                        {graduating ? 'Graduating...' : 'Graduate Cohort'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Create/Edit Modal */}
          <Modal
            open={modalOpen}
            onOpenChange={(open) => { setModalOpen(open); if (!open) resetForm(); }}
            title={editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
          >
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="e.g. Cohort 5 - Q1 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Size</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.target_size}
                  onChange={e => setFormData(prev => ({ ...prev, target_size: parseInt(e.target.value) || 100 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingCohort ? 'Save Changes' : 'Create Cohort')}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </AppLayout>
  );
}
