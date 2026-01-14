'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { fellowsAPI, placementAPI } from '@/lib/api';
import {
  Briefcase,
  User,
  Sparkles,
  Mail,
  ExternalLink,
  Target,
} from 'lucide-react';
import type { Fellow, Profile, JobOpportunity, PlacementMatch } from '@/types';

export default function PlacementPage() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'opportunities' | 'matches'>('profiles');
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [opportunities, setOpportunities] = useState<JobOpportunity[]>([]);
  const [matches, setMatches] = useState<PlacementMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [matching, setMatching] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [fellowsRes, profilesRes, oppsRes] = await Promise.all([
        fellowsAPI.list(),
        placementAPI.listProfiles(),
        placementAPI.listOpportunities('open'),
      ]);

      setFellows(fellowsRes.data);
      setProfiles(profilesRes.data);
      setOpportunities(oppsRes.data);
    } catch (error) {
      console.error('Error fetching placement data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      setActiveTab('matches');
    } catch (error) {
      console.error('Error matching opportunities:', error);
      alert('Failed to match opportunities. Ensure fellow has a profile first.');
    } finally {
      setMatching(null);
    }
  };

  // Find fellows with/without profiles
  const fellowsWithProfiles = fellows.filter(f =>
    profiles.some(p => p.fellow_id === f.id)
  );
  const fellowsWithoutProfiles = fellows.filter(f =>
    !profiles.some(p => p.fellow_id === f.id)
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Placement Management</h1>
        <p className="mt-2 text-gray-600">
          Generate profiles, match opportunities, and manage job placements
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Profiles Generated</p>
              <p className="text-2xl font-bold text-purple-600">{profiles.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Open Opportunities</p>
              <p className="text-2xl font-bold text-blue-600">{opportunities.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Matches</p>
              <p className="text-2xl font-bold text-green-600">{matches.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card padding={false}>
        <div className="px-6 pt-6">
          <Tabs value={activeTab} onValueChange={() => {}}>
            <TabsList>
              <TabsTrigger
                value="profiles"
                active={activeTab === 'profiles'}
                onClick={() => setActiveTab('profiles')}
              >
                <User className="mr-2 h-4 w-4" />
                Profiles
              </TabsTrigger>
              <TabsTrigger
                value="opportunities"
                active={activeTab === 'opportunities'}
                onClick={() => setActiveTab('opportunities')}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Opportunities
              </TabsTrigger>
              <TabsTrigger
                value="matches"
                active={activeTab === 'matches'}
                onClick={() => setActiveTab('matches')}
              >
                <Target className="mr-2 h-4 w-4" />
                Matches
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Profiles Tab */}
        <TabsContent value="profiles" activeValue={activeTab}>
          <CardContent className="px-0">
            {fellows.length === 0 ? (
              <div className="py-12 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Fellows will appear here once they complete the program.
                </p>
              </div>
            ) : (
              <div className="space-y-6 px-6 pb-6">
                {/* Fellows without profiles */}
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
                            {generating === fellow.id ? (
                              'Generating...'
                            ) : (
                              <>
                                <Sparkles className="mr-1 h-4 w-4" />
                                Generate Profile
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fellows with profiles */}
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
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{fellow.name}</p>
                              <p className="text-sm text-gray-600 capitalize">{fellow.role.replace('_', ' ')}</p>
                              {profile && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {profile.summary.substring(0, 100)}...
                                </p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleMatchOpportunities(fellow.id)}
                                disabled={matching === fellow.id}
                              >
                                {matching === fellow.id ? (
                                  'Matching...'
                                ) : (
                                  <>
                                    <Target className="mr-1 h-4 w-4" />
                                    Match Jobs
                                  </>
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
            {opportunities.length === 0 ? (
              <div className="py-12 text-center">
                <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No opportunities yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Job opportunities will appear here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required Skills</TableHead>
                    <TableHead>Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.title}</TableCell>
                      <TableCell>{opp.company}</TableCell>
                      <TableCell>{opp.location || 'Remote'}</TableCell>
                      <TableCell>
                        <Badge variant="info">{opp.job_type || 'Full-time'}</Badge>
                      </TableCell>
                      <TableCell>
                        {opp.required_skills && opp.required_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {opp.required_skills.slice(0, 3).map((skill, idx) => (
                              <Badge key={idx} variant="default">{skill}</Badge>
                            ))}
                            {opp.required_skills.length > 3 && (
                              <Badge variant="default">+{opp.required_skills.length - 3}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {opp.posted_date ? new Date(opp.posted_date).toLocaleDateString() : '-'}
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
            {matches.length === 0 ? (
              <div className="py-12 text-center">
                <Target className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No matches yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Generate matches from the Profiles tab to see results here.
                </p>
              </div>
            ) : (
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div key={match.match_id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium text-gray-900">{match.opportunity_id}</h4>
                            <Badge variant={match.match_score >= 80 ? 'success' : match.match_score >= 60 ? 'info' : 'warning'}>
                              {match.match_score}% Match
                            </Badge>
                          </div>
                          {match.ai_reasoning && (
                            <p className="text-sm text-gray-600 mt-2">{match.ai_reasoning}</p>
                          )}
                          {match.skill_gaps && match.skill_gaps.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-700">Skill Gaps:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {match.skill_gaps.map((gap, idx) => (
                                  <Badge key={idx} variant="warning" className="text-xs">{gap}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {!match.introduction_sent && (
                            <Button size="sm" variant="secondary">
                              <Mail className="mr-1 h-4 w-4" />
                              Draft Intro
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Card>

      {/* Profile Modal */}
      <Modal
        open={profileModal}
        onOpenChange={setProfileModal}
        title="Generated Profile"
        size="lg"
      >
        {selectedProfile && (
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Professional Summary</h4>
              <p className="text-sm text-gray-700">{selectedProfile.summary}</p>
            </div>

            {/* Skills */}
            {selectedProfile.skills && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedProfile.skills).map(([category, skills]: [string, any]) => (
                    <div key={category} className="w-full">
                      <p className="text-xs font-medium text-gray-600 capitalize mb-1">{category}</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(skills) && skills.map((skill, idx) => (
                          <Badge key={idx} variant="info">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setProfileModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
