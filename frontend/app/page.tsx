'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI, screeningAPI, healthAPI } from '@/lib/api';
import {
  Users,
  ClipboardCheck,
  AlertCircle,
  DollarSign,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { Applicant, QueueStats, HealthCheck } from '@/types';

export default function Dashboard() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [applicantsRes, queueRes, healthRes] = await Promise.all([
        applicantsAPI.list(),
        screeningAPI.getQueue(),
        healthAPI.check(),
      ]);

      setApplicants(applicantsRes.data);
      setQueueStats(queueRes.data);
      setHealth(healthRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      name: 'Total Applicants',
      value: applicants.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'In Screening',
      value: queueStats?.total_in_queue || 0,
      icon: ClipboardCheck,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Require Review',
      value: queueStats?.requires_review || 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      name: 'AI Cost (Est.)',
      value: '$0.01',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  const recentApplicants = applicants.slice(0, 5);

  return (
    <ProtectedRoute>
      <AppLayout>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to the MentorLed AI-Ops Platform
          </p>
        </div>

        {/* System Health */}
        {health && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">System Status</p>
                  <p className="text-sm text-gray-600">{health.service} - v{health.version}</p>
                </div>
              </div>
              <Badge variant="success">{health.status}</Badge>
            </div>
          </Card>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.name}>
                <div className="flex items-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Applicants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Applicants</CardTitle>
                <Link href="/applicants">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentApplicants.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">No applicants yet</p>
              ) : (
                <div className="space-y-4">
                  {recentApplicants.map((applicant) => (
                    <div key={applicant.id} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-gray-900">{applicant.name}</p>
                        <p className="text-sm text-gray-600">{applicant.role.replace('_', ' ')}</p>
                      </div>
                      <Badge variant={applicant.status === 'accepted' ? 'success' : 'default'}>
                        {applicant.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/screening" className="block">
                  <Button variant="primary" className="w-full justify-start">
                    <ClipboardCheck className="mr-2 h-5 w-5" />
                    Review Screening Queue
                  </Button>
                </Link>
                <Link href="/applicants" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    <Users className="mr-2 h-5 w-5" />
                    Manage Applicants
                  </Button>
                </Link>
                <Link href="/fellows" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    View Fellows
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Screening Queue Summary */}
        {queueStats && (
          <Card>
            <CardHeader>
              <CardTitle>Screening Queue Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-900">Pending Applications</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">{queueStats.pending_applications}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-4">
                  <p className="text-sm font-medium text-yellow-900">Pending Microships</p>
                  <p className="mt-1 text-3xl font-bold text-yellow-600">{queueStats.pending_microships}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-900">Requires Review</p>
                  <p className="mt-1 text-3xl font-bold text-red-600">{queueStats.requires_review}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
