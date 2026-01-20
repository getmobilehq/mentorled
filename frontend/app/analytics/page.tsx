'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { analyticsAPI } from '@/lib/api';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface AnalyticsDashboard {
  applicants: {
    total: number;
    by_status: Record<string, number>;
    by_role: Record<string, number>;
    by_source: Record<string, number>;
  };
  fellows: {
    total: number;
    by_status: Record<string, number>;
    by_risk_level: Record<string, number>;
    average_milestone_1: number;
    average_milestone_2: number;
  };
  evaluations: {
    total: number;
    by_outcome: Record<string, number>;
    average_score: number;
    average_confidence: number;
    human_review_rate: number;
  };
  risk_assessments: {
    total_assessments: number;
    by_risk_level: Record<string, number>;
  };
  ai_usage: {
    total_ai_calls_30d: number;
    total_cost_30d_usd: number;
    average_cost_per_call: number;
  };
  generated_at: string;
}

interface ConversionFunnel {
  applied: number;
  screening: number;
  eligible: number;
  microship_submitted: number;
  microship_evaluated: number;
  accepted: number;
  not_eligible: number;
  conversion_rate: number;
}

interface AIPerformance {
  total_evaluations: number;
  confidence_distribution: {
    'high (>= 80%)': number;
    'medium (60-79%)': number;
    'low (< 60%)': number;
  };
  human_override_count: number;
  human_override_rate: number;
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [aiPerformance, setAIPerformance] = useState<AIPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [dashboardRes, funnelRes, aiPerfRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getConversionFunnel(),
        analyticsAPI.getAIPerformance(),
      ]);

      setDashboard(dashboardRes.data);
      setFunnel(funnelRes.data);
      setAIPerformance(aiPerfRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading analytics...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Comprehensive metrics and insights across the platform
            </p>
            {dashboard && (
              <p className="mt-1 text-sm text-gray-500">
                Last updated: {new Date(dashboard.generated_at).toLocaleString()}
              </p>
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Applicants</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard?.applicants.total || 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Fellows</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard?.fellows.total || 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">AI Evaluations</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard?.evaluations.total || 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">AI Cost (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${dashboard?.ai_usage.total_cost_30d_usd.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Conversion Funnel */}
          {funnel && (
            <Card>
              <CardHeader>
                <CardTitle>Application Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Applied</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{funnel.applied}</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm font-medium text-yellow-900">Screening</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-600">{funnel.screening}</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-900">Eligible</p>
                      <p className="mt-1 text-2xl font-bold text-purple-600">{funnel.eligible}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-900">Accepted</p>
                      <p className="mt-1 text-2xl font-bold text-green-600">{funnel.accepted}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center pt-4">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        {funnel.conversion_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Applicant Breakdown */}
            {dashboard && (
              <Card>
                <CardHeader>
                  <CardTitle>Applicants by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(dashboard.applicants.by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {status.replace('_', ' ')}
                        </span>
                        <Badge variant="default">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fellows Risk Levels */}
            {dashboard && (
              <Card>
                <CardHeader>
                  <CardTitle>Fellows by Risk Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(dashboard.fellows.by_risk_level).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {level.replace('_', ' ')}
                        </span>
                        <Badge
                          variant={
                            level === 'critical' ? 'danger' :
                            level === 'at_risk' ? 'warning' :
                            level === 'on_track' ? 'success' : 'default'
                          }
                        >
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Performance Metrics */}
          {aiPerformance && dashboard && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI Confidence Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(aiPerformance.confidence_distribution).map(([level, count]) => (
                      <div key={level}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{level}</span>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              level.includes('high') ? 'bg-green-500' :
                              level.includes('medium') ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{
                              width: `${(count / aiPerformance.total_evaluations) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Average Score</span>
                      <span className="text-lg font-bold text-gray-900">
                        {dashboard.evaluations.average_score.toFixed(1)}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Average Confidence</span>
                      <span className="text-lg font-bold text-gray-900">
                        {(dashboard.evaluations.average_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Human Review Rate</span>
                      <span className="text-lg font-bold text-gray-900">
                        {dashboard.evaluations.human_review_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Human Override Rate</span>
                      <span className="text-lg font-bold text-gray-900">
                        {aiPerformance.human_override_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Usage & Costs */}
          {dashboard && (
            <Card>
              <CardHeader>
                <CardTitle>AI Usage & Cost Metrics (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Total AI Calls</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">
                      {dashboard.ai_usage.total_ai_calls_30d}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">Total Cost</p>
                    <p className="mt-1 text-2xl font-bold text-green-600">
                      ${dashboard.ai_usage.total_cost_30d_usd.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-900">Avg Cost/Call</p>
                    <p className="mt-1 text-2xl font-bold text-purple-600">
                      ${dashboard.ai_usage.average_cost_per_call.toFixed(4)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
