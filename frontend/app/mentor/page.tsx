'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { mentorsAPI } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Activity,
  Flag,
  TrendingUp,
  Shield,
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFlag(fellow.id)}
                                disabled={flagging === fellow.id}
                              >
                                <Flag className="mr-1 h-3 w-3" />
                                {flagging === fellow.id ? 'Flagging...' : 'Flag'}
                              </Button>
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
      </div>
    </AppLayout>
  );
}
