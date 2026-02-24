'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cohortsAPI, reportsAPI } from '@/lib/api';
import {
  FileText, Download, BarChart3, Users, ShieldAlert,
  TrendingUp, Calendar, CheckCircle,
} from 'lucide-react';

interface Cohort {
  id: string;
  name: string;
  status: string;
}

interface ReportData {
  cohort: { id: string; name: string; status: string; start_date: string; end_date: string };
  summary: {
    total_applicants: number;
    total_fellows: number;
    evaluations_completed: number;
    sprints_total: number;
    sprints_completed: number;
    attendance_rate: number;
    total_check_ins: number;
  };
  pipeline: Record<string, number>;
  risk_distribution: Record<string, number>;
  fellow_status: Record<string, number>;
  milestones: {
    m1_avg: number | null; m1_count: number;
    m2_avg: number | null; m2_count: number;
    m3_avg: number | null; m3_count: number;
    final_avg: number | null; final_count: number;
  };
  fellows: {
    id: string; name: string; email: string; role: string; status: string;
    risk_level: string; risk_score: number;
    m1: number | null; m2: number | null; m3: number | null; final: number | null;
    warnings: number;
  }[];
  generated_at: string;
}

const RISK_COLORS: Record<string, string> = {
  on_track: 'bg-green-500',
  monitor: 'bg-yellow-500',
  at_risk: 'bg-red-500',
  critical: 'bg-red-800',
};

const RISK_LABELS: Record<string, string> = {
  on_track: 'On Track',
  monitor: 'Monitor',
  at_risk: 'At Risk',
  critical: 'Critical',
};

export default function ReportsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await cohortsAPI.list();
        setCohorts(res.data);
        if (res.data.length > 0) setSelectedCohort(res.data[0].id);
      } catch { /* */ }
    })();
  }, []);

  const generateReport = useCallback(async () => {
    if (!selectedCohort) return;
    setLoading(true);
    try {
      const res = await reportsAPI.stakeholder(selectedCohort);
      setReport(res.data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  const handleDownload = async (type: 'csv' | 'pdf') => {
    if (!selectedCohort) return;
    setDownloading(type);
    try {
      const res = type === 'csv'
        ? await reportsAPI.downloadCsv(selectedCohort)
        : await reportsAPI.downloadPdf(selectedCohort);

      const blob = new Blob([res.data], {
        type: type === 'csv' ? 'text/csv' : 'text/html',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cohort_report.${type === 'csv' ? 'csv' : 'html'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* */ } finally {
      setDownloading('');
    }
  };

  const totalRisk = report
    ? Object.values(report.risk_distribution).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Generate and export cohort reports for stakeholders</p>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Cohort</label>
              <select
                value={selectedCohort}
                onChange={(e) => { setSelectedCohort(e.target.value); setReport(null); }}
                className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">Choose a cohort...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Button size="sm" onClick={generateReport} disabled={!selectedCohort || loading}>
                <BarChart3 className="h-4 w-4 mr-1" />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button
                size="sm" variant="secondary"
                onClick={() => handleDownload('csv')}
                disabled={!selectedCohort || downloading === 'csv'}
              >
                <Download className="h-4 w-4 mr-1" />
                {downloading === 'csv' ? 'Downloading...' : 'CSV'}
              </Button>
              <Button
                size="sm" variant="secondary"
                onClick={() => handleDownload('pdf')}
                disabled={!selectedCohort || downloading === 'pdf'}
              >
                <FileText className="h-4 w-4 mr-1" />
                {downloading === 'pdf' ? 'Downloading...' : 'PDF Report'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Report display */}
        {report && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{report.summary.total_applicants}</p>
                    <p className="text-xs text-gray-500">Total Applicants</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{report.summary.total_fellows}</p>
                    <p className="text-xs text-gray-500">Active Fellows</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{report.summary.attendance_rate}%</p>
                    <p className="text-xs text-gray-500">Attendance Rate</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{report.summary.sprints_completed}/{report.summary.sprints_total}</p>
                    <p className="text-xs text-gray-500">Sprints Completed</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Risk Distribution + Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Risk */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">Risk Distribution</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(report.risk_distribution).map(([level, count]) => {
                    const pct = totalRisk > 0 ? (count / totalRisk * 100) : 0;
                    return (
                      <div key={level}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{RISK_LABELS[level] || level}</span>
                          <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${RISK_COLORS[level] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Milestones */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">Milestone Averages</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Milestone 1', avg: report.milestones.m1_avg, count: report.milestones.m1_count },
                    { label: 'Milestone 2', avg: report.milestones.m2_avg, count: report.milestones.m2_count },
                    { label: 'Milestone 3', avg: report.milestones.m3_avg, count: report.milestones.m3_count },
                    { label: 'Final Score', avg: report.milestones.final_avg, count: report.milestones.final_count },
                  ].map(m => (
                    <div key={m.label} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{m.label}</p>
                        <p className="text-xs text-gray-400">{m.count} fellows scored</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {m.avg !== null ? m.avg.toFixed(2) : 'N/A'}
                        </p>
                        {m.avg !== null && (
                          <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                            <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.min(m.avg / 4 * 100, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Pipeline */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Applicant Pipeline</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(report.pipeline).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700 capitalize">{status.replace(/_/g, ' ')}</span>
                    <Badge variant="default">{count}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Fellows Table */}
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Fellow Details</h3>
                <p className="text-xs text-gray-500 mt-1">{report.fellows.length} fellows</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Fellow</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Risk</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">M1</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">M2</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">M3</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Final</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Warns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.fellows.map(f => (
                      <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{f.name}</p>
                          <p className="text-xs text-gray-500">{f.email}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-600 capitalize">{f.role}</td>
                        <td className="py-3 px-4">
                          <Badge variant="default">{f.status.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={f.risk_level === 'on_track' ? 'success' : f.risk_level === 'critical' ? 'danger' : 'warning'}>
                            {RISK_LABELS[f.risk_level] || f.risk_level}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">{f.m1 ?? '-'}</td>
                        <td className="py-3 px-4 text-center text-gray-600">{f.m2 ?? '-'}</td>
                        <td className="py-3 px-4 text-center text-gray-600">{f.m3 ?? '-'}</td>
                        <td className="py-3 px-4 text-center font-semibold text-gray-900">{f.final ?? '-'}</td>
                        <td className="py-3 px-4 text-center text-gray-600">{f.warnings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="text-xs text-gray-400 text-right">
              Report generated at {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
