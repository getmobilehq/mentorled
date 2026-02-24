'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { mentorsAPI, mentorNotesAPI } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Activity,
  Flag,
  TrendingUp,
  Shield,
  FileText,
  Plus,
  Calendar,
} from 'lucide-react';

interface MentorProfile {
  id: string;
  email: string;
  name: string;
  stack: string;
  capacity: number;
  status: string;
  teams: { id: string; name: string; status: string }[];
}

interface TeamHealth {
  team_id: string;
  team_name: string;
  sprint_delivery: number;
  active_sprint: number | null;
  total_sprints: number;
  completed_sprints: number;
  avg_attendance: number;
  at_risk_count: number;
  fellow_count: number;
  fellows: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    risk_level: string | null;
    risk_score: number | null;
    warnings_count: number;
    mentor_flags: number;
    attendance_score: number;
    milestone_1: number | null;
    milestone_2: number | null;
    milestone_3: number | null;
    final_score: number | null;
  }[];
}

export default function MentorPage() {
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  const [teamHealth, setTeamHealth] = useState<Record<string, TeamHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flagging, setFlagging] = useState<string | null>(null);
  const { toast } = useToast();

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedFellowForNote, setSelectedFellowForNote] = useState<{ id: string; name: string } | null>(null);
  const [noteForm, setNoteForm] = useState({
    content: '',
    action_items: [''],
    mood: '',
    next_meeting_date: '',
  });
  const [savingNote, setSavingNote] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<string | null>(null);
  const [fellowNotes, setFellowNotes] = useState<any[]>([]);

  useEffect(() => {
    fetchMentorProfile();
  }, []);

  const fetchMentorProfile = async () => {
    try {
      const res = await mentorsAPI.getMe();
      const mentorData = res.data as MentorProfile;
      setMentor(mentorData);

      // Fetch health for each team
      const healthPromises = mentorData.teams.map(async (team) => {
        try {
          const healthRes = await mentorsAPI.getTeamHealth(team.id);
          return [team.id, healthRes.data] as [string, TeamHealth];
        } catch {
          return null;
        }
      });

      const results = await Promise.all(healthPromises);
      const healthMap: Record<string, TeamHealth> = {};
      for (const result of results) {
        if (result) healthMap[result[0]] = result[1];
      }
      setTeamHealth(healthMap);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load mentor dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleFlag = async (fellowId: string) => {
    setFlagging(fellowId);
    try {
      await mentorsAPI.flagFellow(fellowId);
      // Refresh team health data
      if (mentor) {
        for (const team of mentor.teams) {
          try {
            const healthRes = await mentorsAPI.getTeamHealth(team.id);
            setTeamHealth(prev => ({ ...prev, [team.id]: healthRes.data }));
          } catch {}
        }
      }
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to flag fellow.', 'error');
    } finally {
      setFlagging(null);
    }
  };

  // Fetch notes for mentor on load
  useEffect(() => {
    if (mentor) {
      mentorNotesAPI.getMy().then(r => setNotes(r.data)).catch(() => {});
    }
  }, [mentor]);

  const handleOpenNoteModal = (fellowId: string, fellowName: string) => {
    setSelectedFellowForNote({ id: fellowId, name: fellowName });
    setNoteForm({ content: '', action_items: [''], mood: '', next_meeting_date: '' });
    setNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedFellowForNote) return;
    setSavingNote(true);
    try {
      await mentorNotesAPI.create({
        fellow_id: selectedFellowForNote.id,
        content: noteForm.content,
        action_items: noteForm.action_items.filter(a => a.trim()),
        mood: noteForm.mood || undefined,
        next_meeting_date: noteForm.next_meeting_date || undefined,
      });
      setNoteModalOpen(false);
      const res = await mentorNotesAPI.getMy();
      setNotes(res.data);
      toast('Note saved.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to save note.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleViewFellowNotes = async (fellowId: string) => {
    setViewingNotes(fellowId);
    try {
      const res = await mentorNotesAPI.getForFellow(fellowId);
      setFellowNotes(res.data);
    } catch {
      setFellowNotes([]);
    }
  };

  const getRiskBadgeVariant = (level: string | null): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      on_track: 'success', monitor: 'info', at_risk: 'warning', critical: 'danger',
    };
    return map[level || ''] || 'default';
  };

  const getHealthColor = (value: number, thresholdGood: number, thresholdWarn: number) => {
    if (value >= thresholdGood) return 'text-green-600';
    if (value >= thresholdWarn) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading mentor dashboard...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !mentor) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Unavailable</h2>
              <p className="text-sm text-gray-600">{error || 'No mentor profile found.'}</p>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mentor Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Welcome, {mentor.name} &mdash; {mentor.stack} mentor ({mentor.teams.length} team{mentor.teams.length !== 1 ? 's' : ''})
          </p>
        </div>

        {/* Team Health Cards */}
        {mentor.teams.map(team => {
          const health = teamHealth[team.id];
          if (!health) return null;

          return (
            <div key={team.id} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">{team.name}</h2>

              {/* Health Metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Sprint Delivery</p>
                      <p className={`text-xl font-bold ${getHealthColor(health.sprint_delivery, 70, 40)}`}>
                        {health.sprint_delivery}%
                      </p>
                      <p className="text-xs text-gray-400">{health.completed_sprints}/{health.total_sprints} sprints</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <Activity className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Avg Attendance</p>
                      <p className={`text-xl font-bold ${getHealthColor(health.avg_attendance, 85, 70)}`}>
                        {health.avg_attendance}%
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
                      <p className="text-xs font-medium text-gray-500">At Risk</p>
                      <p className={`text-xl font-bold ${health.at_risk_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {health.at_risk_count}
                      </p>
                      <p className="text-xs text-gray-400">of {health.fellow_count} fellows</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Active Sprint</p>
                      <p className="text-xl font-bold text-gray-900">
                        {health.active_sprint ? `Sprint ${health.active_sprint}` : 'None'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Fellows Table */}
              <Card padding={false}>
                <CardHeader className="px-6 pt-6">
                  <CardTitle>Fellows ({health.fellows.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-y border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-medium text-gray-500">Fellow</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Risk</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Attendance</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Warnings</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Flags</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {health.fellows.map(fellow => (
                          <tr key={fellow.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{fellow.name}</p>
                                <p className="text-xs text-gray-500">{fellow.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 capitalize">{fellow.role.replace('_', ' ')}</td>
                            <td className="px-4 py-3">
                              {fellow.risk_level ? (
                                <Badge variant={getRiskBadgeVariant(fellow.risk_level)}>
                                  {fellow.risk_level.replace('_', ' ')}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${
                                fellow.attendance_score >= 85 ? 'text-green-600' :
                                fellow.attendance_score >= 70 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {fellow.attendance_score}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {fellow.warnings_count > 0 ? (
                                <Badge variant="warning">{fellow.warnings_count}</Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {fellow.mentor_flags > 0 ? (
                                <Badge variant="danger">{fellow.mentor_flags}</Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenNoteModal(fellow.id, fellow.name)}
                                  title="Add 1-on-1 Note"
                                >
                                  <FileText className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewFellowNotes(fellow.id)}
                                  title="View Notes"
                                >
                                  <Calendar className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFlag(fellow.id)}
                                  disabled={flagging === fellow.id}
                                >
                                  <Flag className="mr-1 h-3 w-3" />
                                  {flagging === fellow.id ? '...' : 'Flag'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
        {/* Recent Notes */}
        <Card>
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                My 1-on-1 Notes ({notes.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No notes yet. Click the note icon next to a fellow to create one.</p>
            ) : (
              <div className="space-y-3">
                {notes.slice(0, 8).map((note: any) => (
                  <div key={note.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{note.fellow_name}</span>
                      <div className="flex items-center gap-2">
                        {note.mood && (
                          <Badge variant="secondary">{note.mood}</Badge>
                        )}
                        <span className="text-xs text-gray-500">{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{note.content}</p>
                    {note.action_items && note.action_items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {note.action_items.map((item: string, i: number) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{item}</span>
                        ))}
                      </div>
                    )}
                    {note.next_meeting_date && (
                      <p className="text-xs text-gray-400 mt-1">Next meeting: {note.next_meeting_date}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fellow Notes Drawer */}
        {viewingNotes && (
          <Modal
            open={!!viewingNotes}
            onOpenChange={() => setViewingNotes(null)}
            title="Fellow Notes History"
            size="lg"
          >
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {fellowNotes.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No notes for this fellow yet.</p>
              ) : (
                fellowNotes.map((note: any) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {note.mood && <Badge variant="secondary">{note.mood}</Badge>}
                        <span className="text-xs text-gray-500">{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                      {note.next_meeting_date && (
                        <span className="text-xs text-gray-400">Next: {note.next_meeting_date}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{note.content}</p>
                    {note.action_items && note.action_items.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">Action Items:</p>
                        <ul className="space-y-1">
                          {note.action_items.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-4 border-t mt-4">
              <Button variant="secondary" onClick={() => setViewingNotes(null)}>Close</Button>
            </div>
          </Modal>
        )}

        {/* Create Note Modal */}
        <Modal
          open={noteModalOpen}
          onOpenChange={setNoteModalOpen}
          title={`1-on-1 Note — ${selectedFellowForNote?.name || ''}`}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Notes *</label>
              <textarea
                rows={4}
                value={noteForm.content}
                onChange={e => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="What was discussed in this 1-on-1..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Items</label>
              <div className="space-y-2">
                {noteForm.action_items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => {
                        const updated = [...noteForm.action_items];
                        updated[i] = e.target.value;
                        setNoteForm(prev => ({ ...prev, action_items: updated }));
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      placeholder="Action item..."
                    />
                    {noteForm.action_items.length > 1 && (
                      <button
                        onClick={() => setNoteForm(prev => ({ ...prev, action_items: prev.action_items.filter((_, idx) => idx !== i) }))}
                        className="text-red-400 hover:text-red-600 text-sm px-2"
                      >x</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setNoteForm(prev => ({ ...prev, action_items: [...prev.action_items, ''] }))}
                  className="text-xs text-green-600 hover:text-green-800"
                >+ Add action item</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
                <select
                  value={noteForm.mood}
                  onChange={e => setNoteForm(prev => ({ ...prev, mood: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Select mood...</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="concerned">Concerned</option>
                  <option value="struggling">Struggling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Meeting Date</label>
                <input
                  type="date"
                  value={noteForm.next_meeting_date}
                  onChange={e => setNoteForm(prev => ({ ...prev, next_meeting_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSaveNote}
                disabled={savingNote || !noteForm.content.trim()}
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
