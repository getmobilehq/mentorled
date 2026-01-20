'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI, bulkAPI } from '@/lib/api';
import {
  Upload,
  Download,
  Play,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Users,
} from 'lucide-react';
import type { Applicant } from '@/types';

export default function BulkOperationsPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchApplicants();
  }, []);

  const fetchApplicants = async () => {
    try {
      const response = await applicantsAPI.list();
      setApplicants(response.data);
    } catch (error) {
      console.error('Error fetching applicants:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applicants.map(a => a.id)));
    }
  };

  const handleBulkEvaluate = async (autoProcess: boolean = false) => {
    if (selectedIds.size === 0) {
      alert('Please select at least one applicant');
      return;
    }

    setProcessing(true);
    try {
      await bulkAPI.evaluateApplications(Array.from(selectedIds), autoProcess);
      alert(`Queued ${selectedIds.size} applicants for evaluation. Processing in background...`);
      setSelectedIds(new Set());

      // Refresh after a delay
      setTimeout(() => {
        fetchApplicants();
      }, 2000);
    } catch (error) {
      console.error('Error in bulk evaluation:', error);
      alert('Failed to queue evaluations. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      alert('Please select at least one applicant');
      return;
    }

    const confirmed = confirm(`Update status of ${selectedIds.size} applicants to "${newStatus}"?`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      await bulkAPI.updateStatus(Array.from(selectedIds), newStatus);
      alert(`Updated status for ${selectedIds.size} applicants`);
      setSelectedIds(new Set());
      await fetchApplicants();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const response = await bulkAPI.importApplicants(file);
      alert(`Successfully imported ${response.data.created_count} applicants`);
      await fetchApplicants();
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV. Please check the file format and try again.');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleExportApplicants = async (status?: string) => {
    try {
      const response = await bulkAPI.exportApplicants(undefined, status);

      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applicants_${status || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting applicants:', error);
      alert('Failed to export applicants. Please try again.');
    }
  };

  const handleExportFellows = async () => {
    try {
      const response = await bulkAPI.exportFellows();

      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fellows_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting fellows:', error);
      alert('Failed to export fellows. Please try again.');
    }
  };

  const pendingApplicants = applicants.filter(a => a.status === 'applied' || a.status === 'screening');

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
            <h1 className="text-3xl font-bold text-gray-900">Bulk Operations</h1>
            <p className="mt-2 text-gray-600">
              Process multiple applicants and manage data in bulk
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Applicants</p>
                  <p className="text-2xl font-bold text-gray-900">{applicants.length}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingApplicants.length}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <CheckSquare className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Selected</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedIds.size}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Evaluate Selected */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleBulkEvaluate(false)}
                  disabled={processing || selectedIds.size === 0}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Evaluate Selected ({selectedIds.size})
                </Button>

                {/* Auto-Process Selected */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleBulkEvaluate(true)}
                  disabled={processing || selectedIds.size === 0}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Auto-Process ({selectedIds.size})
                </Button>

                {/* Import CSV */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    disabled={importing}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload">
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={importing}
                      onClick={() => document.getElementById('csv-upload')?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {importing ? 'Importing...' : 'Import CSV'}
                    </Button>
                  </label>
                </div>

                {/* Export Applicants */}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleExportApplicants()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Applicants
                </Button>

                {/* Export Fellows */}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleExportFellows}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Fellows
                </Button>

                {/* Export by Status */}
                <div className="relative group">
                  <Button
                    variant="secondary"
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Export by Status
                  </Button>
                  <div className="absolute hidden group-hover:block top-full mt-1 w-full bg-white shadow-lg rounded-md border z-10">
                    <button
                      onClick={() => handleExportApplicants('applied')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      Applied
                    </button>
                    <button
                      onClick={() => handleExportApplicants('screening')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      Screening
                    </button>
                    <button
                      onClick={() => handleExportApplicants('eligible')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      Eligible
                    </button>
                    <button
                      onClick={() => handleExportApplicants('accepted')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      Accepted
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Update Actions */}
              {selectedIds.size > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Update Status for Selected ({selectedIds.size}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleBulkStatusUpdate('screening')}
                      disabled={processing}
                    >
                      → Screening
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleBulkStatusUpdate('eligible')}
                      disabled={processing}
                    >
                      → Eligible
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleBulkStatusUpdate('not_eligible')}
                      disabled={processing}
                    >
                      → Not Eligible
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleBulkStatusUpdate('accepted')}
                      disabled={processing}
                    >
                      → Accepted
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Applicants Table */}
          <Card padding={false}>
            <CardHeader className="px-6 pt-6">
              <div className="flex items-center justify-between">
                <CardTitle>Applicants</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === applicants.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {applicants.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No applicants</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Import a CSV file to get started.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <button onClick={toggleSelectAll}>
                          {selectedIds.size === applicants.length ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicants.map((applicant) => (
                      <TableRow
                        key={applicant.id}
                        className={selectedIds.has(applicant.id) ? 'bg-blue-50' : ''}
                      >
                        <TableCell>
                          <button onClick={() => toggleSelection(applicant.id)}>
                            {selectedIds.has(applicant.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{applicant.name}</TableCell>
                        <TableCell className="capitalize">
                          {applicant.role.replace('_', ' ')}
                        </TableCell>
                        <TableCell>{applicant.email}</TableCell>
                        <TableCell>
                          <Badge variant="default">{applicant.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(applicant.applied_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
