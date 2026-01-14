'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { riskAPI, cohortsAPI } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Shield,
} from 'lucide-react';
import type { Cohort } from '@/types';

interface RiskDashboardData {
  summary: {
    on_track: number;
    monitor: number;
    at_risk: number;
    critical: number;
  };
  fellows: Array<{
    id: string;
    name: string;
    role: string;
    team_id?: string | null;
    risk_level: string;
    risk_score: number;
    warnings_count: number;
    milestone_1_score?: number | null;
    milestone_2_score?: number | null;
  }>;
}

export default function RiskDashboardPage() {
  const [dashboardData, setDashboardData] = useState<RiskDashboardData | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'on_track' | 'monitor' | 'at_risk' | 'critical'>('all');

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    if (selectedCohortId) {
      fetchDashboard();
    }
  }, [selectedCohortId, currentWeek]);

  const fetchCohorts = async () => {
    try {
      const response = await cohortsAPI.list();
      const cohortsList = response.data;
      setCohorts(cohortsList);

      if (cohortsList.length > 0) {
        setSelectedCohortId(cohortsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchDashboard = async () => {
    if (!selectedCohortId) return;

    setLoading(true);
    try {
      const response = await riskAPI.getDashboard(selectedCohortId, currentWeek);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching risk dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'on_track':
        return 'success';
      case 'monitor':
        return 'warning';
      case 'at_risk':
        return 'danger';
      case 'critical':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'on_track':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'monitor':
        return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      case 'at_risk':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatRiskLevel = (level: string) => {
    return level.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Filter fellows
  const filteredFellows = dashboardData?.fellows.filter(fellow => {
    if (filter === 'all') return true;
    return fellow.risk_level === filter;
  }) || [];

  if (loading && !dashboardData) {
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
          <h1 className="text-3xl font-bold text-gray-900">Risk Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor fellow risk levels and take proactive action
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cohort
          </label>
          <select
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
          >
            {cohorts.map(cohort => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Week
          </label>
          <input
            type="number"
            min="1"
            max="12"
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentWeek}
            onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
          />
        </div>

        <div className="ml-auto flex items-end">
          <Button onClick={fetchDashboard} size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {dashboardData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('on_track')}>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600">On Track</p>
                </div>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {dashboardData.summary.on_track}
                </p>
              </div>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('monitor')}>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-yellow-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600">Monitor</p>
                </div>
                <p className="mt-2 text-3xl font-bold text-yellow-600">
                  {dashboardData.summary.monitor}
                </p>
              </div>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('at_risk')}>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600">At Risk</p>
                </div>
                <p className="mt-2 text-3xl font-bold text-orange-600">
                  {dashboardData.summary.at_risk}
                </p>
              </div>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('critical')}>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Shield className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600">Critical</p>
                </div>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {dashboardData.summary.critical}
                </p>
              </div>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({dashboardData.fellows.length})
            </Button>
            <Button
              variant={filter === 'on_track' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('on_track')}
            >
              On Track ({dashboardData.summary.on_track})
            </Button>
            <Button
              variant={filter === 'monitor' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('monitor')}
            >
              Monitor ({dashboardData.summary.monitor})
            </Button>
            <Button
              variant={filter === 'at_risk' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('at_risk')}
            >
              At Risk ({dashboardData.summary.at_risk})
            </Button>
            <Button
              variant={filter === 'critical' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('critical')}
            >
              Critical ({dashboardData.summary.critical})
            </Button>
          </div>

          {/* Fellows Table */}
          <Card padding={false}>
            <CardHeader className="px-6 pt-6">
              <CardTitle>Fellows</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {filteredFellows.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No fellows</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter === 'all'
                      ? 'No fellows found in this cohort.'
                      : `No fellows in "${formatRiskLevel(filter)}" category.`}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Milestone 1</TableHead>
                      <TableHead>Milestone 2</TableHead>
                      <TableHead>Warnings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFellows.map((fellow) => (
                      <TableRow key={fellow.id}>
                        <TableCell className="font-medium">
                          {fellow.name}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {fellow.role.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {fellow.team_id ? (
                            <Badge variant="secondary">Team {fellow.team_id.slice(0, 8)}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getRiskIcon(fellow.risk_level)}
                            <Badge variant={getRiskBadgeVariant(fellow.risk_level)}>
                              {formatRiskLevel(fellow.risk_level)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  fellow.risk_score < 0.25 ? 'bg-green-600' :
                                  fellow.risk_score < 0.50 ? 'bg-yellow-600' :
                                  fellow.risk_score < 0.75 ? 'bg-orange-600' :
                                  'bg-red-600'
                                }`}
                                style={{ width: `${fellow.risk_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold">
                              {fellow.risk_score.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {fellow.milestone_1_score !== null && fellow.milestone_1_score !== undefined ? (
                            <span className={`font-semibold ${
                              fellow.milestone_1_score >= 3 ? 'text-green-600' :
                              fellow.milestone_1_score >= 2.5 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {fellow.milestone_1_score.toFixed(1)}/4
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {fellow.milestone_2_score !== null && fellow.milestone_2_score !== undefined ? (
                            <span className={`font-semibold ${
                              fellow.milestone_2_score >= 3 ? 'text-green-600' :
                              fellow.milestone_2_score >= 2.5 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {fellow.milestone_2_score.toFixed(1)}/4
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {fellow.warnings_count > 0 ? (
                            <Badge variant="danger">
                              {fellow.warnings_count}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // Navigate to fellow detail or open modal
                              console.log('View fellow:', fellow.id);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
