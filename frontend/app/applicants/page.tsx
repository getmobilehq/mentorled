'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI } from '@/lib/api';
import { ExternalLink, Mail } from 'lucide-react';
import type { Applicant } from '@/types';

function ApplicantsPageContent() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Filter and search logic
  const filteredApplicants = useMemo(() => {
    let filtered = [...applicants];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((app) => selectedStatuses.includes(app.status));
    }

    // Role filter
    if (selectedRoles.length > 0) {
      filtered = filtered.filter((app) => selectedRoles.includes(app.role));
    }

    return filtered;
  }, [applicants, searchQuery, selectedStatuses, selectedRoles]);

  // Pagination
  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);
  const paginatedApplicants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredApplicants.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredApplicants, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedRoles, itemsPerPage]);

  const statusOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'waitlisted', label: 'Waitlisted' },
  ];

  const roleOptions = [
    { value: 'backend_engineer', label: 'Backend Engineer' },
    { value: 'frontend_engineer', label: 'Frontend Engineer' },
    { value: 'fullstack_engineer', label: 'Fullstack Engineer' },
    { value: 'mobile_engineer', label: 'Mobile Engineer' },
    { value: 'devops_engineer', label: 'DevOps Engineer' },
    { value: 'data_engineer', label: 'Data Engineer' },
  ];

  return (
    <ProtectedRoute>
      <AppLayout>
        {loading ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Applicants</h1>
              <p className="mt-2 text-gray-600">View and manage all program applicants</p>
            </div>
            <Card>
              <TableSkeleton rows={10} columns={7} />
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Applicants</h1>
            <p className="mt-2 text-gray-600">
              View and manage all program applicants
            </p>
          </div>
          <div className="text-sm text-gray-600">
            {filteredApplicants.length} of {applicants.length} applicants
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or email..."
            className="flex-1"
          />
          <FilterDropdown
            label="Status"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <FilterDropdown
            label="Role"
            options={roleOptions}
            selected={selectedRoles}
            onChange={setSelectedRoles}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{applicants.length}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Applied</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {applicants.filter(a => a.status === 'applied').length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Accepted</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {applicants.filter(a => a.status === 'accepted').length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {applicants.filter(a => a.status === 'rejected').length}
              </p>
            </div>
          </Card>
        </div>

        {/* Applicants table */}
        <Card padding={false}>
          <CardHeader className="px-6 pt-6">
            <CardTitle>All Applicants</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead>Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedApplicants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No applicants found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedApplicants.map((applicant) => (
                    <TableRow key={applicant.id}>
                      <TableCell className="font-medium">{applicant.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{applicant.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {applicant.role.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(applicant.status)}>
                          {applicant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{applicant.source || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        {new Date(applicant.applied_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-3">
                          {applicant.portfolio_url && (
                            <a
                              href={applicant.portfolio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="Portfolio"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {applicant.github_url && (
                            <a
                              href={applicant.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="GitHub"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          {filteredApplicants.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredApplicants.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </Card>
        </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function ApplicantsPage() {
  return (
    <ErrorBoundary>
      <ApplicantsPageContent />
    </ErrorBoundary>
  );
}
