'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import { fellowsAPI, placementAPI, cohortsAPI } from '@/lib/api';
import {
  Briefcase,
  User,
  Sparkles,
  Mail,
  Target,
  Plus,
  Search,
  Eye,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  X,
  Send,
  MapPin,
  Globe,
} from 'lucide-react';
import type { Fellow, Profile, JobOpportunity, PlacementMatch, Cohort } from '@/types';

const MATCH_STATUS_ORDER = ['suggested', 'approved', 'introduced', 'interviewing', 'offered', 'hired'];

const MATCH_STATUS_COLORS: Record<string, string> = {
  suggested: 'default',
  approved: 'info',
  introduced: 'warning',
  interviewing: 'warning',
  offered: 'success',
  hired: 'success',
  rejected: 'danger',
  withdrawn: 'default',
};

const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid Level' },
];

export default function PlacementPage() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'opportunities' | 'matches'>('profiles');
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [opportunities, setOpportunities] = useState<JobOpportunity[]>([]);
  const [matches, setMatches] = useState<PlacementMatch[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [matching, setMatching] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [oppStatusFilter, setOppStatusFilter] = useState('active');
  const [oppSearchQuery, setOppSearchQuery] = useState('');
  const [selectedFellowForMatches, setSelectedFellowForMatches] = useState('');

  // Modals
  const [profileModal, setProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [oppModal, setOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<JobOpportunity | null>(null);
  const [introModal, setIntroModal] = useState(false);
  const [introDraft, setIntroDraft] = useState<any>(null);
  const [draftingIntro, setDraftingIntro] = useState<string | null>(null);
  const [savingOpp, setSavingOpp] = useState(false);
  const [updatingMatchStatus, setUpdatingMatchStatus] = useState<string | null>(null);

  // Opportunity form
  const [oppForm, setOppForm] = useState({
    title: '',
    employer_name: '',
    employer_contact_email: '',
    description: '',
    requirements: '',
    preferred_skills: '',
    experience_level: 'entry',
    location: '',
    remote_ok: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const [fellowsRes, profilesRes, oppsRes, cohortsRes] = await Promise.all([
        fellowsAPI.list(selectedCohortId || undefined),
        placementAPI.listProfiles(selectedCohortId || undefined),
        placementAPI.listOpportunities(),
        cohortsAPI.list().catch(() => ({ data: [] })),
      ]);

      setFellows(fellowsRes.data);
      setProfiles(profilesRes.data);
      setOpportunities(oppsRes.data);
      setCohorts(cohortsRes.data);
    } catch (error) {
      console.error('Error fetching placement data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCohortId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch matches when fellow is selected
  useEffect(() => {
    if (selectedFellowForMatches) {
      placementAPI.getFellowMatches(selectedFellowForMatches)
        .then(res => setMatches(res.data))
        .catch(() => setMatches([]));
    }
  }, [selectedFellowForMatches]);

  const handleGenerateProfile = async (fellowId: string) => {
    setGenerating(fellowId);
    try {
      const response = await placementAPI.generateProfile(fellowId);
      setSelectedProfile(response.data.profile);
      setProfileModal(true);
      await fetchData();
    } catch (error) {
      console.error('Error generating profile:', error);
      alert('Failed to generate profile. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  const handleMatchOpportunities = async (fellowId: string) => {
    setMatching(fellowId);
    try {
      const response = await placementAPI.matchOpportunities(fellowId);
      setMatches(response.data.matches);
      setSelectedFellowForMatches(fellowId);
      setActiveTab('matches');
    } catch (error) {
      console.error('Error matching opportunities:', error);
      alert('Failed to match opportunities. Ensure there are active opportunities.');
    } finally {
      setMatching(null);
    }
  };

  const handleViewProfile = (fellowId: string) => {
    const profile = profiles.find(p => p.fellow_id === fellowId);
    if (profile) {
      setSelectedProfile(profile);
      setProfileModal(true);
    }
  };

  const handleSaveOpportunity = async () => {
    setSavingOpp(true);
    try {
      const data = {
        ...oppForm,
        requirements: oppForm.requirements ? oppForm.requirements.split(',').map(s => s.trim()).filter(Boolean) : [],
        preferred_skills: oppForm.preferred_skills ? oppForm.preferred_skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      if (editingOpp) {
        await placementAPI.updateOpportunity(editingOpp.id, data);
      } else {
        await placementAPI.createOpportunity(data);
      }

      setOppModal(false);
      resetOppForm();
      await fetchData();
    } catch (error) {
      console.error('Error saving opportunity:', error);
      alert('Failed to save opportunity.');
    } finally {
      setSavingOpp(false);
    }
  };

  const handleEditOpp = (opp: JobOpportunity) => {
    setEditingOpp(opp);
    setOppForm({
      title: opp.title,
      employer_name: opp.employer_name,
      employer_contact_email: opp.employer_contact_email || '',
      description: opp.description || '',
      requirements: (opp.requirements || []).join(', '),
      preferred_skills: (opp.preferred_skills || []).join(', '),
      experience_level: opp.experience_level || 'entry',
      location: opp.location || '',
      remote_ok: opp.remote_ok ?? true,
    });
    setOppModal(true);
  };

  const handleOppStatus = async (id: string, status: string) => {
    try {
      await placementAPI.updateOpportunityStatus(id, status);
      await fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDraftIntro = async (matchId: string) => {
    setDraftingIntro(matchId);
    try {
      const response = await placementAPI.draftIntroduction(matchId);
      setIntroDraft(response.data.draft);
      setIntroModal(true);
    } catch (error) {
      console.error('Error drafting introduction:', error);
      alert('Failed to draft introduction.');
    } finally {
      setDraftingIntro(null);
    }
  };

  const handleMatchStatusUpdate = async (matchId: string, newStatus: string) => {
    setUpdatingMatchStatus(matchId);
    try {
      await placementAPI.updateMatchStatus(matchId, newStatus);
      // Refresh matches
      if (selectedFellowForMatches) {
        const res = await placementAPI.getFellowMatches(selectedFellowForMatches);
        setMatches(res.data);
      }
    } catch (error) {
      console.error('Error updating match status:', error);
    } finally {
      setUpdatingMatchStatus(null);
    }
  };

  const resetOppForm = () => {
    setEditingOpp(null);
    setOppForm({
      title: '',
      employer_name: '',
      employer_contact_email: '',
      description: '',
      requirements: '',
      preferred_skills: '',
      experience_level: 'entry',
      location: '',
      remote_ok: true,
    });
  };

  const getNextStatus = (current: string) => {
    const idx = MATCH_STATUS_ORDER.indexOf(current);
    if (idx >= 0 && idx < MATCH_STATUS_ORDER.length - 1) {
      return MATCH_STATUS_ORDER[idx + 1];
    }
    return null;
  };

  // Filtered data
  const filteredFellows = useMemo(() => {
    if (!searchQuery) return fellows;
    const q = searchQuery.toLowerCase();
    return fellows.filter(f =>
      f.name.toLowerCase().includes(q) || f.role.toLowerCase().includes(q)
    );
  }, [fellows, searchQuery]);

  const fellowsWithProfiles = filteredFellows.filter(f =>
    profiles.some(p => p.fellow_id === f.id)
  );
  const fellowsWithoutProfiles = filteredFellows.filter(f =>
    !profiles.some(p => p.fellow_id === f.id)
  );

  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;
    if (oppStatusFilter && oppStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === oppStatusFilter);
    }
    if (oppSearchQuery) {
      const q = oppSearchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.title.toLowerCase().includes(q) || o.employer_name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [opportunities, oppStatusFilter, oppSearchQuery]);

  const fellowsWithProfilesList = fellows.filter(f => profiles.some(p => p.fellow_id === f.id));

  const stats = useMemo(() => ({
    profiles: profiles.length,
    activeOpps: opportunities.filter(o => o.status === 'active').length,
    totalMatches: matches.length,
    introsSent: matches.filter(m => m.introduction_sent).length,
  }), [profiles, opportunities, matches]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Placement Management</h1>
            <p className="mt-1 text-gray-600">
              Generate profiles, match opportunities, and manage job placements
            </p>
          </div>
          <select
            value={selectedCohortId}
            onChange={(e) => { setSelectedCohortId(e.target.value); setLoading(true); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Cohorts</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Profiles', value: stats.profiles, icon: User, color: 'text-purple-600', bg: 'bg-purple-100' },
            { label: 'Active Opportunities', value: stats.activeOpps, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Total Matches', value: stats.totalMatches, icon: Target, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Intros Sent', value: stats.introsSent, icon: Send, color: 'text-teal-600', bg: 'bg-teal-100' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Card padding={false}>
          <div className="px-6 pt-6">
            <Tabs value={activeTab} onValueChange={() => {}}>
              <TabsList>
                <TabsTrigger value="profiles" active={activeTab === 'profiles'} onClick={() => setActiveTab('profiles')}>
                  <User className="mr-2 h-4 w-4" />
                  Profiles
                </TabsTrigger>
                <TabsTrigger value="opportunities" active={activeTab === 'opportunities'} onClick={() => setActiveTab('opportunities')}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Opportunities
                </TabsTrigger>
                <TabsTrigger value="matches" active={activeTab === 'matches'} onClick={() => setActiveTab('matches')}>
                  <Target className="mr-2 h-4 w-4" />
                  Matches
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Profiles Tab */}
          <TabsContent value="profiles" activeValue={activeTab}>
            <CardContent className="px-0">
              <div className="px-6 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search fellows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {filteredFellows.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows found</h3>
                  <p className="mt-1 text-sm text-gray-500">Fellows will appear here once they join the program.</p>
                </div>
              ) : (
                <div className="space-y-6 px-6 pb-6">
                  {fellowsWithoutProfiles.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Needs Profile Generation ({fellowsWithoutProfiles.length})
                      </h3>
                      <div className="space-y-3">
                        {fellowsWithoutProfiles.map((fellow) => (
                          <div key={fellow.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{fellow.name}</p>
                              <p className="text-sm text-gray-600 capitalize">{fellow.role.replace('_', ' ')}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleGenerateProfile(fellow.id)}
                              disabled={generating === fellow.id}
                            >
                              {generating === fellow.id ? 'Generating...' : (
                                <><Sparkles className="mr-1 h-4 w-4" /> Generate Profile</>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fellowsWithProfiles.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Profiles Ready ({fellowsWithProfiles.length})
                      </h3>
                      <div className="space-y-3">
                        {fellowsWithProfiles.map((fellow) => {
                          const profile = profiles.find(p => p.fellow_id === fellow.id);
                          return (
                            <div key={fellow.id} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">{fellow.name}</p>
                                <p className="text-sm text-gray-600 capitalize">{fellow.role.replace('_', ' ')}</p>
                                {profile?.headline && (
                                  <p className="text-sm text-gray-500 mt-1 truncate">{profile.headline}</p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => handleViewProfile(fellow.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleGenerateProfile(fellow.id)}
                                  disabled={generating === fellow.id}
                                >
                                  <RefreshCw className={`h-4 w-4 ${generating === fellow.id ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMatchOpportunities(fellow.id)}
                                  disabled={matching === fellow.id}
                                >
                                  {matching === fellow.id ? 'Matching...' : (
                                    <><Target className="mr-1 h-4 w-4" /> Match Jobs</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities" activeValue={activeTab}>
            <CardContent className="px-0">
              <div className="px-6 pb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by title or employer..."
                    value={oppSearchQuery}
                    onChange={(e) => setOppSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={oppStatusFilter}
                  onChange={(e) => setOppStatusFilter(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="filled">Filled</option>
                  <option value="closed">Closed</option>
                </select>
                <Button size="sm" onClick={() => { resetOppForm(); setOppModal(true); }}>
                  <Plus className="mr-1 h-4 w-4" /> Add Opportunity
                </Button>
              </div>

              {filteredOpportunities.length === 0 ? (
                <div className="py-12 text-center">
                  <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No opportunities</h3>
                  <p className="mt-1 text-sm text-gray-500">Create a job opportunity to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Employer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOpportunities.map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell><span className="font-medium">{opp.title}</span></TableCell>
                        <TableCell>{opp.employer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            {opp.remote_ok && <Globe className="h-3 w-3" />}
                            {opp.location || (opp.remote_ok ? 'Remote' : '—')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-sm">{opp.experience_level || '—'}</span>
                        </TableCell>
                        <TableCell>
                          {opp.requirements && opp.requirements.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {opp.requirements.slice(0, 2).map((skill, idx) => (
                                <Badge key={idx} variant="default">{skill}</Badge>
                              ))}
                              {opp.requirements.length > 2 && (
                                <Badge variant="default">+{opp.requirements.length - 2}</Badge>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={opp.status === 'active' ? 'success' : opp.status === 'filled' ? 'info' : 'default'}>
                            {opp.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditOpp(opp)}>Edit</Button>
                            {opp.status === 'active' && (
                              <Button size="sm" variant="ghost" onClick={() => handleOppStatus(opp.id, 'closed')}>Close</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches" activeValue={activeTab}>
            <CardContent className="px-0">
              <div className="px-6 pb-4">
                <select
                  value={selectedFellowForMatches}
                  onChange={(e) => setSelectedFellowForMatches(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-auto"
                >
                  <option value="">Select a fellow...</option>
                  {fellowsWithProfilesList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} — {f.role.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {!selectedFellowForMatches ? (
                <div className="py-12 text-center">
                  <Target className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Select a fellow</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose a fellow above to view their matches, or generate matches from the Profiles tab.
                  </p>
                </div>
              ) : matches.length === 0 ? (
                <div className="py-12 text-center">
                  <Target className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No matches yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the &quot;Match Jobs&quot; button on the Profiles tab to generate matches.
                  </p>
                </div>
              ) : (
                <div className="px-6 pb-6 space-y-4">
                  {matches.map((match) => {
                    const nextStatus = getNextStatus(match.status);
                    return (
                      <div key={match.match_id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-gray-900">
                                {match.opportunity_title || 'Opportunity'}
                              </h4>
                              {match.employer_name && (
                                <span className="text-sm text-gray-500">at {match.employer_name}</span>
                              )}
                              <Badge variant={match.match_score >= 80 ? 'success' : match.match_score >= 60 ? 'info' : 'warning'}>
                                {match.match_score}% Match
                              </Badge>
                              <Badge variant={(MATCH_STATUS_COLORS[match.status] || 'default') as any}>
                                {match.status}
                              </Badge>
                            </div>
                            {match.match_reasoning && (
                              <p className="text-sm text-gray-600 mt-2">{match.match_reasoning}</p>
                            )}
                            {match.skill_gaps && match.skill_gaps.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-gray-500">Skill Gaps:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {match.skill_gaps.map((gap, idx) => (
                                    <Badge key={idx} variant="warning">{gap}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {nextStatus && match.status !== 'hired' && match.status !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleMatchStatusUpdate(match.match_id, nextStatus)}
                                disabled={updatingMatchStatus === match.match_id}
                              >
                                <ArrowRight className="mr-1 h-3 w-3" />
                                {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                              </Button>
                            )}
                            {!match.introduction_sent && match.status !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDraftIntro(match.match_id)}
                                disabled={draftingIntro === match.match_id}
                              >
                                {draftingIntro === match.match_id ? '...' : (
                                  <><Mail className="mr-1 h-3 w-3" /> Draft Intro</>
                                )}
                              </Button>
                            )}
                            {match.introduction_sent && (
                              <Badge variant="success">Intro Sent</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Card>

        {/* Profile Detail Modal */}
        <Modal open={profileModal} onOpenChange={setProfileModal} title="Fellow Profile" size="lg">
          {selectedProfile && (
            <div className="space-y-5">
              {selectedProfile.headline && (
                <div>
                  <p className="text-lg font-semibold text-gray-900">{selectedProfile.headline}</p>
                </div>
              )}

              {selectedProfile.summary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Professional Summary</h4>
                  <p className="text-sm text-gray-700">{selectedProfile.summary}</p>
                </div>
              )}

              {selectedProfile.skills && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Skills</h4>
                  <div className="space-y-2">
                    {Array.isArray(selectedProfile.skills) ? (
                      selectedProfile.skills.map((skill: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge variant="info">{typeof skill === 'string' ? skill : skill.name || skill.skill}</Badge>
                          {skill.proficiency && (
                            <span className="text-xs text-gray-500 capitalize">{skill.proficiency}</span>
                          )}
                          {skill.evidence && (
                            <span className="text-xs text-gray-400">— {skill.evidence}</span>
                          )}
                        </div>
                      ))
                    ) : typeof selectedProfile.skills === 'object' ? (
                      Object.entries(selectedProfile.skills).map(([category, skills]: [string, any]) => (
                        <div key={category}>
                          <p className="text-xs font-medium text-gray-600 capitalize mb-1">{category}</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(skills) && skills.map((s: any, idx: number) => (
                              <Badge key={idx} variant="info">{typeof s === 'string' ? s : s.name || JSON.stringify(s)}</Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>
              )}

              {selectedProfile.projects && Array.isArray(selectedProfile.projects) && selectedProfile.projects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Projects</h4>
                  <div className="space-y-3">
                    {selectedProfile.projects.map((project: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-sm text-gray-900">{project.name || `Project ${idx + 1}`}</p>
                        {project.description && <p className="text-sm text-gray-600 mt-1">{project.description}</p>}
                        {project.technologies && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.technologies.map((tech: string, i: number) => (
                              <Badge key={i} variant="default">{tech}</Badge>
                            ))}
                          </div>
                        )}
                        {project.contribution && <p className="text-xs text-gray-500 mt-1">{project.contribution}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedProfile.linkedin_summary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">LinkedIn Summary</h4>
                  <p className="text-sm text-gray-700 italic">{selectedProfile.linkedin_summary}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setProfileModal(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Opportunity Create/Edit Modal */}
        <Modal
          open={oppModal}
          onOpenChange={(open) => { setOppModal(open); if (!open) resetOppForm(); }}
          title={editingOpp ? 'Edit Opportunity' : 'Add Opportunity'}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={oppForm.title}
                  onChange={(e) => setOppForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Junior Frontend Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer *</label>
                <input
                  type="text"
                  value={oppForm.employer_name}
                  onChange={(e) => setOppForm(f => ({ ...f, employer_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acme Corp"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={oppForm.employer_contact_email}
                  onChange={(e) => setOppForm(f => ({ ...f, employer_contact_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="hr@acme.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                <select
                  value={oppForm.experience_level}
                  onChange={(e) => setOppForm(f => ({ ...f, experience_level: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {EXPERIENCE_LEVELS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={oppForm.location}
                  onChange={(e) => setOppForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Lagos, Nigeria"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={oppForm.remote_ok}
                    onChange={(e) => setOppForm(f => ({ ...f, remote_ok: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  Remote OK
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={oppForm.description}
                onChange={(e) => setOppForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Job description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requirements (comma-separated)</label>
              <input
                type="text"
                value={oppForm.requirements}
                onChange={(e) => setOppForm(f => ({ ...f, requirements: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., React, TypeScript, REST APIs"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Skills (comma-separated)</label>
              <input
                type="text"
                value={oppForm.preferred_skills}
                onChange={(e) => setOppForm(f => ({ ...f, preferred_skills: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Next.js, Tailwind, Testing"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => { setOppModal(false); resetOppForm(); }}>Cancel</Button>
              <Button
                onClick={handleSaveOpportunity}
                disabled={savingOpp || !oppForm.title || !oppForm.employer_name}
              >
                {savingOpp ? 'Saving...' : (editingOpp ? 'Update' : 'Create')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Introduction Draft Modal */}
        <Modal open={introModal} onOpenChange={setIntroModal} title="Introduction Draft" size="lg">
          {introDraft && (
            <div className="space-y-4">
              {introDraft.email_subject && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Subject</h4>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">{introDraft.email_subject}</p>
                </div>
              )}

              {(introDraft.email_body || introDraft.email) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Email Body</h4>
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                    {introDraft.email_body || introDraft.email}
                  </div>
                </div>
              )}

              {introDraft.talking_points && introDraft.talking_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Talking Points</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {introDraft.talking_points.map((point: string, idx: number) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {introDraft.fellow_prep_notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Fellow Prep Notes</h4>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">{introDraft.fellow_prep_notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setIntroModal(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
