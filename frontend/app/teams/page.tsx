'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import { teamsAPI, cohortsAPI, fellowsAPI } from '@/lib/api';
import {
  Users, Plus, Pencil, ExternalLink, UserPlus, UserMinus,
  Repeat, MessageSquare, Github,
} from 'lucide-react';
import type { Cohort, Fellow } from '@/types';

interface TeamData {
  id: string;
  cohort_id: string;
  name: string;
  brief_title?: string | null;
  brief_description?: string | null;
  mentor_name?: string | null;
  mentor_id?: string | null;
  slack_channel?: string | null;
  github_repo?: string | null;
  status: string;
  member_count: number;
  sprint_count: number;
  created_at: string;
}

interface TeamDetail extends TeamData {
  members: Array<{
    id: string;
    name: string;
    email?: string;
    role: string;
    status: string;
  }>;
}

interface MentorOption {
  id: string;
  name: string;
  email: string;
  stack: string;
}

const STATUS_COLORS: Record<string, string> = {
  forming: 'bg-yellow-50 border-yellow-300',
  active: 'bg-green-50 border-green-300',
  completed: 'bg-blue-50 border-blue-300',
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamData | null>(null);
  const [saving, setSaving] = useState(false);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [form, setForm] = useState({
    name: '',
    brief_title: '',
    brief_description: '',
    mentor_id: '',
    slack_channel: '',
    github_repo: '',
    cohort_id: '',
  });

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Assign fellow
  const [allFellows, setAllFellows] = useState<Fellow[]>([]);
  const [assignFellowId, setAssignFellowId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [selectedCohortId]);

  const fetchCohorts = async () => {
    try {
      const res = await cohortsAPI.list();
      setCohorts(res.data);
      if (res.data.length > 0) setSelectedCohortId(res.data[0].id);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await teamsAPI.list(selectedCohortId || undefined);
      setTeams(res.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentors = async () => {
    try {
      const res = await teamsAPI.getMentors();
      setMentors(res.data);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    }
  };

  const handleOpenCreate = () => {
    setEditingTeam(null);
    setForm({
      name: '', brief_title: '', brief_description: '',
      mentor_id: '', slack_channel: '', github_repo: '',
      cohort_id: selectedCohortId,
    });
    fetchMentors();
    setModalOpen(true);
  };

  const handleOpenEdit = (team: TeamData) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      brief_title: team.brief_title || '',
      brief_description: team.brief_description || '',
      mentor_id: team.mentor_id || '',
      slack_channel: team.slack_channel || '',
      github_repo: team.github_repo || '',
      cohort_id: team.cohort_id,
    });
    fetchMentors();
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editingTeam) {
        await teamsAPI.update(editingTeam.id, {
          name: form.name,
          brief_title: form.brief_title || null,
          brief_description: form.brief_description || null,
          mentor_id: form.mentor_id || null,
          slack_channel: form.slack_channel || null,
          github_repo: form.github_repo || null,
        });
      } else {
        await teamsAPI.create({
          cohort_id: form.cohort_id || selectedCohortId,
          name: form.name,
          brief_title: form.brief_title || null,
          brief_description: form.brief_description || null,
          mentor_id: form.mentor_id || null,
          slack_channel: form.slack_channel || null,
          github_repo: form.github_repo || null,
        });
      }
      setModalOpen(false);
      await fetchTeams();
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Failed to save team.');
    } finally {
      setSaving(false);
    }
  };

  const handleViewTeam = async (team: TeamData) => {
    setDetailModalOpen(true);
    setLoadingDetail(true);
    setAssignFellowId('');
    try {
      const [teamRes, fellowsRes] = await Promise.all([
        teamsAPI.get(team.id),
        fellowsAPI.list(team.cohort_id),
      ]);
      setTeamDetail(teamRes.data);
      setAllFellows(fellowsRes.data);
    } catch (error) {
      console.error('Error fetching team detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAssignFellow = async () => {
    if (!assignFellowId || !teamDetail) return;
    setAssigning(true);
    try {
      await teamsAPI.assignFellow(teamDetail.id, assignFellowId);
      // Refresh detail
      const teamRes = await teamsAPI.get(teamDetail.id);
      setTeamDetail(teamRes.data);
      setAssignFellowId('');
      await fetchTeams();
    } catch (error) {
      console.error('Error assigning fellow:', error);
      alert('Failed to assign fellow.');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveFellow = async (fellowId: string) => {
    if (!teamDetail || !confirm('Remove this fellow from the team?')) return;
    try {
      await teamsAPI.removeFellow(teamDetail.id, fellowId);
      const teamRes = await teamsAPI.get(teamDetail.id);
      setTeamDetail(teamRes.data);
      await fetchTeams();
    } catch (error) {
      console.error('Error removing fellow:', error);
    }
  };

  // Unassigned fellows (not on any team in this team's detail)
  const unassignedFellows = allFellows.filter(
    f => !f.team_id || f.team_id === null
  );

  // Stats
  const totalMembers = teams.reduce((sum, t) => sum + t.member_count, 0);
  const activeTeams = teams.filter(t => t.status === 'active').length;

  if (loading && teams.length === 0) {
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
            <p className="mt-2 text-gray-600">
              Manage fellowship teams, assign fellows and mentors
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-1 h-4 w-4" /> Create Team
          </Button>
        </div>

        {/* Filters & Stats */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-6 ml-auto text-sm">
            <div className="text-center">
              <p className="text-gray-500">Teams</p>
              <p className="text-xl font-bold text-gray-900">{teams.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Active</p>
              <p className="text-xl font-bold text-green-600">{activeTeams}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Fellows</p>
              <p className="text-xl font-bold text-blue-600">{totalMembers}</p>
            </div>
          </div>
        </div>

        {/* Team Cards */}
        {teams.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No teams yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create a team to get started.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card
                key={team.id}
                className={`border-2 cursor-pointer hover:shadow-md transition-shadow ${STATUS_COLORS[team.status] || 'border-gray-200'}`}
                onClick={() => handleViewTeam(team)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                    {team.brief_title && (
                      <p className="text-sm text-gray-600">{team.brief_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(team.status)}>
                      {team.status}
                    </Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(team); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {team.brief_description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{team.brief_description}</p>
                )}

                <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                  <div className="rounded-lg bg-white/60 p-2">
                    <p className="text-lg font-bold text-gray-900">{team.member_count}</p>
                    <p className="text-xs text-gray-500">Members</p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-2">
                    <p className="text-lg font-bold text-gray-900">{team.sprint_count}</p>
                    <p className="text-xs text-gray-500">Sprints</p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-2">
                    <p className="text-lg font-bold text-gray-900">
                      {team.mentor_name ? '1' : '0'}
                    </p>
                    <p className="text-xs text-gray-500">Mentor</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {team.mentor_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                      <Users className="h-3 w-3" /> {team.mentor_name}
                    </span>
                  )}
                  {team.slack_channel && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      <MessageSquare className="h-3 w-3" /> {team.slack_channel}
                    </span>
                  )}
                  {team.github_repo && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      <Github className="h-3 w-3" /> Repo
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={editingTeam ? 'Edit Team' : 'Create Team'}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Team Alpha"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brief Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.brief_title}
                  onChange={(e) => setForm(prev => ({ ...prev, brief_title: e.target.value }))}
                  placeholder="Project title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentor</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.mentor_id}
                  onChange={(e) => setForm(prev => ({ ...prev, mentor_id: e.target.value }))}
                >
                  <option value="">No mentor assigned</option>
                  {mentors.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.stack})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brief Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={form.brief_description}
                onChange={(e) => setForm(prev => ({ ...prev, brief_description: e.target.value }))}
                placeholder="What is this team working on?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slack Channel</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.slack_channel}
                  onChange={(e) => setForm(prev => ({ ...prev, slack_channel: e.target.value }))}
                  placeholder="#team-alpha"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Repo</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.github_repo}
                  onChange={(e) => setForm(prev => ({ ...prev, github_repo: e.target.value }))}
                  placeholder="https://github.com/org/repo"
                />
              </div>
            </div>

            {!editingTeam && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.cohort_id}
                  onChange={(e) => setForm(prev => ({ ...prev, cohort_id: e.target.value }))}
                >
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving ? 'Saving...' : (editingTeam ? 'Save Changes' : 'Create Team')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Team Detail Modal */}
        <Modal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          title={teamDetail ? teamDetail.name : 'Team Detail'}
          size="lg"
        >
          {loadingDetail ? (
            <div className="py-8 text-center text-gray-500">Loading team details...</div>
          ) : teamDetail ? (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Header */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{teamDetail.name}</p>
                    {teamDetail.brief_title && <p className="text-sm text-gray-600">{teamDetail.brief_title}</p>}
                    {teamDetail.brief_description && (
                      <p className="text-sm text-gray-500 mt-1">{teamDetail.brief_description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusBadgeVariant(teamDetail.status)} className="text-sm">
                      {teamDetail.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-sm">
                  {teamDetail.mentor_name && (
                    <span className="text-purple-700">Mentor: {teamDetail.mentor_name}</span>
                  )}
                  {teamDetail.slack_channel && (
                    <span className="text-blue-600">{teamDetail.slack_channel}</span>
                  )}
                  {teamDetail.github_repo && (
                    <a href={teamDetail.github_repo} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> GitHub
                    </a>
                  )}
                  <span className="text-gray-500">{teamDetail.sprint_count} sprints</span>
                </div>
              </div>

              {/* Members Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Members ({teamDetail.members.length})</h4>
                </div>
                {teamDetail.members.length === 0 ? (
                  <p className="text-sm text-gray-500">No members assigned yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">-</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamDetail.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{member.role.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(member.status)}>{member.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveFellow(member.id)}>
                              <UserMinus className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Assign Fellow */}
              {unassignedFellows.length > 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <UserPlus className="h-4 w-4" /> Assign Fellow to Team
                  </p>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={assignFellowId}
                      onChange={(e) => setAssignFellowId(e.target.value)}
                    >
                      <option value="">Select a fellow...</option>
                      {unassignedFellows.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.role.replace(/_/g, ' ')})
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={!assignFellowId || assigning}
                      onClick={handleAssignFellow}
                    >
                      {assigning ? 'Assigning...' : 'Assign'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </AppLayout>
  );
}
