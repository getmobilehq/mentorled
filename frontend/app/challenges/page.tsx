'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { challengesAPI, cohortsAPI, trackConfigsAPI, microshipAPI } from '@/lib/api';
import {
  Plus,
  Copy,
  Check,
  Eye,
  Play,
  Pause,
  Archive,
  Flag,
  Clock,
  Users,
  ExternalLink,
  X,
  Settings,
  LayoutList,
  Layers,
  Sparkles,
  Zap,
  BarChart3,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pencil,
  Download,
} from 'lucide-react';
import type { Challenge, ChallengeSubmission, ChallengeAnalytics, Cohort, TrackConfig, TrackSummary } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  all: 'All Roles',
  product_manager: 'Product Manager',
  product_designer: 'Product Designer',
  frontend: 'Frontend',
  backend: 'Backend',
  qa: 'QA',
};

const ROLE_TYPES = ['frontend', 'backend', 'product_designer', 'product_manager', 'qa'] as const;

const DURATION_OPTIONS = [
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 36, label: '36 hours' },
  { value: 48, label: '48 hours' },
];

const OUTCOME_CONFIG: Record<string, { label: string; variant: 'success' | 'info' | 'danger' | 'warning'; icon: typeof CheckCircle }> = {
  progress: { label: 'Progress', variant: 'success', icon: CheckCircle },
  borderline: { label: 'Borderline', variant: 'warning', icon: AlertTriangle },
  do_not_progress: { label: 'Do Not Progress', variant: 'danger', icon: XCircle },
};

const SCORE_LABELS: Record<string, string> = {
  technical_execution: 'Technical Execution',
  execution_discipline: 'Execution Discipline',
  professional_behavior: 'Professional Behavior',
  instruction_following: 'Instruction Following',
};

export default function ChallengesPage() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ChallengeAnalytics | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'closed' | 'archived'>('all');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'track'>('list');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [trackSummary, setTrackSummary] = useState<TrackSummary[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Create/Edit modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: [''],
    role_type: 'all',
    submission_types: ['github'],
    deadline: '',
    cohort_id: '',
    auto_evaluate: false,
    duration_hours: '' as string | number,
    sequence_number: null as number | null,
    track_config_id: '' as string,
  });
  const [formPreFilled, setFormPreFilled] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Configure tracks modal
  const [configureOpen, setConfigureOpen] = useState(false);
  const [trackConfigs, setTrackConfigs] = useState<TrackConfig[]>([]);
  const [configFormData, setConfigFormData] = useState<Record<string, number>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Submissions modal
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Evaluation state
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [bulkEvaluating, setBulkEvaluating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<ChallengeSubmission | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deadline countdown
  const [countdowns, setCountdowns] = useState<Record<string, { text: string; color: string }>>({});

  const computeCountdowns = useCallback((challengeList: Challenge[]) => {
    const now = new Date();
    const result: Record<string, { text: string; color: string }> = {};
    for (const c of challengeList) {
      if (c.status !== 'active' || !c.deadline) continue;
      const deadline = new Date(c.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      if (diffMs <= 0) {
        result[c.id] = { text: 'Deadline passed', color: 'text-gray-400' };
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours > 48) {
          result[c.id] = { text: `${days} days left`, color: 'text-green-600' };
        } else if (hours >= 24) {
          result[c.id] = { text: `${hours} hours left`, color: 'text-yellow-600' };
        } else {
          result[c.id] = { text: `${hours} hours left`, color: 'text-red-600' };
        }
      }
    }
    setCountdowns(result);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Update countdowns every 60 seconds
  useEffect(() => {
    computeCountdowns(challenges);
    const interval = setInterval(() => computeCountdowns(challenges), 60000);
    return () => clearInterval(interval);
  }, [challenges, computeCountdowns]);

  useEffect(() => {
    if (selectedCohortId && viewMode === 'track') {
      fetchTrackSummary();
    }
  }, [selectedCohortId, viewMode]);

  const fetchData = async () => {
    try {
      const [challengesRes, cohortsRes, analyticsRes] = await Promise.all([
        challengesAPI.list(),
        cohortsAPI.list(),
        challengesAPI.getAnalytics(),
      ]);
      setChallenges(challengesRes.data);
      setAnalytics(analyticsRes.data);
      const cohortsList = cohortsRes.data;
      setCohorts(cohortsList);
      if (cohortsList.length > 0 && !selectedCohortId) {
        setSelectedCohortId(cohortsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackSummary = async () => {
    if (!selectedCohortId) return;
    setLoadingTracks(true);
    try {
      const res = await trackConfigsAPI.getCohortSummary(selectedCohortId);
      setTrackSummary(res.data);
    } catch (error) {
      console.error('Error fetching track summary:', error);
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        cohort_id: formData.cohort_id || null,
        requirements: formData.requirements.filter(r => r.trim()),
        role_type: formData.role_type,
        submission_types: formData.submission_types,
        deadline: formData.deadline,
      };
      payload.auto_evaluate = formData.auto_evaluate;
      if (formData.duration_hours) {
        payload.duration_hours = Number(formData.duration_hours);
      }
      if (formData.sequence_number !== null) {
        payload.sequence_number = formData.sequence_number;
      }
      if (formData.track_config_id) {
        payload.track_config_id = formData.track_config_id;
      }
      if (editingChallenge) {
        await challengesAPI.update(editingChallenge.id, payload);
      } else {
        await challengesAPI.create(payload);
      }
      setCreateOpen(false);
      resetCreateForm();
      await fetchData();
      if (viewMode === 'track') await fetchTrackSummary();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Failed to create challenge.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setFormData({
      title: '',
      description: '',
      requirements: [''],
      role_type: 'all',
      submission_types: ['github'],
      deadline: '',
      cohort_id: '',
      auto_evaluate: false,
      duration_hours: '',
      sequence_number: null,
      track_config_id: '',
    });
    setFormPreFilled(false);
    setEditingChallenge(null);
  };

  const handleStatusChange = async (challengeId: string, newStatus: string) => {
    try {
      await challengesAPI.updateStatus(challengeId, newStatus);
      await fetchData();
      if (viewMode === 'track') await fetchTrackSummary();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setFormData({
      title: challenge.title,
      description: challenge.description,
      requirements: challenge.requirements.length > 0 ? [...challenge.requirements] : [''],
      role_type: challenge.role_type,
      submission_types: [...challenge.submission_types],
      deadline: challenge.deadline ? challenge.deadline.slice(0, 16) : '',
      cohort_id: challenge.cohort_id || '',
      auto_evaluate: challenge.auto_evaluate || false,
      duration_hours: challenge.duration_hours || '',
      sequence_number: challenge.sequence_number ?? null,
      track_config_id: challenge.track_config_id || '',
    });
    setFormPreFilled(!!challenge.track_config_id);
    setCreateOpen(true);
  };

  const handleCopyLink = (shareToken: string, challengeId: string) => {
    const url = `${window.location.origin}/submit/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(challengeId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleViewSubmissions = async (challenge: Challenge | { id: string; title: string }) => {
    setSelectedChallenge(challenge as Challenge);
    setSubmissionsOpen(true);
    setLoadingSubmissions(true);
    try {
      const res = await challengesAPI.getSubmissions(challenge.id);
      setSubmissions(res.data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Evaluation handlers
  const handleEvaluateSubmission = async (submissionId: string) => {
    setEvaluatingId(submissionId);
    try {
      await microshipAPI.evaluateSubmission(submissionId);
      // Refresh submissions to get updated evaluation data
      if (selectedChallenge) {
        const res = await challengesAPI.getSubmissions(selectedChallenge.id);
        setSubmissions(res.data);
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Evaluation failed. Please try again.', 'error');
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleBulkEvaluate = async () => {
    if (!selectedChallenge) return;
    const unevaluated = submissions.filter(s => !s.has_evaluation);
    if (unevaluated.length === 0) return;

    setBulkEvaluating(true);
    setBulkProgress({ done: 0, total: unevaluated.length });

    for (let i = 0; i < unevaluated.length; i++) {
      try {
        await microshipAPI.evaluateSubmission(unevaluated[i].id);
        setBulkProgress({ done: i + 1, total: unevaluated.length });
      } catch (error) {
        console.error(`Failed to evaluate submission ${unevaluated[i].id}:`, error);
        setBulkProgress({ done: i + 1, total: unevaluated.length });
      }
    }

    // Refresh all submissions
    try {
      const res = await challengesAPI.getSubmissions(selectedChallenge.id);
      setSubmissions(res.data);
    } catch (error) {
      console.error('Error refreshing submissions:', error);
    }

    setBulkEvaluating(false);
    setBulkProgress(null);
  };

  // CSV export for submissions
  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    const headers = ['Name', 'Email', 'Submission URL', 'Type', 'Submitted At', 'On Time', 'Score', 'Outcome'];
    const rows = submissions.map(sub => [
      sub.applicant_name,
      sub.applicant_email,
      sub.submission_url || '',
      sub.submission_type || '',
      sub.submitted_at ? new Date(sub.submitted_at).toISOString() : '',
      sub.on_time ? 'Yes' : 'No',
      sub.evaluation?.weighted_score != null ? sub.evaluation.weighted_score.toFixed(2) : '',
      sub.evaluation?.outcome || 'Pending',
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${selectedChallenge?.title?.replace(/\s+/g, '-').toLowerCase() || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, ''],
    }));
  };

  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index),
    }));
  };

  const updateRequirement = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.map((r, i) => (i === index ? value : r)),
    }));
  };

  const toggleSubmissionType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      submission_types: prev.submission_types.includes(type)
        ? prev.submission_types.filter(t => t !== type)
        : [...prev.submission_types, type],
    }));
  };

  // Open create modal from a track slot
  const openCreateFromSlot = (track: TrackSummary, sequenceNum: number) => {
    setFormData({
      title: '',
      description: '',
      requirements: [''],
      role_type: track.role_type,
      submission_types: ['github'],
      deadline: '',
      cohort_id: track.cohort_id,
      auto_evaluate: false,
      duration_hours: '',
      sequence_number: sequenceNum,
      track_config_id: track.id,
    });
    setFormPreFilled(true);
    setCreateOpen(true);
  };

  // AI Assist
  const handleAIAssist = async () => {
    if (formData.role_type === 'all') {
      toast('Please select a specific role before using AI Assist.', 'warning');
      return;
    }
    setGenerating(true);
    try {
      // Find the track to get total_in_track
      let totalInTrack: number | null = null;
      if (formPreFilled) {
        const track = trackSummary.find(t => t.id === formData.track_config_id);
        if (track) totalInTrack = track.total_challenges;
      }

      const res = await challengesAPI.generateContent({
        role_type: formData.role_type,
        duration_hours: formData.duration_hours ? Number(formData.duration_hours) : null,
        sequence_number: formData.sequence_number,
        total_in_track: totalInTrack,
        track_config_id: formData.track_config_id || null,
        existing_title: formData.title || undefined,
        existing_description: formData.description || undefined,
      });

      const { title, description, requirements } = res.data;
      setFormData(prev => ({
        ...prev,
        title: title || prev.title,
        description: description || prev.description,
        requirements: requirements && requirements.length > 0 ? requirements : prev.requirements,
      }));
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'AI generation failed. Please try again or fill in manually.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Configure Tracks
  const openConfigureTracks = async () => {
    if (!selectedCohortId) return;
    try {
      const res = await trackConfigsAPI.list(selectedCohortId);
      const configs: TrackConfig[] = res.data;
      setTrackConfigs(configs);

      // Build form data: role_type -> total_challenges
      const data: Record<string, number> = {};
      for (const cfg of configs) {
        data[cfg.role_type] = cfg.total_challenges;
      }
      setConfigFormData(data);
      setConfigureOpen(true);
    } catch (error) {
      console.error('Error loading track configs:', error);
    }
  };

  const handleSaveTrackConfigs = async () => {
    if (!selectedCohortId) return;
    setSavingConfig(true);
    try {
      // For each role type in the form
      for (const role of ROLE_TYPES) {
        const value = configFormData[role];
        const existing = trackConfigs.find(tc => tc.role_type === role);

        if (value && value > 0) {
          if (existing) {
            // Update
            if (existing.total_challenges !== value) {
              await trackConfigsAPI.update(existing.id, { total_challenges: value });
            }
          } else {
            // Create
            await trackConfigsAPI.create({
              cohort_id: selectedCohortId,
              role_type: role,
              total_challenges: value,
            });
          }
        } else if (!value || value === 0) {
          if (existing && existing.challenges_created === 0) {
            await trackConfigsAPI.delete(existing.id);
          }
        }
      }

      setConfigureOpen(false);
      await fetchTrackSummary();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast(detail || 'Failed to save track configuration.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Filter challenges
  const filtered = challenges.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  // Stats
  const stats = {
    total: challenges.length,
    active: challenges.filter(c => c.status === 'active').length,
    draft: challenges.filter(c => c.status === 'draft').length,
    closed: challenges.filter(c => c.status === 'closed').length,
  };

  const isDeadlinePast = (deadline: string) => new Date(deadline) < new Date();

  return (
    <AppLayout>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Challenges</h1>
              <p className="mt-2 text-gray-600">
                Create and manage Microship challenges. Share links with applicants.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={openConfigureTracks}>
                <Settings className="mr-2 h-4 w-4" />
                Configure Tracks
              </Button>
              <Button variant="primary" onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Challenge
              </Button>
            </div>
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
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="mt-2 text-2xl font-bold text-gray-500">{stats.draft}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Closed</p>
                <p className="mt-2 text-2xl font-bold text-yellow-600">{stats.closed}</p>
              </div>
            </Card>
          </div>

          {/* Submission Analytics */}
          {analytics && analytics.total_submissions > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Card>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Submissions</p>
                  <p className="mt-2 text-2xl font-bold text-blue-600">{analytics.total_submissions}</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Evaluated</p>
                  <p className="mt-2 text-2xl font-bold text-purple-600">
                    {analytics.total_evaluated}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      / {analytics.total_submissions}
                    </span>
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Avg Score</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {analytics.average_score.toFixed(2)}
                    <span className="text-sm font-normal text-gray-400">/4.0</span>
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                  <p className="mt-2 text-2xl font-bold text-green-600">{analytics.pass_rate}%</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">On Time</p>
                  <p className="mt-2 text-2xl font-bold text-teal-600">{analytics.on_time_rate}%</p>
                </div>
              </Card>
            </div>
          )}

          {/* Submission Timeline */}
          {analytics && analytics.submissions_by_day && analytics.submissions_by_day.some(d => d.count > 0) && (
            <Card>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Submission Activity (Last 14 Days)</h3>
                <div className="flex items-end gap-1" style={{ height: '80px' }}>
                  {(() => {
                    const maxCount = Math.max(...analytics.submissions_by_day.map(d => d.count), 1);
                    return analytics.submissions_by_day.map((day) => (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        {day.count > 0 && (
                          <span className="text-xs text-gray-500">{day.count}</span>
                        )}
                        <div
                          className={`w-full rounded-t ${day.count > 0 ? 'bg-green-500' : 'bg-gray-100'}`}
                          style={{ height: `${Math.max((day.count / maxCount) * 60, day.count > 0 ? 4 : 2)}px` }}
                          title={`${day.date}: ${day.count} submission${day.count !== 1 ? 's' : ''}`}
                        />
                        <span className="text-[10px] text-gray-400 rotate-[-45deg] origin-top-left whitespace-nowrap">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </Card>
          )}

          {/* Controls: Cohort selector + View toggle + Filter tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Cohort selector */}
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode('track')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'track'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  By Track
                </button>
              </div>
            </div>

            {/* Filter Tabs (only in list view) */}
            {viewMode === 'list' && (
              <div className="flex space-x-2">
                {(['all', 'active', 'draft', 'closed', 'archived'] as const).map(f => (
                  <Button
                    key={f}
                    variant={filter === f ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'all' ? ` (${stats.total})` : ''}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* By Track View */}
          {viewMode === 'track' && (
            <div className="space-y-6">
              {loadingTracks ? (
                <div className="py-12 text-center text-gray-500">Loading tracks...</div>
              ) : trackSummary.length === 0 ? (
                <Card>
                  <div className="py-12 text-center">
                    <Layers className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tracks configured</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Click &quot;Configure Tracks&quot; to set up challenge tracks for this cohort.
                    </p>
                    <Button
                      variant="primary"
                      className="mt-4"
                      onClick={openConfigureTracks}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Tracks
                    </Button>
                  </div>
                </Card>
              ) : (
                trackSummary.map(track => {
                  const progress = track.total_challenges > 0
                    ? Math.round((track.challenges_created / track.total_challenges) * 100)
                    : 0;

                  // Build slot array
                  const slots: Array<typeof track.challenges[number] | null> = [];
                  for (let i = 1; i <= track.total_challenges; i++) {
                    const challenge = track.challenges.find(c => c.sequence_number === i);
                    slots.push(challenge || null);
                  }

                  return (
                    <Card key={track.id}>
                      <div className="space-y-4">
                        {/* Track header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {ROLE_LABELS[track.role_type] || track.role_type} Track
                            </h3>
                            <span className="text-sm text-gray-500">
                              ({track.challenges_created} of {track.total_challenges})
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-600">{progress}%</span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        {/* Slots */}
                        <div className="space-y-2">
                          {slots.map((challenge, idx) => {
                            const seqNum = idx + 1;
                            if (challenge) {
                              return (
                                <div
                                  key={challenge.id}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="flex-shrink-0 text-sm font-mono font-medium text-gray-400">
                                      #{seqNum}
                                    </span>
                                    <span className="font-medium text-gray-900 truncate">
                                      {challenge.title}
                                    </span>
                                    <Badge variant={getStatusBadgeVariant(challenge.status)}>
                                      {challenge.status}
                                    </Badge>
                                    {challenge.duration_hours && (
                                      <span className="text-sm text-gray-500">
                                        {challenge.duration_hours}h
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleCopyLink(challenge.share_token, challenge.id)}
                                    >
                                      {copiedId === challenge.id ? (
                                        <><Check className="mr-1 h-3 w-3 text-green-600" />Copied</>
                                      ) : (
                                        <><Copy className="mr-1 h-3 w-3" />Copy Link</>
                                      )}
                                    </Button>
                                    {(() => {
                                      const fullChallenge = challenges.find(c => c.id === challenge.id);
                                      return fullChallenge ? (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleEdit(fullChallenge)}
                                        >
                                          <Pencil className="mr-1 h-3 w-3" />
                                          Edit
                                        </Button>
                                      ) : null;
                                    })()}
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleViewSubmissions(challenge)}
                                    >
                                      <Eye className="mr-1 h-3 w-3" />
                                      Submissions
                                    </Button>
                                    {challenge.status === 'draft' && (
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleStatusChange(challenge.id, 'active')}
                                      >
                                        <Play className="mr-1 h-3 w-3" />
                                        Activate
                                      </Button>
                                    )}
                                    {challenge.status === 'active' && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleStatusChange(challenge.id, 'closed')}
                                      >
                                        <Pause className="mr-1 h-3 w-3" />
                                        Close
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={`empty-${track.id}-${seqNum}`}
                                className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-mono font-medium text-gray-400">
                                    #{seqNum}
                                  </span>
                                  <span className="text-sm text-gray-400 italic">(Empty slot)</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openCreateFromSlot(track, seqNum)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Create
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <>
              {filtered.length === 0 ? (
                <Card>
                  <div className="py-12 text-center">
                    <Flag className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No challenges</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Create a new challenge to get started.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filtered.map(challenge => (
                    <Card key={challenge.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {challenge.sequence_number && challenge.total_in_track
                                ? `#${challenge.sequence_number} `
                                : ''
                              }
                              {challenge.title}
                            </h3>
                            <Badge variant={getStatusBadgeVariant(challenge.status)}>
                              {challenge.status}
                            </Badge>
                            <Badge variant="info">
                              {ROLE_LABELS[challenge.role_type] || challenge.role_type}
                            </Badge>
                            {challenge.sequence_number && challenge.total_in_track && (
                              <Badge variant="secondary">
                                {challenge.sequence_number} of {challenge.total_in_track}
                              </Badge>
                            )}
                            {challenge.duration_hours && (
                              <Badge variant="secondary">
                                {challenge.duration_hours}h
                              </Badge>
                            )}
                            {challenge.auto_evaluate && (
                              <Badge variant="info">
                                <Zap className="mr-1 h-3 w-3 inline" />
                                Auto-Eval
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {challenge.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Deadline:{' '}
                              <span className={isDeadlinePast(challenge.deadline) ? 'text-red-600 font-medium' : ''}>
                                {new Date(challenge.deadline).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                            {countdowns[challenge.id] && (
                              <span className={`font-medium ${countdowns[challenge.id].color}`}>
                                {countdowns[challenge.id].text}
                              </span>
                            )}
                            {challenge.submission_types.length > 0 && (
                              <span>
                                Types: {challenge.submission_types.join(', ')}
                              </span>
                            )}
                          </div>
                          {/* Per-challenge stats */}
                          {analytics && (() => {
                            const cs = analytics.per_challenge.find(p => p.challenge_id === challenge.id);
                            if (!cs || cs.submission_count === 0) return null;
                            return (
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <span>{cs.submission_count} submission{cs.submission_count !== 1 ? 's' : ''}</span>
                                <span>{cs.evaluated_count} evaluated</span>
                                {cs.evaluated_count > 0 && (
                                  <>
                                    <span>Avg: {cs.average_score.toFixed(2)}/4.0</span>
                                    <span className="text-green-600">{cs.pass_rate}% pass</span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyLink(challenge.share_token, challenge.id)}
                        >
                          {copiedId === challenge.id ? (
                            <>
                              <Check className="mr-1 h-4 w-4 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-4 w-4" />
                              Copy Link
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEdit(challenge)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleViewSubmissions(challenge)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Submissions
                        </Button>

                        {challenge.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleStatusChange(challenge.id, 'active')}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Activate
                          </Button>
                        )}

                        {challenge.status === 'active' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleStatusChange(challenge.id, 'closed')}
                          >
                            <Pause className="mr-1 h-4 w-4" />
                            Close
                          </Button>
                        )}

                        {(challenge.status === 'closed' || challenge.status === 'draft') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleStatusChange(challenge.id, 'archived')}
                          >
                            <Archive className="mr-1 h-4 w-4" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Create Challenge Modal */}
          <Modal
            open={createOpen}
            onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}
            title={editingChallenge ? "Edit Challenge" : "Create New Challenge"}
            size="lg"
          >
            <form onSubmit={handleCreate} className="space-y-5">
              {/* Pre-fill banner */}
              {formPreFilled && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  Creating challenge for <strong>{ROLE_LABELS[formData.role_type] || formData.role_type}</strong> track,
                  slot #{formData.sequence_number}. Cohort, role, and sequence are pre-filled.
                </div>
              )}

              {/* AI Assist */}
              <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-purple-700">
                    Let AI generate title, description, and requirements
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAIAssist}
                  disabled={generating || formData.role_type === 'all'}
                >
                  {generating ? (
                    <>
                      <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-r-transparent" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" />
                      AI Assist
                    </>
                  )}
                </Button>
              </div>
              {formData.role_type === 'all' && (
                <p className="text-xs text-gray-500 -mt-3">
                  Select a specific role below to enable AI Assist.
                </p>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="e.g. Backend API Challenge"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Describe the challenge in detail..."
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requirements
                </label>
                <div className="space-y-2">
                  {formData.requirements.map((req, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={req}
                        onChange={e => updateRequirement(index, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder={`Requirement ${index + 1}`}
                      />
                      {formData.requirements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="text-red-400 hover:text-red-600 px-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addRequirement}
                  className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  + Add Requirement
                </button>
              </div>

              {/* Role Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Role
                </label>
                <select
                  value={formData.role_type}
                  onChange={e => setFormData(prev => ({ ...prev, role_type: e.target.value }))}
                  disabled={formPreFilled || !!editingChallenge}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="all">All Roles</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="product_designer">Product Designer</option>
                  <option value="frontend">Frontend Developer</option>
                  <option value="backend">Backend Developer</option>
                  <option value="qa">QA Engineer</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  value={formData.duration_hours}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    duration_hours: e.target.value === '' ? '' : Number(e.target.value),
                  }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">No duration set</option>
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Auto-Evaluate */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <input
                  type="checkbox"
                  id="auto_evaluate"
                  checked={formData.auto_evaluate}
                  onChange={e => setFormData(prev => ({ ...prev, auto_evaluate: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <label htmlFor="auto_evaluate" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Auto-Evaluate Submissions
                  </label>
                  <p className="text-xs text-gray-500">
                    Automatically run AI evaluation when applicants submit their work.
                  </p>
                </div>
              </div>

              {/* Submission Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Accepted Submission Types
                </label>
                <div className="flex gap-3">
                  {['github', 'figma', 'document', 'other'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.submission_types.includes(type)}
                        onChange={() => toggleSubmissionType(type)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.deadline}
                  onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Cohort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cohort
                </label>
                <select
                  value={formData.cohort_id}
                  onChange={e => setFormData(prev => ({ ...prev, cohort_id: e.target.value }))}
                  disabled={formPreFilled || !!editingChallenge}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Select a cohort (required for submissions)</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sequence info (read-only when pre-filled) */}
              {formPreFilled && formData.sequence_number !== null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sequence Number
                  </label>
                  <input
                    type="text"
                    value={`#${formData.sequence_number}`}
                    disabled
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-500"
                  />
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setCreateOpen(false); resetCreateForm(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating
                    ? (editingChallenge ? 'Saving...' : 'Creating...')
                    : (editingChallenge ? 'Save Changes' : 'Create Challenge')
                  }
                </Button>
              </div>
            </form>
          </Modal>

          {/* Configure Tracks Modal */}
          <Modal
            open={configureOpen}
            onOpenChange={setConfigureOpen}
            title="Configure Challenge Tracks"
            size="lg"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Set the number of challenges for each role track in this cohort.
              </p>
              <div className="space-y-3">
                {ROLE_TYPES.map(role => {
                  const existing = trackConfigs.find(tc => tc.role_type === role);
                  return (
                    <div key={role} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {ROLE_LABELS[role]}
                        </span>
                        {existing && existing.challenges_created > 0 && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({existing.challenges_created} challenge{existing.challenges_created !== 1 ? 's' : ''} created)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min={existing ? existing.challenges_created : 0}
                        max={20}
                        value={configFormData[role] || ''}
                        onChange={e => setConfigFormData(prev => ({
                          ...prev,
                          [role]: e.target.value ? parseInt(e.target.value) : 0,
                        }))}
                        placeholder="0"
                        className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setConfigureOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveTrackConfigs} disabled={savingConfig}>
                  {savingConfig ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </Modal>

          {/* Submissions Modal */}
          <Modal
            open={submissionsOpen}
            onOpenChange={setSubmissionsOpen}
            title={selectedChallenge ? `Submissions - ${selectedChallenge.title}` : 'Submissions'}
            size="lg"
          >
            {loadingSubmissions ? (
              <div className="py-8 text-center text-gray-500">Loading submissions...</div>
            ) : submissions.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No submissions yet.</p>
                {selectedChallenge && (
                  <p className="mt-1 text-sm text-gray-400">
                    Share the challenge link to start receiving submissions.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Export CSV */}
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={handleExportCSV}>
                    <Download className="mr-1 h-3 w-3" />
                    Export CSV
                  </Button>
                </div>

                {/* Bulk evaluate bar */}
                {(() => {
                  const unevaluatedCount = submissions.filter(s => !s.has_evaluation).length;
                  if (unevaluatedCount === 0) return null;
                  return (
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{unevaluatedCount} submission{unevaluatedCount !== 1 ? 's' : ''} pending evaluation</span>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleBulkEvaluate}
                        disabled={bulkEvaluating}
                      >
                        {bulkEvaluating && bulkProgress ? (
                          <>
                            <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                            {bulkProgress.done}/{bulkProgress.total}
                          </>
                        ) : (
                          <>
                            <Zap className="mr-1 h-3 w-3" />
                            Evaluate All
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })()}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>On Time</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map(sub => {
                      const outcome = sub.evaluation?.outcome;
                      const outcomeConfig = outcome ? OUTCOME_CONFIG[outcome] : null;
                      const isEvaluating = evaluatingId === sub.id;

                      return (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sub.applicant_name}</div>
                              <div className="text-xs text-gray-500">{sub.applicant_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {sub.submission_type || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {sub.submitted_at
                              ? new Date(sub.submitted_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {sub.on_time ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell>
                            {outcomeConfig ? (
                              <Badge variant={outcomeConfig.variant}>
                                {outcomeConfig.label}
                              </Badge>
                            ) : (
                              <span className="text-sm text-gray-400">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.evaluation?.weighted_score != null ? (
                              <span className="font-mono text-sm font-medium">
                                {sub.evaluation.weighted_score.toFixed(2)}/4.0
                              </span>
                            ) : (
                              <span className="text-gray-400">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {sub.submission_url && (
                                <a
                                  href={sub.submission_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                                  title="Open submission"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {!sub.has_evaluation ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleEvaluateSubmission(sub.id)}
                                  disabled={isEvaluating || bulkEvaluating}
                                >
                                  {isEvaluating ? (
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                                  ) : (
                                    <>
                                      <Zap className="mr-1 h-3 w-3" />
                                      Evaluate
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setSelectedEvaluation(sub)}
                                  >
                                    <BarChart3 className="mr-1 h-3 w-3" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleEvaluateSubmission(sub.id)}
                                    disabled={isEvaluating || bulkEvaluating}
                                    title="Re-evaluate"
                                  >
                                    {isEvaluating ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-r-transparent" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Modal>

          {/* Evaluation Detail Modal */}
          <Modal
            open={!!selectedEvaluation}
            onOpenChange={(open) => { if (!open) setSelectedEvaluation(null); }}
            title="Evaluation Details"
            size="lg"
          >
            {selectedEvaluation?.evaluation && (() => {
              const eval_ = selectedEvaluation.evaluation;
              const outcomeConfig = OUTCOME_CONFIG[eval_.outcome] || { label: eval_.outcome, variant: 'info' as const, icon: AlertTriangle };
              const OutcomeIcon = outcomeConfig.icon;

              return (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedEvaluation.applicant_name}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedEvaluation.applicant_email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={outcomeConfig.variant} className="text-sm px-3 py-1">
                        <OutcomeIcon className="mr-1 h-4 w-4 inline" />
                        {outcomeConfig.label}
                      </Badge>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {eval_.weighted_score.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">out of 4.0</div>
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Score Breakdown</h4>
                    <div className="space-y-3">
                      {Object.entries(eval_.scores).map(([key, score]) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">{SCORE_LABELS[key] || key}</span>
                            <span className="text-sm font-mono font-medium">{score}/4</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                score >= 3 ? 'bg-green-500' : score >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(score / 4) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Concerns */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-green-700 mb-2">Strengths</h4>
                      {eval_.strengths.length > 0 ? (
                        <ul className="space-y-1">
                          {eval_.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">None noted</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2">Concerns</h4>
                      {eval_.concerns.length > 0 ? (
                        <ul className="space-y-1">
                          {eval_.concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">None noted</p>
                      )}
                    </div>
                  </div>

                  {/* Disqualifiers */}
                  {eval_.disqualifiers && eval_.disqualifiers.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <h4 className="text-sm font-medium text-red-800 mb-1">Disqualifiers</h4>
                      <ul className="space-y-1">
                        {eval_.disqualifiers.map((d, i) => (
                          <li key={i} className="text-sm text-red-700">{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evidence */}
                  {eval_.evidence && Object.keys(eval_.evidence).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Evidence</h4>
                      <div className="space-y-2">
                        {Object.entries(eval_.evidence).map(([key, text]) => (
                          <div key={key} className="rounded-lg border border-gray-200 px-3 py-2">
                            <span className="text-xs font-medium text-gray-500 uppercase">{key}</span>
                            <p className="text-sm text-gray-700 mt-0.5">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence & Reasoning */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Confidence:</span>
                      <span className="text-sm font-mono">
                        {Math.round(eval_.confidence * 100)}%
                      </span>
                    </div>
                    {eval_.reasoning && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Reasoning</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
                          {eval_.reasoning}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Close */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="secondary" onClick={() => setSelectedEvaluation(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        </div>
      )}
    </AppLayout>
  );
}
