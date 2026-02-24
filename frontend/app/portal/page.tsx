'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/Toast';
import { fellowsAPI, sprintsAPI, meetingsAPI, attendanceAPI, checkInsAPI, cohortsAPI, teamsAPI, peerFeedbackAPI, certificatesAPI } from '@/lib/api';
import {
  Home,
  Target,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Video,
  Activity,
  Send,
  Shield,
  TrendingUp,
  FileText,
  Github,
  Link2,
  ExternalLink,
  Zap,
  Award,
  MessageSquare,
  Star,
  Download,
} from 'lucide-react';
import type { Fellow, Sprint, SprintObjective, Meeting, Attendance, CheckIn, Cohort, Team } from '@/types';

// Evidence type icons
const EVIDENCE_ICONS: Record<string, React.ElementType> = {
  github: Github,
  document: FileText,
  deployment: ExternalLink,
  video: Video,
  figma: Link2,
};

export default function PortalPage() {
  const { toast } = useToast();
  const [fellow, setFellow] = useState<Fellow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Context data
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  // Sprint data
  const [allSprints, setAllSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [objectives, setObjectives] = useState<SprintObjective[]>([]);

  // Meetings
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [joiningMeeting, setJoiningMeeting] = useState<string | null>(null);

  // Attendance
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Check-ins
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    accomplishments: '',
    next_focus: '',
    blockers: '',
    needs_help: '',
    self_assessment: 'on_track',
    collaboration_rating: 8,
    energy_level: 7,
  });

  // Peer feedback
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [receivedFeedback, setReceivedFeedback] = useState<any[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<any>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    receiver_id: '',
    strengths: '',
    areas_to_improve: '',
    collaboration_rating: 8,
    communication_rating: 8,
    technical_rating: 8,
    overall_rating: 8,
    anonymous: true,
  });

  // Certificate
  const [downloadingCert, setDownloadingCert] = useState(false);

  useEffect(() => {
    fetchFellowProfile();
  }, []);

  const fetchFellowProfile = async () => {
    try {
      const res = await fellowsAPI.getMe();
      const fellowData = res.data;
      setFellow(fellowData);

      const promises: Promise<any>[] = [];

      // Fetch cohort context
      if (fellowData.cohort_id) {
        promises.push(
          cohortsAPI.get(fellowData.cohort_id).then(r => setCohort(r.data)).catch(() => {})
        );
      }

      if (fellowData.team_id) {
        // Fetch team info
        promises.push(
          teamsAPI.get(fellowData.team_id).then(r => setTeam(r.data)).catch(() => {})
        );
        // Fetch all sprints for delivery rate + find active
        promises.push(
          sprintsAPI.list(fellowData.team_id).then(r => {
            const sprints = r.data as Sprint[];
            setAllSprints(sprints);
            const active = sprints.find(s => s.status === 'active') || sprints[0];
            setActiveSprint(active || null);
            if (active) {
              return sprintsAPI.getObjectives(active.id).then(or => setObjectives(or.data));
            }
          }).catch(() => {})
        );
        promises.push(
          meetingsAPI.upcoming(fellowData.team_id, 7).then(r => setUpcomingMeetings(r.data)).catch(() => {})
        );
      }

      promises.push(
        attendanceAPI.getFellowHistory(fellowData.id).then(r => setAttendance(r.data)).catch(() => {}),
        checkInsAPI.getFellowCheckIns(fellowData.id).then(r => setCheckIns(r.data)).catch(() => {}),
        peerFeedbackAPI.received(fellowData.id).then(r => setReceivedFeedback(r.data)).catch(() => {}),
        peerFeedbackAPI.summary(fellowData.id).then(r => setFeedbackSummary(r.data)).catch(() => {}),
      );

      await Promise.all(promises);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load your portal. Your account may not be linked to a fellow profile.');
    } finally {
      setLoading(false);
    }
  };

  // --- Computed Metrics ---

  const currentWeek = useMemo(() => {
    if (!fellow) return 1;
    return checkIns.length > 0 ? Math.max(...checkIns.map(c => c.week)) + 1 : 1;
  }, [fellow, checkIns]);

  const hasCheckedInThisWeek = useMemo(() => {
    return checkIns.some(c => c.week === currentWeek);
  }, [checkIns, currentWeek]);

  const programWeeks = useMemo(() => {
    if (!cohort) return { current: currentWeek, total: 12 };
    const start = new Date(cohort.start_date);
    const end = new Date(cohort.end_date);
    const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
    const elapsed = Math.ceil((Date.now() - start.getTime()) / (7 * 86400000));
    return { current: Math.max(1, Math.min(elapsed, total)), total };
  }, [cohort, currentWeek]);

  const attendanceScore = useMemo(() => {
    if (attendance.length === 0) return null;
    const scoreMap: Record<string, number> = { present: 1.0, late: 0.8, very_late: 0.5, absent: 0.0, approved_absence: 0.7 };
    const total = attendance.reduce((sum, a) => sum + (scoreMap[a.status] ?? 0.5), 0);
    return total / attendance.length;
  }, [attendance]);

  const attendanceDetail = useMemo(() => {
    const onTime = attendance.filter(a => a.status === 'present').length;
    return { onTime, total: attendance.length };
  }, [attendance]);

  const deliveryRate = useMemo(() => {
    if (!allSprints.length) return null;
    const completed = allSprints.reduce((s, sp) => s + (sp.completed_objectives || 0), 0);
    const total = allSprints.reduce((s, sp) => s + (sp.objective_count || 0), 0);
    return total > 0 ? { completed, total, pct: Math.round((completed / total) * 100) } : null;
  }, [allSprints]);

  const checkInCompletion = useMemo(() => {
    const expected = Math.max(1, programWeeks.current - 1);
    const submitted = checkIns.length;
    return {
      submitted,
      expected: Math.max(expected, submitted),
      pct: expected > 0 ? Math.round((submitted / expected) * 100) : 100,
    };
  }, [checkIns, programWeeks]);

  const sprintDaysRemaining = useMemo(() => {
    if (!activeSprint) return null;
    const end = new Date(activeSprint.end_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
    return Math.max(0, diff);
  }, [activeSprint]);

  const teamProgress = useMemo(() => {
    if (!activeSprint) return null;
    const done = activeSprint.completed_objectives || 0;
    const total = activeSprint.objective_count || objectives.length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [activeSprint, objectives]);

  const overallStatus = useMemo(() => {
    const scores: number[] = [];
    if (attendanceScore !== null) scores.push(attendanceScore * 100);
    if (deliveryRate) scores.push(deliveryRate.pct);
    if (checkInCompletion) scores.push(checkInCompletion.pct);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;
    if (avg >= 70) return { label: 'On Track', color: 'text-green-600', bg: 'bg-green-100', ring: 'ring-green-200' };
    if (avg >= 50) return { label: 'Monitor', color: 'text-yellow-600', bg: 'bg-yellow-100', ring: 'ring-yellow-200' };
    return { label: 'At Risk', color: 'text-red-600', bg: 'bg-red-100', ring: 'ring-red-200' };
  }, [attendanceScore, deliveryRate, checkInCompletion]);

  // Objectives assigned to this fellow that are done but missing evidence
  const pendingEvidence = useMemo(() => {
    if (!fellow) return [];
    return objectives.filter(
      obj => obj.owner_fellow_id === fellow.id && obj.status === 'done' && !obj.evidence_url
    );
  }, [objectives, fellow]);

  const hasActions = !hasCheckedInThisWeek || pendingEvidence.length > 0;

  // --- Handlers ---

  const handleJoinMeeting = async (meetingId: string) => {
    if (!fellow) return;
    setJoiningMeeting(meetingId);
    try {
      const res = await meetingsAPI.join(meetingId, fellow.id);
      if (res.data.meeting_link) {
        window.open(res.data.meeting_link, '_blank');
      }
      const attRes = await attendanceAPI.getFellowHistory(fellow.id);
      setAttendance(attRes.data);
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Could not join meeting.', 'error');
    } finally {
      setJoiningMeeting(null);
    }
  };

  const handleSubmitCheckIn = async () => {
    if (!fellow) return;
    setSubmittingCheckIn(true);
    try {
      await checkInsAPI.create({
        fellow_id: fellow.id,
        week: currentWeek,
        ...checkInForm,
      });
      setCheckInModalOpen(false);
      setCheckInForm({
        accomplishments: '',
        next_focus: '',
        blockers: '',
        needs_help: '',
        self_assessment: 'on_track',
        collaboration_rating: 8,
        energy_level: 7,
      });
      const res = await checkInsAPI.getFellowCheckIns(fellow.id);
      setCheckIns(res.data);
      toast('Check-in submitted successfully.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to submit check-in.', 'error');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!fellow) return;
    setSubmittingFeedback(true);
    try {
      await peerFeedbackAPI.submit({
        giver_id: fellow.id,
        receiver_id: feedbackForm.receiver_id,
        sprint_id: activeSprint?.id,
        strengths: feedbackForm.strengths,
        areas_to_improve: feedbackForm.areas_to_improve,
        collaboration_rating: feedbackForm.collaboration_rating,
        communication_rating: feedbackForm.communication_rating,
        technical_rating: feedbackForm.technical_rating,
        overall_rating: feedbackForm.overall_rating,
        anonymous: feedbackForm.anonymous,
      });
      setFeedbackModalOpen(false);
      setFeedbackForm({
        receiver_id: '', strengths: '', areas_to_improve: '',
        collaboration_rating: 8, communication_rating: 8,
        technical_rating: 8, overall_rating: 8, anonymous: true,
      });
      toast('Peer feedback submitted.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to submit feedback.', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!fellow) return;
    setDownloadingCert(true);
    try {
      const res = await certificatesAPI.download(fellow.id);
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${fellow.name || 'fellow'}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Certificate downloaded.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Certificate not available yet.', 'error');
    } finally {
      setDownloadingCert(false);
    }
  };

  const getBarColor = (pct: number) => {
    if (pct >= 70) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // --- Render ---

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading your portal...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !fellow) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Portal Unavailable</h2>
              <p className="text-sm text-gray-600">{error || 'No fellow profile found.'}</p>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Context */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {fellow.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="capitalize">{fellow.role.replace('_', ' ')} Fellow</span>
              {team && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{team.name}</span>
                </>
              )}
              <span className="text-gray-300">·</span>
              <span>Week {programWeeks.current} of {programWeeks.total}</span>
              {activeSprint && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>Sprint {activeSprint.sprint_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {!hasCheckedInThisWeek && (
              <Button variant="primary" onClick={() => setCheckInModalOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                Submit Week {currentWeek} Check-in
              </Button>
            )}
          </div>
        </div>

        {/* Performance Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Performance</CardTitle>
              <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${overallStatus.bg} ${overallStatus.color} ring-1 ${overallStatus.ring}`}>
                <div className={`h-2 w-2 rounded-full ${overallStatus.color === 'text-green-600' ? 'bg-green-500' : overallStatus.color === 'text-yellow-600' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                {overallStatus.label}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Attendance */}
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 flex-shrink-0">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Attendance Score</span>
                    <span className="text-sm font-bold text-gray-900">
                      {attendanceScore !== null ? `${(attendanceScore * 100).toFixed(0)}%` : '-'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${attendanceScore !== null ? getBarColor(attendanceScore * 100) : 'bg-gray-300'}`}
                      style={{ width: `${attendanceScore !== null ? Math.min(attendanceScore * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {attendanceDetail.onTime}/{attendanceDetail.total} meetings on time
                  </p>
                </div>
              </div>

              {/* Sprint Delivery */}
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Sprint Delivery</span>
                    <span className="text-sm font-bold text-gray-900">
                      {deliveryRate ? `${deliveryRate.pct}%` : '-'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${deliveryRate ? getBarColor(deliveryRate.pct) : 'bg-gray-300'}`}
                      style={{ width: `${deliveryRate ? Math.min(deliveryRate.pct, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {deliveryRate ? `${deliveryRate.completed}/${deliveryRate.total} objectives completed` : 'No objectives yet'}
                  </p>
                </div>
              </div>

              {/* Check-ins */}
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Check-ins</span>
                    <span className="text-sm font-bold text-gray-900">
                      {checkInCompletion.submitted}/{checkInCompletion.expected}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getBarColor(checkInCompletion.pct)}`}
                      style={{ width: `${Math.min(checkInCompletion.pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {checkInCompletion.pct >= 100 ? 'All submitted on time' : `${checkInCompletion.expected - checkInCompletion.submitted} check-in(s) behind`}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Required */}
        {hasActions && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Zap className="h-5 w-5" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!hasCheckedInThisWeek && (
                  <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <Send className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Week {currentWeek} Check-in due</p>
                        <p className="text-xs text-gray-500">Submit your weekly check-in</p>
                      </div>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => setCheckInModalOpen(true)}>
                      Start Check-in
                    </Button>
                  </div>
                )}
                {pendingEvidence.map(obj => (
                  <div key={obj.id} className="flex items-center justify-between rounded-lg border border-yellow-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Submit evidence</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{obj.description}</p>
                      </div>
                    </div>
                    <Badge variant="warning">Evidence needed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        <Card>
          <CardHeader>
            <CardTitle>Milestone Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Milestone 1', value: fellow.milestone_1_score, pct: true },
                { label: 'Milestone 2', value: fellow.milestone_2_score, pct: true },
                { label: 'Milestone 3', value: fellow.milestone_3_score, pct: true },
                { label: 'Final Score', value: fellow.final_score, pct: false },
              ].map(({ label, value, pct }) => (
                <div key={label} className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${value != null ? (pct ? (value >= 70 ? 'text-green-600' : 'text-yellow-600') : (value >= 2.5 ? 'text-green-600' : 'text-red-600')) : 'text-gray-300'}`}>
                    {value != null ? (pct ? `${value}%` : value.toFixed(1)) : '-'}
                  </p>
                  {value != null && pct && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(value, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Current Sprint */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {activeSprint ? `Sprint ${activeSprint.sprint_number}` : 'Current Sprint'}
                </CardTitle>
                {sprintDaysRemaining !== null && (
                  <Badge variant={sprintDaysRemaining > 5 ? 'success' : sprintDaysRemaining > 1 ? 'warning' : 'danger'}>
                    {sprintDaysRemaining === 0 ? 'Ends today' : `${sprintDaysRemaining} day${sprintDaysRemaining !== 1 ? 's' : ''} left`}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeSprint ? (
                <div className="space-y-4">
                  {activeSprint.goal && (
                    <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                      <p className="text-sm font-medium text-blue-900">Sprint Goal</p>
                      <p className="text-sm text-blue-700 mt-1">{activeSprint.goal}</p>
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <span>{new Date(activeSprint.start_date).toLocaleDateString()}</span>
                    <span className="mx-2">&mdash;</span>
                    <span>{new Date(activeSprint.end_date).toLocaleDateString()}</span>
                  </div>

                  {/* Team Progress */}
                  {teamProgress && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          Team Progress: {teamProgress.done}/{teamProgress.total} objectives ({teamProgress.pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getBarColor(teamProgress.pct)}`}
                          style={{ width: `${Math.min(teamProgress.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Objectives */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Objectives ({objectives.length})</p>
                    {objectives.length === 0 ? (
                      <p className="text-sm text-gray-400">No objectives set yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {objectives.map(obj => {
                          const isOwner = fellow && obj.owner_fellow_id === fellow.id;
                          const EvidenceIcon = obj.evidence_type ? EVIDENCE_ICONS[obj.evidence_type] || Link2 : null;
                          return (
                            <div
                              key={obj.id}
                              className={`flex items-start gap-2 rounded border p-2 ${isOwner ? 'border-green-200 bg-green-50/50' : ''}`}
                            >
                              <div className={`mt-0.5 h-4 w-4 rounded-full flex-shrink-0 ${
                                obj.status === 'done' ? 'bg-green-500' :
                                obj.status === 'in_progress' ? 'bg-blue-500' :
                                obj.status === 'not_done' ? 'bg-red-500' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">{obj.description}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="secondary">{obj.status.replace('_', ' ')}</Badge>
                                  {isOwner && <Badge variant="info">You</Badge>}
                                  {obj.owner_role && !isOwner && (
                                    <span className="text-xs text-gray-400 capitalize">{obj.owner_role.replace('_', ' ')}</span>
                                  )}
                                  {obj.evidence_url && EvidenceIcon && (
                                    <a
                                      href={obj.evidence_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <EvidenceIcon className="h-3 w-3" />
                                      Evidence
                                    </a>
                                  )}
                                  {isOwner && obj.status === 'done' && !obj.evidence_url && (
                                    <span className="text-xs text-yellow-600 font-medium">Evidence needed</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No active sprint.</p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length === 0 ? (
                <p className="text-sm text-gray-400">No upcoming meetings this week.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.slice(0, 6).map(meeting => {
                    const scheduledAt = new Date(meeting.scheduled_at);
                    const isUnlocked = meeting.status === 'unlocked' || meeting.status === 'active';
                    const isLive = meeting.status === 'active';
                    const daysUntil = Math.ceil((scheduledAt.getTime() - Date.now()) / 86400000);
                    return (
                      <div key={meeting.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isLive ? 'bg-red-100' : isUnlocked ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {isLive ? (
                              <div className="relative">
                                <Video className="h-4 w-4 text-red-600" />
                                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                              </div>
                            ) : isUnlocked ? (
                              <Video className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium capitalize">{meeting.meeting_type.replace('_', ' ')}</p>
                              {isLive && <Badge variant="danger">LIVE</Badge>}
                            </div>
                            <p className="text-xs text-gray-500">
                              {scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' '}at{' '}
                              {scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {!isUnlocked && daysUntil > 0 && (
                                <span className="ml-2 text-gray-400">
                                  · Unlocks in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isUnlocked && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleJoinMeeting(meeting.id)}
                            disabled={joiningMeeting === meeting.id}
                          >
                            {joiningMeeting === meeting.id ? 'Joining...' : 'Join'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Check-ins */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Check-in History</CardTitle>
              {!hasCheckedInThisWeek && (
                <Button size="sm" variant="primary" onClick={() => setCheckInModalOpen(true)}>
                  <Send className="mr-1 h-3 w-3" /> Submit Check-in
                </Button>
              )}
              {hasCheckedInThisWeek && (
                <Badge variant="success">Week {currentWeek} submitted</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {checkIns.length === 0 ? (
              <p className="text-sm text-gray-400">No check-ins submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {checkIns.slice(0, 6).map(checkIn => (
                  <div key={checkIn.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary">Week {checkIn.week}</Badge>
                      <span className="text-xs text-gray-500">{new Date(checkIn.submitted_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      {checkIn.energy_level !== undefined && <span>Energy: {checkIn.energy_level}/10</span>}
                      {checkIn.sentiment_score != null && <span>Sentiment: {checkIn.sentiment_score.toFixed(2)}</span>}
                      {checkIn.self_assessment && <span className="capitalize">Self: {checkIn.self_assessment}</span>}
                    </div>
                    {checkIn.accomplishments && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{checkIn.accomplishments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Record</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="text-sm text-gray-400">No attendance records yet.</p>
            ) : (
              <div>
                {/* Summary */}
                {(() => {
                  const total = attendance.length;
                  const present = attendance.filter(a => a.status === 'present').length;
                  const late = attendance.filter(a => a.status === 'late' || a.status === 'very_late').length;
                  const absent = attendance.filter(a => a.status === 'absent').length;
                  return (
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-xl font-bold text-gray-900">{total}</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 text-center">
                        <p className="text-xs text-green-700">Present</p>
                        <p className="text-xl font-bold text-green-600">{present}</p>
                      </div>
                      <div className="rounded-lg bg-yellow-50 p-3 text-center">
                        <p className="text-xs text-yellow-700">Late</p>
                        <p className="text-xl font-bold text-yellow-600">{late}</p>
                      </div>
                      <div className="rounded-lg bg-red-50 p-3 text-center">
                        <p className="text-xs text-red-700">Absent</p>
                        <p className="text-xl font-bold text-red-600">{absent}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Recent Records */}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {attendance.slice(0, 12).map(att => (
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
                          att.status === 'late' || att.status === 'very_late' ? 'warning' :
                          att.status === 'absent' ? 'danger' : 'default'
                        }
                      >
                        {att.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peer Feedback */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
                Peer Feedback
              </CardTitle>
              <Button size="sm" variant="primary" onClick={() => setFeedbackModalOpen(true)}>
                Give Feedback
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            {feedbackSummary && feedbackSummary.total_received > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Collaboration', value: feedbackSummary.avg_collaboration },
                    { label: 'Communication', value: feedbackSummary.avg_communication },
                    { label: 'Technical', value: feedbackSummary.avg_technical },
                    { label: 'Overall', value: feedbackSummary.avg_overall },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-indigo-50 p-3 text-center">
                      <p className="text-xs text-indigo-700">{label}</p>
                      <p className="text-xl font-bold text-indigo-600">{value?.toFixed(1) || '-'}</p>
                      <div className="flex justify-center gap-0.5 mt-1">
                        {[1,2,3,4,5,6,7,8,9,10].map(s => (
                          <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= Math.round(value || 0) ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{feedbackSummary.total_received} feedback received</p>

                {/* Recent feedback */}
                {receivedFeedback.length > 0 && (
                  <div className="space-y-2">
                    {receivedFeedback.slice(0, 3).map((fb: any) => (
                      <div key={fb.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {fb.anonymous ? 'Anonymous' : fb.giver_name || 'Peer'}
                          </span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-bold">{fb.overall_rating}/10</span>
                          </div>
                        </div>
                        {fb.strengths && <p className="text-sm text-green-700 mt-1">{fb.strengths}</p>}
                        {fb.areas_to_improve && <p className="text-sm text-orange-700 mt-1">{fb.areas_to_improve}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No peer feedback received yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Certificate Download */}
        {fellow.status === 'graduated' || fellow.status === 'graduation_distinction' ? (
          <Card className="border-yellow-200 bg-yellow-50/30">
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {fellow.status === 'graduation_distinction' ? 'Graduated with Distinction!' : 'Congratulations, Graduate!'}
                  </p>
                  <p className="text-sm text-gray-600">Download your completion certificate</p>
                </div>
              </div>
              <Button onClick={handleDownloadCertificate} disabled={downloadingCert}>
                <Download className="mr-2 h-4 w-4" />
                {downloadingCert ? 'Downloading...' : 'Download Certificate'}
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Peer Feedback Modal */}
        <Modal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          title="Give Peer Feedback"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Member *</label>
              <select
                value={feedbackForm.receiver_id}
                onChange={e => setFeedbackForm(prev => ({ ...prev, receiver_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select a teammate...</option>
                {objectives.filter(o => o.owner_fellow_id && o.owner_fellow_id !== fellow?.id)
                  .reduce((acc: string[], o) => acc.includes(o.owner_fellow_id!) ? acc : [...acc, o.owner_fellow_id!], [])
                  .map(fId => (
                    <option key={fId} value={fId}>{fId.slice(0, 8)}...</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strengths *</label>
              <textarea
                rows={2}
                value={feedbackForm.strengths}
                onChange={e => setFeedbackForm(prev => ({ ...prev, strengths: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="What does this person do well?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Areas to Improve</label>
              <textarea
                rows={2}
                value={feedbackForm.areas_to_improve}
                onChange={e => setFeedbackForm(prev => ({ ...prev, areas_to_improve: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Constructive suggestions..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['collaboration_rating', 'communication_rating', 'technical_rating', 'overall_rating'] as const).map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field.replace('_rating', '')} ({feedbackForm[field]}/10)
                  </label>
                  <input
                    type="range" min="1" max="10"
                    value={feedbackForm[field]}
                    onChange={e => setFeedbackForm(prev => ({ ...prev, [field]: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={feedbackForm.anonymous}
                onChange={e => setFeedbackForm(prev => ({ ...prev, anonymous: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <label className="text-sm text-gray-700">Submit anonymously</label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setFeedbackModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmitFeedback}
                disabled={submittingFeedback || !feedbackForm.receiver_id || !feedbackForm.strengths.trim()}
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Check-in Submission Modal */}
        <Modal
          open={checkInModalOpen}
          onOpenChange={setCheckInModalOpen}
          title={`Week ${currentWeek} Check-in`}
          size="lg"
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What did you accomplish this week? *</label>
              <textarea
                rows={3}
                value={checkInForm.accomplishments}
                onChange={e => setCheckInForm(prev => ({ ...prev, accomplishments: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Describe your key accomplishments..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What will you focus on next week?</label>
              <textarea
                rows={2}
                value={checkInForm.next_focus}
                onChange={e => setCheckInForm(prev => ({ ...prev, next_focus: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Your priorities for next week..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Any blockers?</label>
              <textarea
                rows={2}
                value={checkInForm.blockers}
                onChange={e => setCheckInForm(prev => ({ ...prev, blockers: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Anything blocking your progress..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Do you need help with anything?</label>
              <textarea
                rows={2}
                value={checkInForm.needs_help}
                onChange={e => setCheckInForm(prev => ({ ...prev, needs_help: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Resources or support you need..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Self Assessment</label>
                <select
                  value={checkInForm.self_assessment}
                  onChange={e => setCheckInForm(prev => ({ ...prev, self_assessment: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="on_track">On Track</option>
                  <option value="slightly_behind">Slightly Behind</option>
                  <option value="behind">Behind</option>
                  <option value="significantly_behind">Significantly Behind</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Energy Level (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={checkInForm.energy_level}
                  onChange={e => setCheckInForm(prev => ({ ...prev, energy_level: parseInt(e.target.value) || 5 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collaboration (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={checkInForm.collaboration_rating}
                  onChange={e => setCheckInForm(prev => ({ ...prev, collaboration_rating: parseInt(e.target.value) || 5 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmitCheckIn}
                disabled={submittingCheckIn || !checkInForm.accomplishments.trim()}
              >
                {submittingCheckIn ? 'Submitting...' : 'Submit Check-in'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
