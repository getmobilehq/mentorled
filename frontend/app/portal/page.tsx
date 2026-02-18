'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/Toast';
import { fellowsAPI, sprintsAPI, meetingsAPI, attendanceAPI, checkInsAPI } from '@/lib/api';
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
} from 'lucide-react';
import type { Fellow, Sprint, SprintObjective, Meeting, Attendance, CheckIn } from '@/types';

export default function PortalPage() {
  const { toast } = useToast();
  const [fellow, setFellow] = useState<Fellow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sprint data
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

  useEffect(() => {
    fetchFellowProfile();
  }, []);

  const fetchFellowProfile = async () => {
    try {
      const res = await fellowsAPI.getMe();
      const fellowData = res.data;
      setFellow(fellowData);

      // Fetch all related data in parallel
      const promises: Promise<any>[] = [];

      if (fellowData.team_id) {
        promises.push(
          sprintsAPI.list(fellowData.team_id).then(r => {
            const sprints = r.data as Sprint[];
            const active = sprints.find(s => s.status === 'active') || sprints[0];
            setActiveSprint(active || null);
            if (active) {
              return sprintsAPI.getObjectives(active.id).then(or => setObjectives(or.data));
            }
          }).catch(() => {}),
          meetingsAPI.upcoming(fellowData.team_id, 7).then(r => setUpcomingMeetings(r.data)).catch(() => {}),
        );
      }

      promises.push(
        attendanceAPI.getFellowHistory(fellowData.id).then(r => setAttendance(r.data)).catch(() => {}),
        checkInsAPI.getFellowCheckIns(fellowData.id).then(r => setCheckIns(r.data)).catch(() => {}),
      );

      await Promise.all(promises);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load your portal. Your account may not be linked to a fellow profile.');
    } finally {
      setLoading(false);
    }
  };

  const currentWeek = useMemo(() => {
    if (!fellow) return 1;
    // Approximate — will be refined by cohort start date
    return checkIns.length > 0 ? Math.max(...checkIns.map(c => c.week)) + 1 : 1;
  }, [fellow, checkIns]);

  const hasCheckedInThisWeek = useMemo(() => {
    return checkIns.some(c => c.week === currentWeek);
  }, [checkIns, currentWeek]);

  const attendanceScore = useMemo(() => {
    if (attendance.length === 0) return null;
    const scoreMap: Record<string, number> = { present: 1.0, late: 0.8, very_late: 0.5, absent: 0.0, approved_absence: 0.7 };
    const total = attendance.reduce((sum, a) => sum + (scoreMap[a.status] ?? 0.5), 0);
    return total / attendance.length;
  }, [attendance]);

  const handleJoinMeeting = async (meetingId: string) => {
    if (!fellow) return;
    setJoiningMeeting(meetingId);
    try {
      const res = await meetingsAPI.join(meetingId, fellow.id);
      if (res.data.meeting_link) {
        window.open(res.data.meeting_link, '_blank');
      }
      // Refresh attendance
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
      // Refresh check-ins
      const res = await checkInsAPI.getFellowCheckIns(fellow.id);
      setCheckIns(res.data);
      toast('Check-in submitted successfully.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to submit check-in.', 'error');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const getRiskColor = (level?: string) => {
    const map: Record<string, string> = { on_track: 'text-green-600', monitor: 'text-blue-600', at_risk: 'text-yellow-600', critical: 'text-red-600' };
    return map[level || ''] || 'text-gray-400';
  };

  const getRiskBadgeVariant = (level?: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = { on_track: 'success', monitor: 'info', at_risk: 'warning', critical: 'danger' };
    return map[level || ''] || 'default';
  };

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
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {fellow.name}</h1>
            <p className="mt-1 text-gray-600 capitalize">{fellow.role.replace('_', ' ')} Fellow</p>
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

        {/* Status Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Status</p>
                <Badge variant={getStatusBadgeVariant(fellow.status)}>{fellow.status}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Risk Level</p>
                {fellow.current_risk_level ? (
                  <Badge variant={getRiskBadgeVariant(fellow.current_risk_level)}>
                    {fellow.current_risk_level.replace('_', ' ')}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">Not assessed</span>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Attendance</p>
                <p className={`text-lg font-bold ${attendanceScore !== null ? (attendanceScore >= 0.9 ? 'text-green-600' : attendanceScore >= 0.7 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-400'}`}>
                  {attendanceScore !== null ? `${(attendanceScore * 100).toFixed(0)}%` : '-'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Warnings</p>
                <p className={`text-lg font-bold ${fellow.warnings_count && fellow.warnings_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fellow.warnings_count || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>

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
              <CardTitle>
                {activeSprint ? `Sprint ${activeSprint.sprint_number}` : 'Current Sprint'}
              </CardTitle>
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

                  {/* Objectives */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Objectives ({objectives.length})</p>
                    {objectives.length === 0 ? (
                      <p className="text-sm text-gray-400">No objectives set yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {objectives.map(obj => (
                          <div key={obj.id} className="flex items-start gap-2 rounded border p-2">
                            <div className={`mt-0.5 h-4 w-4 rounded-full flex-shrink-0 ${
                              obj.status === 'done' ? 'bg-green-500' :
                              obj.status === 'in_progress' ? 'bg-blue-500' :
                              obj.status === 'not_done' ? 'bg-red-500' : 'bg-gray-300'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{obj.description}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="secondary">{obj.status.replace('_', ' ')}</Badge>
                                {obj.owner_role && <span className="text-xs text-gray-400 capitalize">{obj.owner_role.replace('_', ' ')}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
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
                    return (
                      <div key={meeting.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isUnlocked ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {isUnlocked ? <Video className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">{meeting.meeting_type.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-500">
                              {scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' '}at{' '}
                              {scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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
