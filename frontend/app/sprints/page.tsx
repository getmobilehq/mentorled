'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  teamsAPI, sprintsAPI, meetingsAPI, attendanceAPI, retrospectivesAPI, cohortsAPI, fellowsAPI,
} from '@/lib/api';
import {
  Repeat, Target, Calendar, Clock, CheckCircle, Users,
  ArrowRight, ExternalLink, Plus, Pencil, Trash2, AlertTriangle,
  ThumbsUp, ThumbsDown, Lightbulb, Star, Zap,
} from 'lucide-react';
import type {
  Team, Sprint, SprintObjective, Meeting, Retrospective,
  AttendanceSummary, TeamAttendanceSummary, Cohort, Fellow,
  ObjectiveStatus, EvidenceType,
} from '@/types';

const SPRINT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 border-gray-300 text-gray-700',
  active: 'bg-green-50 border-green-400 text-green-800',
  completed: 'bg-blue-50 border-blue-400 text-blue-800',
};

const OBJECTIVE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  not_done: 'Not Done',
};

const OBJECTIVE_STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  not_started: 'default',
  in_progress: 'warning',
  done: 'success',
  not_done: 'danger',
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  sprint_planning: 'Sprint Planning',
  standup: 'Standup',
  sprint_review: 'Sprint Review',
  sprint_retrospective: 'Sprint Retrospective',
};

const MEETING_TYPE_ICONS: Record<string, string> = {
  sprint_planning: 'bg-purple-100 text-purple-600',
  standup: 'bg-blue-100 text-blue-600',
  sprint_review: 'bg-green-100 text-green-600',
  sprint_retrospective: 'bg-orange-100 text-orange-600',
};

export default function SprintBoardPage() {
  // Data state
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  // Team fellows
  const [teamFellows, setTeamFellows] = useState<Fellow[]>([]);

  // Sprint detail data
  const [objectives, setObjectives] = useState<SprintObjective[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<TeamAttendanceSummary | null>(null);
  const [retrospective, setRetrospective] = useState<Retrospective | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Upcoming meetings
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [joiningMeeting, setJoiningMeeting] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<{ meetingId: string; link: string; status: string } | null>(null);

  // Generate sprints
  const [generating, setGenerating] = useState(false);

  // Absence approval
  const [approvingAbsence, setApprovingAbsence] = useState<string | null>(null);

  // Meeting detail modal
  const [meetingDetailOpen, setMeetingDetailOpen] = useState(false);
  const [meetingDetail, setMeetingDetail] = useState<any>(null);
  const [loadingMeetingDetail, setLoadingMeetingDetail] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('objectives');

  // Objective modal
  const [objectiveModalOpen, setObjectiveModalOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<SprintObjective | null>(null);
  const [objectiveForm, setObjectiveForm] = useState({
    description: '',
    owner_role: '',
    status: 'not_started' as ObjectiveStatus,
    evidence_url: '',
    evidence_type: '' as EvidenceType | '',
  });
  const [savingObjective, setSavingObjective] = useState(false);

  // Retrospective form
  const [retroForm, setRetroForm] = useState({
    what_worked: [''],
    what_didnt_work: [''],
    what_to_improve: [''],
    team_mood: '' as string,
    sprint_rating: 7,
  });
  const [savingRetro, setSavingRetro] = useState(false);

  // Sprint goal edit
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // Load cohorts and teams on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Reload teams when cohort changes
  useEffect(() => {
    fetchTeams();
  }, [selectedCohortId]);

  // Reload sprints, fellows, and upcoming meetings when team changes
  useEffect(() => {
    if (selectedTeamId) {
      fetchSprints();
      fetchTeamFellows();
      fetchUpcomingMeetings();
    } else {
      setSprints([]);
      setSelectedSprintId('');
      setTeamFellows([]);
      setUpcomingMeetings([]);
    }
  }, [selectedTeamId]);

  // Load sprint detail when selected sprint changes
  useEffect(() => {
    if (selectedSprintId) {
      fetchSprintDetail();
    } else {
      setObjectives([]);
      setMeetings([]);
      setAttendanceSummary(null);
      setRetrospective(null);
    }
  }, [selectedSprintId]);

  const fetchInitialData = async () => {
    try {
      const [cohortsRes, teamsRes] = await Promise.all([
        cohortsAPI.list(),
        teamsAPI.list(),
      ]);
      setCohorts(cohortsRes.data);
      setTeams(teamsRes.data);

      // Auto-select first team if available
      if (teamsRes.data.length > 0) {
        setSelectedTeamId(teamsRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await teamsAPI.list(selectedCohortId || undefined);
      setTeams(res.data);
      if (res.data.length > 0 && !res.data.find((t: Team) => t.id === selectedTeamId)) {
        setSelectedTeamId(res.data[0].id);
      } else if (res.data.length === 0) {
        setSelectedTeamId('');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchTeamFellows = async () => {
    try {
      const res = await fellowsAPI.list();
      setTeamFellows(res.data.filter((f: Fellow) => f.team_id === selectedTeamId));
    } catch (error) {
      console.error('Error fetching fellows:', error);
    }
  };

  const fetchUpcomingMeetings = async () => {
    try {
      const res = await meetingsAPI.upcoming(selectedTeamId, 7);
      setUpcomingMeetings(res.data);
    } catch (error) {
      console.error('Error fetching upcoming meetings:', error);
      setUpcomingMeetings([]);
    }
  };

  const handleJoinMeeting = async (meetingId: string, fellowId: string) => {
    setJoiningMeeting(meetingId);
    setJoinResult(null);
    try {
      const res = await meetingsAPI.join(meetingId, fellowId);
      setJoinResult({
        meetingId,
        link: res.data.meeting_link,
        status: res.data.status,
      });
      // Refresh upcoming meetings to show updated status
      await fetchUpcomingMeetings();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to join meeting');
    } finally {
      setJoiningMeeting(null);
    }
  };

  const handleGenerateSprints = async () => {
    if (!selectedTeamId) return;
    setGenerating(true);
    try {
      await sprintsAPI.generate(selectedTeamId);
      await fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to generate sprints');
    } finally {
      setGenerating(false);
    }
  };

  const fetchSprints = async () => {
    try {
      const res = await sprintsAPI.list(selectedTeamId);
      setSprints(res.data);

      // Auto-select active sprint, or first sprint
      const active = res.data.find((s: Sprint) => s.status === 'active');
      const first = res.data[0];
      setSelectedSprintId(active?.id || first?.id || '');
    } catch (error) {
      console.error('Error fetching sprints:', error);
    }
  };

  const fetchSprintDetail = async () => {
    setLoadingDetail(true);
    try {
      const [objRes, meetRes] = await Promise.all([
        sprintsAPI.getObjectives(selectedSprintId),
        meetingsAPI.list(selectedTeamId, selectedSprintId),
      ]);
      setObjectives(objRes.data);
      setMeetings(meetRes.data);

      // Fetch attendance summary for team
      try {
        const attRes = await attendanceAPI.getTeamSummary(selectedTeamId);
        setAttendanceSummary(attRes.data);
      } catch {
        setAttendanceSummary(null);
      }

      // Fetch retrospective (only if sprint is completed)
      const sprint = sprints.find(s => s.id === selectedSprintId);
      if (sprint?.status === 'completed') {
        try {
          const retroRes = await retrospectivesAPI.getForSprint(selectedSprintId);
          setRetrospective(retroRes.data);
        } catch {
          setRetrospective(null);
        }
      } else {
        setRetrospective(null);
      }
    } catch (error) {
      console.error('Error fetching sprint detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Selected sprint
  const selectedSprint = useMemo(
    () => sprints.find(s => s.id === selectedSprintId) || null,
    [sprints, selectedSprintId]
  );

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  // Sprint status progression
  const handleSprintStatus = async (sprintId: string, newStatus: string) => {
    try {
      await sprintsAPI.updateStatus(sprintId, newStatus);
      await fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update sprint status');
    }
  };

  // Sprint goal
  const handleSaveGoal = async () => {
    if (!selectedSprintId) return;
    setSavingGoal(true);
    try {
      await sprintsAPI.update(selectedSprintId, { goal: goalText || undefined });
      await fetchSprints();
      setEditingGoal(false);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to save goal');
    } finally {
      setSavingGoal(false);
    }
  };

  // Objective CRUD
  const resetObjectiveForm = () => {
    setObjectiveForm({
      description: '', owner_role: '', status: 'not_started',
      evidence_url: '', evidence_type: '',
    });
    setEditingObjective(null);
  };

  const handleEditObjective = (obj: SprintObjective) => {
    setEditingObjective(obj);
    setObjectiveForm({
      description: obj.description,
      owner_role: obj.owner_role || '',
      status: obj.status,
      evidence_url: obj.evidence_url || '',
      evidence_type: (obj.evidence_type || '') as EvidenceType | '',
    });
    setObjectiveModalOpen(true);
  };

  const handleSaveObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingObjective(true);
    try {
      if (editingObjective) {
        await sprintsAPI.updateObjective(editingObjective.id, {
          description: objectiveForm.description,
          status: objectiveForm.status,
          evidence_url: objectiveForm.evidence_url || undefined,
          evidence_type: objectiveForm.evidence_type || undefined,
        });
      } else {
        await sprintsAPI.createObjective({
          sprint_id: selectedSprintId,
          description: objectiveForm.description,
          owner_role: objectiveForm.owner_role || undefined,
        });
      }
      setObjectiveModalOpen(false);
      resetObjectiveForm();
      await fetchSprintDetail();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to save objective');
    } finally {
      setSavingObjective(false);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('Delete this objective?')) return;
    try {
      await sprintsAPI.deleteObjective(id);
      await fetchSprintDetail();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete objective');
    }
  };

  // Retrospective submission
  const handleSubmitRetro = async () => {
    if (!selectedSprintId) return;
    setSavingRetro(true);
    try {
      await retrospectivesAPI.submit({
        sprint_id: selectedSprintId,
        what_worked: retroForm.what_worked.filter(s => s.trim()),
        what_didnt_work: retroForm.what_didnt_work.filter(s => s.trim()),
        what_to_improve: retroForm.what_to_improve.filter(s => s.trim()),
        team_mood: retroForm.team_mood || undefined,
        sprint_rating: retroForm.sprint_rating,
      });
      await fetchSprintDetail();
      setRetroForm({
        what_worked: [''], what_didnt_work: [''], what_to_improve: [''],
        team_mood: '', sprint_rating: 7,
      });
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to submit retrospective');
    } finally {
      setSavingRetro(false);
    }
  };

  const updateRetroList = (field: 'what_worked' | 'what_didnt_work' | 'what_to_improve', index: number, value: string) => {
    setRetroForm(prev => {
      const updated = [...prev[field]];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  };

  const addRetroListItem = (field: 'what_worked' | 'what_didnt_work' | 'what_to_improve') => {
    setRetroForm(prev => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const removeRetroListItem = (field: 'what_worked' | 'what_didnt_work' | 'what_to_improve', index: number) => {
    setRetroForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  // Approve absence
  const handleApproveAbsence = async (fellowId: string) => {
    // Find a meeting where this fellow is absent
    // We need to find the meeting_id. For simplicity, we'll use the attendance summary.
    // The approve endpoint needs a meeting_id, so we need to get the fellow's attendance records first.
    setApprovingAbsence(fellowId);
    try {
      const historyRes = await attendanceAPI.getFellowHistory(fellowId);
      const absentRecords = historyRes.data.filter(
        (r: any) => r.status === 'absent' && meetings.some((m: Meeting) => m.id === r.meeting_id)
      );
      if (absentRecords.length === 0) {
        alert('No absent meetings found for this fellow in current sprint.');
        return;
      }
      // Approve the most recent absent record
      await attendanceAPI.approveAbsence(absentRecords[0].meeting_id, fellowId);
      // Refresh attendance
      const attRes = await attendanceAPI.getTeamSummary(selectedTeamId);
      setAttendanceSummary(attRes.data);
    } catch (error) {
      console.error('Error approving absence:', error);
      alert('Failed to approve absence.');
    } finally {
      setApprovingAbsence(null);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const handleViewMeeting = async (meetingId: string) => {
    setMeetingDetailOpen(true);
    setLoadingMeetingDetail(true);
    try {
      const res = await meetingsAPI.get(meetingId);
      setMeetingDetail(res.data);
    } catch (error) {
      console.error('Error fetching meeting detail:', error);
    } finally {
      setLoadingMeetingDetail(false);
    }
  };

  const getUnlockCountdown = (unlockTime: string): string => {
    const now = new Date().getTime();
    const unlock = new Date(unlockTime).getTime();
    const diff = unlock - now;
    if (diff <= 0) return 'Unlocking...';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getMeetingAttendanceStatus = (meetingId: string): string => {
    if (!meetingDetail || meetingDetail.id !== meetingId) return '';
    const records = meetingDetail.attendance_records || [];
    if (records.length === 0) return '';
    const present = records.filter((r: any) => r.status === 'present').length;
    return `${present}/${records.length}`;
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sprint Board</h1>
          <p className="mt-2 text-gray-600">
            Manage team sprints, objectives, meetings, and attendance
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              <option value="">Select Team</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.mentor_name ? `(${t.mentor_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Team Info Bar */}
        {selectedTeam && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedTeam.name}</h2>
                  <p className="text-sm text-gray-600">
                    {selectedTeam.brief_title}
                    {selectedTeam.mentor_name && <span className="ml-2 text-gray-400">| Mentor: {selectedTeam.mentor_name}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(selectedTeam.status)}>
                  {selectedTeam.status}
                </Badge>
                {selectedTeam.github_repo && (
                  <a href={selectedTeam.github_repo} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> GitHub
                  </a>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" /> Upcoming Meetings (Next 7 Days)
                </CardTitle>
                <Badge variant="info">{upcomingMeetings.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => {
                  const isToday = new Date(meeting.scheduled_at).toDateString() === new Date().toDateString();
                  const isTomorrow = new Date(meeting.scheduled_at).toDateString() === new Date(Date.now() + 86400000).toDateString();
                  const timeLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatDate(meeting.scheduled_at);

                  return (
                    <div
                      key={meeting.id}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${MEETING_TYPE_ICONS[meeting.meeting_type] || 'bg-gray-100 text-gray-600'}`}>
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className={isToday ? 'font-semibold text-blue-600' : ''}>{timeLabel}</span>
                            {' at '}
                            {new Date(meeting.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            <span className="ml-1 text-gray-400">({meeting.duration_minutes} min)</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={meeting.status === 'completed' ? 'success' : meeting.is_locked ? 'default' : 'info'}>
                          {meeting.is_locked ? 'Locked' : meeting.status}
                        </Badge>
                        {joinResult?.meetingId === meeting.id ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={joinResult.status === 'present' ? 'success' : 'warning'}>
                              {joinResult.status === 'present' ? 'On Time' : joinResult.status.replace(/_/g, ' ')}
                            </Badge>
                            <a
                              href={joinResult.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Open
                            </a>
                          </div>
                        ) : !meeting.is_locked && meeting.status !== 'completed' ? (
                          <div className="flex items-center gap-1">
                            <select
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md"
                              id={`join-fellow-${meeting.id}`}
                              defaultValue=""
                            >
                              <option value="" disabled>Fellow...</option>
                              {teamFellows.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              disabled={joiningMeeting === meeting.id}
                              onClick={() => {
                                const el = document.getElementById(`join-fellow-${meeting.id}`) as HTMLSelectElement;
                                if (!el?.value) { alert('Select a fellow first'); return; }
                                handleJoinMeeting(meeting.id, el.value);
                              }}
                            >
                              {joiningMeeting === meeting.id ? 'Joining...' : 'Join'}
                            </Button>
                          </div>
                        ) : meeting.meeting_link ? (
                          <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Link
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Sprints (when team selected but no sprints) */}
        {selectedTeamId && sprints.length === 0 && !loading && (
          <Card>
            <div className="py-8 text-center">
              <Repeat className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sprints yet</h3>
              <p className="mt-1 text-sm text-gray-500">Generate 6 sprints with meetings for this team.</p>
              <Button className="mt-4" onClick={handleGenerateSprints} disabled={generating}>
                <Zap className="mr-2 h-4 w-4" />
                {generating ? 'Generating...' : 'Generate Sprints'}
              </Button>
            </div>
          </Card>
        )}

        {/* Sprint Timeline */}
        {sprints.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sprints.map((sprint) => {
              const isSelected = sprint.id === selectedSprintId;
              const progressPct = sprint.objective_count
                ? Math.round(((sprint.completed_objectives || 0) / sprint.objective_count) * 100)
                : 0;

              return (
                <button
                  key={sprint.id}
                  onClick={() => setSelectedSprintId(sprint.id)}
                  className={`
                    flex-shrink-0 w-44 rounded-lg border-2 p-3 text-left transition-all
                    ${isSelected
                      ? 'border-green-500 ring-2 ring-green-200 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }
                    ${SPRINT_STATUS_COLORS[sprint.status]}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide">Sprint {sprint.sprint_number}</span>
                    <Badge
                      variant={sprint.status === 'completed' ? 'success' : sprint.status === 'active' ? 'info' : 'default'}
                    >
                      {sprint.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        sprint.status === 'completed' ? 'bg-blue-500' :
                        sprint.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {sprint.completed_objectives || 0}/{sprint.objective_count || 0} objectives
                  </p>
                  {sprint.completion_score != null && (
                    <p className="text-xs font-semibold mt-1">Score: {sprint.completion_score}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* No team selected */}
        {!selectedTeamId && (
          <Card>
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No team selected</h3>
              <p className="mt-1 text-sm text-gray-500">Select a team to view its sprint board.</p>
            </div>
          </Card>
        )}

        {/* Sprint Detail */}
        {selectedSprint && (
          <>
            {/* Sprint Header Card */}
            <Card>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      Sprint {selectedSprint.sprint_number}
                    </h3>
                    <Badge variant={selectedSprint.status === 'completed' ? 'success' : selectedSprint.status === 'active' ? 'info' : 'default'}>
                      {selectedSprint.status}
                    </Badge>
                    {selectedSprint.completion_score != null && (
                      <span className="text-sm font-semibold text-gray-600">
                        Score: {selectedSprint.completion_score}/100
                      </span>
                    )}
                  </div>

                  {/* Goal */}
                  <div className="mt-2">
                    {editingGoal ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={goalText}
                          onChange={(e) => setGoalText(e.target.value)}
                          placeholder="Sprint goal..."
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <Button size="sm" onClick={handleSaveGoal} disabled={savingGoal}>
                          {savingGoal ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingGoal(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-600">
                          {selectedSprint.goal || <span className="italic text-gray-400">No goal set</span>}
                        </p>
                        {selectedSprint.status !== 'completed' && (
                          <button
                            onClick={() => { setGoalText(selectedSprint.goal || ''); setEditingGoal(true); }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(selectedSprint.start_date)} - {formatDate(selectedSprint.end_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      {selectedSprint.completed_objectives || 0}/{selectedSprint.objective_count || 0} objectives
                    </span>
                  </div>
                </div>

                {/* Status progression */}
                <div className="flex gap-2">
                  {selectedSprint.status === 'pending' && (
                    <Button size="sm" onClick={() => handleSprintStatus(selectedSprint.id, 'active')}>
                      <ArrowRight className="mr-1 h-4 w-4" /> Start Sprint
                    </Button>
                  )}
                  {selectedSprint.status === 'active' && (
                    <Button size="sm" variant="secondary" onClick={() => handleSprintStatus(selectedSprint.id, 'completed')}>
                      <CheckCircle className="mr-1 h-4 w-4" /> Complete Sprint
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="objectives" active={activeTab === 'objectives'} onClick={() => setActiveTab('objectives')}>
                  Objectives ({objectives.length})
                </TabsTrigger>
                <TabsTrigger value="meetings" active={activeTab === 'meetings'} onClick={() => setActiveTab('meetings')}>
                  Meetings ({meetings.length})
                </TabsTrigger>
                <TabsTrigger value="attendance" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}>
                  Attendance
                </TabsTrigger>
                <TabsTrigger value="team" active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
                  Team ({teamFellows.length})
                </TabsTrigger>
                <TabsTrigger value="analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
                  Analytics
                </TabsTrigger>
                {selectedSprint.status === 'completed' && (
                  <TabsTrigger value="retrospective" active={activeTab === 'retrospective'} onClick={() => setActiveTab('retrospective')}>
                    Retrospective
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Objectives Tab */}
              <TabsContent value="objectives" activeValue={activeTab}>
                <Card padding={false}>
                  <CardHeader className="px-6 pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle>Sprint Objectives</CardTitle>
                      {selectedSprint.status !== 'completed' && (
                        <Button size="sm" onClick={() => { resetObjectiveForm(); setObjectiveModalOpen(true); }}>
                          <Plus className="mr-1 h-4 w-4" /> Add Objective
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-0">
                    {loadingDetail ? (
                      <div className="py-8 text-center text-gray-500">Loading objectives...</div>
                    ) : objectives.length === 0 ? (
                      <div className="py-12 text-center">
                        <Target className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No objectives yet</h3>
                        <p className="mt-1 text-sm text-gray-500">Add sprint objectives to track team progress.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Evidence</TableHead>
                            {selectedSprint.status !== 'completed' && (
                              <TableHead className="text-right">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {objectives.map((obj) => (
                            <TableRow key={obj.id}>
                              <TableCell className="font-medium max-w-md">
                                {obj.description}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">{obj.owner_role || '-'}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={OBJECTIVE_STATUS_COLORS[obj.status] || 'default'}>
                                  {OBJECTIVE_STATUS_LABELS[obj.status] || obj.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {obj.evidence_url ? (
                                  <a
                                    href={obj.evidence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {obj.evidence_type || 'Link'}
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-sm">None</span>
                                )}
                              </TableCell>
                              {selectedSprint.status !== 'completed' && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => handleEditObjective(obj)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteObjective(obj.id)}>
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Meetings Tab */}
              <TabsContent value="meetings" activeValue={activeTab}>
                <Card padding={false}>
                  <CardHeader className="px-6 pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle>Sprint Meetings</CardTitle>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" /> Completed: {meetings.filter(m => m.status === 'completed').length}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled: {meetings.filter(m => m.status === 'scheduled').length}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0">
                    {loadingDetail ? (
                      <div className="py-8 text-center text-gray-500">Loading meetings...</div>
                    ) : meetings.length === 0 ? (
                      <div className="py-12 text-center">
                        <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings</h3>
                        <p className="mt-1 text-sm text-gray-500">No meetings scheduled for this sprint.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {meetings.map((meeting) => {
                          const isPast = new Date(meeting.scheduled_at) < new Date();
                          const isLocked = meeting.is_locked && meeting.status === 'scheduled';
                          return (
                            <div
                              key={meeting.id}
                              className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-colors ${
                                meeting.status === 'completed' ? 'hover:bg-green-50' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => handleViewMeeting(meeting.id)}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${MEETING_TYPE_ICONS[meeting.meeting_type] || 'bg-gray-100 text-gray-600'}`}>
                                  <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDateTime(meeting.scheduled_at)}
                                    <span className="ml-2 text-gray-400">({meeting.duration_minutes} min)</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Unlock countdown */}
                                {isLocked && !isPast && meeting.unlock_time && (
                                  <span className="text-xs text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded">
                                    <Clock className="h-3 w-3" /> Unlocks in {getUnlockCountdown(meeting.unlock_time)}
                                  </span>
                                )}
                                <Badge variant={meeting.status === 'completed' ? 'success' : meeting.status === 'active' ? 'info' : 'default'}>
                                  {meeting.status}
                                </Badge>
                                {meeting.meeting_link && (
                                  <a
                                    href={meeting.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" /> Join
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" activeValue={activeTab}>
                <Card padding={false}>
                  <CardHeader className="px-6 pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle>Team Attendance</CardTitle>
                      {attendanceSummary && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Team Average</p>
                          <p className={`text-2xl font-bold ${
                            attendanceSummary.team_average >= 0.9 ? 'text-green-600' :
                            attendanceSummary.team_average >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(attendanceSummary.team_average * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-0">
                    {!attendanceSummary ? (
                      <div className="py-12 text-center">
                        <Users className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance data</h3>
                        <p className="mt-1 text-sm text-gray-500">Attendance will appear after fellows join meetings.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fellow</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Present</TableHead>
                            <TableHead>Late</TableHead>
                            <TableHead>Very Late</TableHead>
                            <TableHead>Absent</TableHead>
                            <TableHead>Approved</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead className="text-right">-</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceSummary.members.map((member) => (
                            <TableRow key={member.fellow_id}>
                              <TableCell className="font-medium">{member.fellow_name}</TableCell>
                              <TableCell className="text-sm text-gray-600">{member.role}</TableCell>
                              <TableCell>
                                <span className="text-green-600 font-medium">{member.present_count}</span>
                              </TableCell>
                              <TableCell>
                                <span className={member.late_count > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                                  {member.late_count}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={member.very_late_count > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                                  {member.very_late_count}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={member.absent_count > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                  {member.absent_count}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={member.approved_absence_count > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                  {member.approved_absence_count}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        member.attendance_score >= 0.9 ? 'bg-green-500' :
                                        member.attendance_score >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${member.attendance_score * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {(member.attendance_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {member.absent_count > 0 && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={approvingAbsence === member.fellow_id}
                                    onClick={() => handleApproveAbsence(member.fellow_id)}
                                  >
                                    {approvingAbsence === member.fellow_id ? 'Approving...' : 'Approve Absence'}
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
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" activeValue={activeTab}>
                <Card padding={false}>
                  <CardHeader className="px-6 pt-6">
                    <CardTitle>Team Members</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0">
                    {teamFellows.length === 0 ? (
                      <div className="py-12 text-center">
                        <Users className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No team members</h3>
                        <p className="mt-1 text-sm text-gray-500">No fellows are assigned to this team yet.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fellow</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Attendance</TableHead>
                            <TableHead>Objectives Owned</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamFellows.map((fellow) => {
                            const memberAttendance = attendanceSummary?.members.find(
                              m => m.fellow_id === fellow.id
                            );
                            const ownedObjectives = objectives.filter(
                              o => o.owner_fellow_id === fellow.id
                            );
                            return (
                              <TableRow key={fellow.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-gray-900">{fellow.name || 'Unknown'}</p>
                                    <p className="text-xs text-gray-500">{fellow.email || ''}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{fellow.role || '-'}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusBadgeVariant(fellow.status)}>
                                    {fellow.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {memberAttendance ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            memberAttendance.attendance_score >= 0.9 ? 'bg-green-500' :
                                            memberAttendance.attendance_score >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${memberAttendance.attendance_score * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-semibold">
                                        {(memberAttendance.attendance_score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400">No data</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {ownedObjectives.length > 0 ? (
                                    <div className="space-y-1">
                                      {ownedObjectives.map(obj => (
                                        <div key={obj.id} className="flex items-center gap-2">
                                          <Badge variant={OBJECTIVE_STATUS_COLORS[obj.status] || 'default'} className="text-xs">
                                            {OBJECTIVE_STATUS_LABELS[obj.status]}
                                          </Badge>
                                          <span className="text-xs text-gray-600 truncate max-w-[200px]">
                                            {obj.description}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400">None</span>
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
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" activeValue={activeTab}>
                <div className="space-y-4">
                  {/* Sprint Completion Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sprint Completion Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sprints.filter(s => s.completion_score != null).length === 0 ? (
                        <p className="text-sm text-gray-500">No completed sprints with scores yet.</p>
                      ) : (
                        <div className="flex items-end gap-3 h-36">
                          {sprints.map((sprint) => {
                            const score = sprint.completion_score ?? 0;
                            const isCompleted = sprint.status === 'completed';
                            return (
                              <div key={sprint.id} className="flex-1 flex flex-col items-center justify-end h-full">
                                {isCompleted && (
                                  <span className="text-xs font-semibold mb-1">{score}</span>
                                )}
                                <div
                                  className={`w-full rounded-t transition-all ${
                                    isCompleted
                                      ? score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                      : 'bg-gray-200'
                                  }`}
                                  style={{ height: isCompleted ? `${Math.max(score, 4)}%` : '10%' }}
                                  title={`Sprint ${sprint.sprint_number}: ${isCompleted ? `${score}/100` : sprint.status}`}
                                />
                                <span className="text-xs text-gray-500 mt-1">S{sprint.sprint_number}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Objective Status Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Objective Status (Current Sprint)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {objectives.length === 0 ? (
                          <p className="text-sm text-gray-500">No objectives in this sprint.</p>
                        ) : (
                          <div className="space-y-2">
                            {(['done', 'in_progress', 'not_started', 'not_done'] as const).map(status => {
                              const count = objectives.filter(o => o.status === status).length;
                              const pct = Math.round((count / objectives.length) * 100);
                              return (
                                <div key={status} className="flex items-center gap-3">
                                  <span className="w-24 text-sm text-gray-600">{OBJECTIVE_STATUS_LABELS[status]}</span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full ${
                                        status === 'done' ? 'bg-green-500' :
                                        status === 'in_progress' ? 'bg-yellow-500' :
                                        status === 'not_done' ? 'bg-red-500' : 'bg-gray-400'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="w-12 text-sm font-semibold text-right">{count} ({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Team Velocity */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Team Velocity (Objectives/Sprint)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-3 h-28">
                          {sprints.map((sprint) => {
                            const done = sprint.completed_objectives || 0;
                            const total = sprint.objective_count || 0;
                            const maxDone = Math.max(...sprints.map(s => s.completed_objectives || 0), 1);
                            const barHeight = (done / maxDone) * 100;
                            return (
                              <div key={sprint.id} className="flex-1 flex flex-col items-center justify-end h-full">
                                {done > 0 && <span className="text-xs font-semibold mb-1">{done}/{total}</span>}
                                <div
                                  className={`w-full rounded-t ${
                                    sprint.status === 'completed' ? 'bg-blue-500' :
                                    sprint.status === 'active' ? 'bg-green-400' : 'bg-gray-200'
                                  }`}
                                  style={{ height: `${Math.max(barHeight, 4)}%` }}
                                />
                                <span className="text-xs text-gray-500 mt-1">S{sprint.sprint_number}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendance Summary */}
                  {attendanceSummary && attendanceSummary.members.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Attendance Overview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-center text-sm">
                          <div className="rounded-lg bg-green-50 p-3">
                            <p className="text-xl font-bold text-green-600">
                              {(attendanceSummary.team_average * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-gray-500">Team Average</p>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-3">
                            <p className="text-xl font-bold text-blue-600">
                              {attendanceSummary.total_meetings}
                            </p>
                            <p className="text-xs text-gray-500">Total Meetings</p>
                          </div>
                          <div className="rounded-lg bg-yellow-50 p-3">
                            <p className="text-xl font-bold text-yellow-600">
                              {attendanceSummary.members.reduce((sum, m) => sum + m.late_count + m.very_late_count, 0)}
                            </p>
                            <p className="text-xs text-gray-500">Total Late</p>
                          </div>
                          <div className="rounded-lg bg-red-50 p-3">
                            <p className="text-xl font-bold text-red-600">
                              {attendanceSummary.members.reduce((sum, m) => sum + m.absent_count, 0)}
                            </p>
                            <p className="text-xs text-gray-500">Total Absent</p>
                          </div>
                        </div>

                        {/* Per-member bar chart */}
                        <div className="mt-4 space-y-2">
                          {attendanceSummary.members
                            .sort((a, b) => b.attendance_score - a.attendance_score)
                            .map((member) => (
                              <div key={member.fellow_id} className="flex items-center gap-3">
                                <span className="w-28 text-sm text-gray-600 truncate">{member.fellow_name}</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full ${
                                      member.attendance_score >= 0.9 ? 'bg-green-500' :
                                      member.attendance_score >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${member.attendance_score * 100}%` }}
                                  />
                                </div>
                                <span className="w-10 text-sm font-semibold text-right">
                                  {(member.attendance_score * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Retrospective Tab */}
              {selectedSprint.status === 'completed' && (
                <TabsContent value="retrospective" activeValue={activeTab}>
                  <Card>
                    {!retrospective ? (
                      <div className="space-y-5">
                        <h3 className="text-lg font-semibold text-gray-900">Submit Sprint {selectedSprint.sprint_number} Retrospective</h3>

                        {/* Three columns */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {/* What worked */}
                          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ThumbsUp className="h-5 w-5 text-green-600" />
                              <h4 className="font-semibold text-green-800">What Worked</h4>
                            </div>
                            <div className="space-y-2">
                              {retroForm.what_worked.map((item, i) => (
                                <div key={i} className="flex gap-1">
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateRetroList('what_worked', i, e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                    placeholder="Something that went well..."
                                  />
                                  {retroForm.what_worked.length > 1 && (
                                    <button onClick={() => removeRetroListItem('what_worked', i)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addRetroListItem('what_worked')} className="text-xs text-green-600 hover:text-green-800">+ Add item</button>
                            </div>
                          </div>

                          {/* What didn't work */}
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ThumbsDown className="h-5 w-5 text-red-600" />
                              <h4 className="font-semibold text-red-800">What Didn&apos;t Work</h4>
                            </div>
                            <div className="space-y-2">
                              {retroForm.what_didnt_work.map((item, i) => (
                                <div key={i} className="flex gap-1">
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateRetroList('what_didnt_work', i, e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                                    placeholder="Something that needs change..."
                                  />
                                  {retroForm.what_didnt_work.length > 1 && (
                                    <button onClick={() => removeRetroListItem('what_didnt_work', i)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addRetroListItem('what_didnt_work')} className="text-xs text-red-600 hover:text-red-800">+ Add item</button>
                            </div>
                          </div>

                          {/* What to improve */}
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Lightbulb className="h-5 w-5 text-blue-600" />
                              <h4 className="font-semibold text-blue-800">What to Improve</h4>
                            </div>
                            <div className="space-y-2">
                              {retroForm.what_to_improve.map((item, i) => (
                                <div key={i} className="flex gap-1">
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateRetroList('what_to_improve', i, e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Improvement idea..."
                                  />
                                  {retroForm.what_to_improve.length > 1 && (
                                    <button onClick={() => removeRetroListItem('what_to_improve', i)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addRetroListItem('what_to_improve')} className="text-xs text-blue-600 hover:text-blue-800">+ Add item</button>
                            </div>
                          </div>
                        </div>

                        {/* Mood & Rating */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Team Mood</label>
                            <select
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              value={retroForm.team_mood}
                              onChange={(e) => setRetroForm(prev => ({ ...prev, team_mood: e.target.value }))}
                            >
                              <option value="">Select mood...</option>
                              <option value="energized">Energized</option>
                              <option value="positive">Positive</option>
                              <option value="neutral">Neutral</option>
                              <option value="tired">Tired</option>
                              <option value="frustrated">Frustrated</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Sprint Rating ({retroForm.sprint_rating}/10)
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              className="w-full mt-2"
                              value={retroForm.sprint_rating}
                              onChange={(e) => setRetroForm(prev => ({ ...prev, sprint_rating: parseInt(e.target.value) }))}
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Poor</span>
                              <span>Excellent</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={handleSubmitRetro} disabled={savingRetro}>
                            {savingRetro ? 'Submitting...' : 'Submit Retrospective'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Header with mood and rating */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">Sprint {selectedSprint.sprint_number} Retrospective</h3>
                            {retrospective.team_mood && (
                              <Badge variant="secondary">{retrospective.team_mood}</Badge>
                            )}
                          </div>
                          {retrospective.sprint_rating != null && (
                            <div className="flex items-center gap-1">
                              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                              <span className="text-lg font-bold text-gray-900">{retrospective.sprint_rating}/10</span>
                            </div>
                          )}
                        </div>

                        {/* Three columns */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {/* What worked */}
                          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ThumbsUp className="h-5 w-5 text-green-600" />
                              <h4 className="font-semibold text-green-800">What Worked</h4>
                            </div>
                            <ul className="space-y-2">
                              {retrospective.what_worked.map((item, i) => (
                                <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* What didn't work */}
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ThumbsDown className="h-5 w-5 text-red-600" />
                              <h4 className="font-semibold text-red-800">What Didn&apos;t Work</h4>
                            </div>
                            <ul className="space-y-2">
                              {retrospective.what_didnt_work.map((item, i) => (
                                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* What to improve */}
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Lightbulb className="h-5 w-5 text-blue-600" />
                              <h4 className="font-semibold text-blue-800">What to Improve</h4>
                            </div>
                            <ul className="space-y-2">
                              {retrospective.what_to_improve.map((item, i) => (
                                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {retrospective.submitted_at && (
                          <p className="text-xs text-gray-400">
                            Submitted {formatDateTime(retrospective.submitted_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}

        {/* Meeting Detail Modal */}
        <Modal
          open={meetingDetailOpen}
          onOpenChange={setMeetingDetailOpen}
          title={meetingDetail ? `${MEETING_TYPE_LABELS[meetingDetail.meeting_type] || meetingDetail.meeting_type}` : 'Meeting Detail'}
          size="lg"
        >
          {loadingMeetingDetail ? (
            <div className="py-8 text-center text-gray-500">Loading meeting details...</div>
          ) : meetingDetail ? (
            <div className="space-y-5">
              {/* Meeting Info */}
              <div className={`rounded-lg p-4 ${MEETING_TYPE_ICONS[meetingDetail.meeting_type]?.split(' ')[0] || 'bg-gray-100'} bg-opacity-50`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {MEETING_TYPE_LABELS[meetingDetail.meeting_type] || meetingDetail.meeting_type}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDateTime(meetingDetail.scheduled_at)} ({meetingDetail.duration_minutes} min)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meetingDetail.status === 'completed' ? 'success' : meetingDetail.status === 'active' ? 'info' : 'default'}>
                      {meetingDetail.status}
                    </Badge>
                    {meetingDetail.is_locked && meetingDetail.status === 'scheduled' && (
                      <Badge variant="warning">Locked</Badge>
                    )}
                  </div>
                </div>
                {meetingDetail.meeting_link && (
                  <a
                    href={meetingDetail.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3" /> Meeting Link
                  </a>
                )}
              </div>

              {/* Unlock Info */}
              {meetingDetail.is_locked && meetingDetail.status === 'scheduled' && (
                <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">Meeting Locked</p>
                    <p className="text-xs text-orange-600">
                      Unlocks at {new Date(meetingDetail.unlock_time).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                      {new Date(meetingDetail.unlock_time) > new Date() && (
                        <span className="ml-1 font-medium">({getUnlockCountdown(meetingDetail.unlock_time)})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance Records */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Attendance ({meetingDetail.attendance_records?.length || 0} records)
                </h4>
                {(!meetingDetail.attendance_records || meetingDetail.attendance_records.length === 0) ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No attendance recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fellow</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined At</TableHead>
                        <TableHead>Minutes Late</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetingDetail.attendance_records.map((record: any) => {
                        const fellow = teamFellows.find(f => f.id === record.fellow_id);
                        const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
                          present: 'success',
                          late: 'warning',
                          very_late: 'danger',
                          absent: 'danger',
                          approved_absence: 'info',
                        };
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {fellow?.name || record.fellow_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[record.status] || 'default'}>
                                {record.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {record.joined_at
                                ? new Date(record.joined_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {record.minutes_late != null ? (
                                <span className={`text-sm font-medium ${
                                  record.minutes_late === 0 ? 'text-green-600' :
                                  record.minutes_late <= 5 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {record.minutes_late === 0 ? 'On time' : `${record.minutes_late} min`}
                                </span>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button variant="secondary" onClick={() => setMeetingDetailOpen(false)}>Close</Button>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* Objective Modal */}
        <Modal
          open={objectiveModalOpen}
          onOpenChange={(open) => { setObjectiveModalOpen(open); if (!open) resetObjectiveForm(); }}
          title={editingObjective ? 'Edit Objective' : 'Add Objective'}
        >
          <form onSubmit={handleSaveObjective} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                required
                rows={3}
                value={objectiveForm.description}
                onChange={(e) => setObjectiveForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="What needs to be accomplished..."
              />
            </div>

            {!editingObjective && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Role</label>
                <input
                  type="text"
                  value={objectiveForm.owner_role}
                  onChange={(e) => setObjectiveForm(prev => ({ ...prev, owner_role: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="e.g. Frontend Developer, Designer..."
                />
              </div>
            )}

            {editingObjective && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={objectiveForm.status}
                    onChange={(e) => setObjectiveForm(prev => ({ ...prev, status: e.target.value as ObjectiveStatus }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="not_done">Not Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evidence URL</label>
                  <input
                    type="url"
                    value={objectiveForm.evidence_url}
                    onChange={(e) => setObjectiveForm(prev => ({ ...prev, evidence_url: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="https://github.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Type</label>
                  <select
                    value={objectiveForm.evidence_type}
                    onChange={(e) => setObjectiveForm(prev => ({ ...prev, evidence_type: e.target.value as EvidenceType | '' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="">Select type...</option>
                    <option value="github">GitHub</option>
                    <option value="figma">Figma</option>
                    <option value="deployment">Deployment</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => { setObjectiveModalOpen(false); resetObjectiveForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingObjective}>
                {savingObjective ? 'Saving...' : (editingObjective ? 'Save Changes' : 'Add Objective')}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
