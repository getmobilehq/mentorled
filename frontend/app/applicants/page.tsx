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
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AppLayout } from '@/components/layout/AppLayout';
import { applicantsAPI } from '@/lib/api';
import {
  ExternalLink,
  Mail,
  Eye,
  FileText,
  Star,
  Upload,
  CheckCircle,
  Award,
  AlertTriangle,
} from 'lucide-react';
import type { Applicant, ApplicantJourney, JourneyEventType } from '@/types';

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

  // Journey modal state
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journey, setJourney] = useState<ApplicantJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);

  const JOURNEY_EVENT_CONFIG: Record<JourneyEventType, { icon: typeof FileText; color: string; bg: string }> = {
    applied: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    evaluation: { icon: Star, color: 'text-purple-600', bg: 'bg-purple-100' },
    submission: { icon: Upload, color: 'text-teal-600', bg: 'bg-teal-100' },
    decision: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    fellow_started: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-100' },
  };

  const handleViewJourney = async (applicantId: string) => {
    setJourneyOpen(true);
    setLoadingJourney(true);
    setJourney(null);
    try {
      const res = await applicantsAPI.getJourney(applicantId);
      setJourney(res.data);
    } catch (error) {
      console.error('Error fetching journey:', error);
    } finally {
      setLoadingJourney(false);
    }
  };

  return (

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
                  <TableHead>{'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                      No applicants found
                    </td>
                  </tr>
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
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleViewJourney(applicant.id)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Journey
                        </Button>
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
        {/* Journey Modal */}
        <Modal
          open={journeyOpen}
          onOpenChange={setJourneyOpen}
          title={journey ? `Journey - ${journey.applicant.name}` : 'Applicant Journey'}
          size="lg"
        >
          {loadingJourney ? (
            <div className="py-8 text-center text-gray-500">Loading journey...</div>
          ) : journey ? (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Applicant header */}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm text-gray-500">{journey.applicant.email}</p>
                  <p className="text-sm text-gray-500 capitalize mt-0.5">
                    {journey.applicant.role.replace('_', ' ')}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(journey.applicant.status)}>
                  {journey.applicant.status}
                </Badge>
              </div>

              {/* Fellow card */}
              {journey.fellow && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Fellow Status</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      <span className="font-medium capitalize">{journey.fellow.status.replace('_', ' ')}</span>
                    </div>
                    {journey.fellow.microship_score != null && (
                      <div>
                        <span className="text-gray-500">Microship:</span>{' '}
                        <span className="font-medium">{journey.fellow.microship_score}</span>
                      </div>
                    )}
                    {journey.fellow.milestone_1_score != null && (
                      <div>
                        <span className="text-gray-500">M1:</span>{' '}
                        <span className="font-medium">{journey.fellow.milestone_1_score}</span>
                      </div>
                    )}
                    {journey.fellow.current_risk_level && (
                      <div>
                        <span className="text-gray-500">Risk:</span>{' '}
                        <Badge variant={
                          journey.fellow.current_risk_level === 'critical' ? 'danger' :
                          journey.fellow.current_risk_level === 'at_risk' ? 'warning' :
                          'info'
                        }>
                          {journey.fellow.current_risk_level}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {journey.timeline.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2">No journey events yet.</p>
                </div>
              ) : (
                <div className="relative pl-8">
                  {/* Vertical line */}
                  <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {journey.timeline.map((event, idx) => {
                      const config = JOURNEY_EVENT_CONFIG[event.type] || JOURNEY_EVENT_CONFIG.applied;
                      const EventIcon = config.icon;

                      return (
                        <div key={idx} className="relative flex gap-4">
                          {/* Icon dot */}
                          <div className={`absolute -left-8 flex h-7 w-7 items-center justify-center rounded-full ${config.bg}`}>
                            <EventIcon className={`h-3.5 w-3.5 ${config.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900">
                                {event.title}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(event.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{event.description}</p>

                            {/* Expandable metadata */}
                            {event.metadata && event.type === 'submission' && event.metadata.submission_url && (
                              <a
                                href={event.metadata.submission_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Submission
                              </a>
                            )}
                            {event.metadata && event.type === 'evaluation' && event.metadata.overall_score != null && (
                              <div className="mt-1 text-xs text-gray-500">
                                Score: {event.metadata.overall_score}
                                {event.metadata.confidence != null && (
                                  <> | Confidence: {Math.round(event.metadata.confidence * 100)}%</>
                                )}
                              </div>
                            )}
                            {event.metadata && event.type === 'decision' && event.metadata.made_by_name && (
                              <div className="mt-1 text-xs text-gray-500">
                                By: {event.metadata.made_by_name}
                                {event.metadata.ai_assisted && ' (AI-assisted)'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="secondary" onClick={() => setJourneyOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">Failed to load journey data.</div>
          )}
        </Modal>
        </div>
        )}
      </AppLayout>

  );
}

export default function ApplicantsPage() {
  return (
    <ErrorBoundary>
      <ApplicantsPageContent />
    </ErrorBoundary>
  );
}
