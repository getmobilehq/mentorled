'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConfirmDelete, apiErrorMessage } from '@/components/ui/ConfirmDelete';
import { useToast } from '@/components/ui/Toast';
import { applicantsAPI, cohortsAPI } from '@/lib/api';
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { Applicant, ApplicantJourney, JourneyEventType, Cohort, ApplicantRole, ApplicantStatus } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  product_manager: 'Product Manager',
  product_designer: 'Product Designer',
  project_manager: 'Project Manager',
  frontend: 'Frontend',
  backend: 'Backend',
  qa: 'QA',
};

const formatRole = (role: string) =>
  ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type ApplicantForm = {
  cohort_id: string;
  name: string;
  email: string;
  role: ApplicantRole;
  status: ApplicantStatus;
  portfolio_url: string;
  github_url: string;
  linkedin_url: string;
  project_description: string;
  time_commitment: boolean;
};

const EMPTY_FORM: ApplicantForm = {
  cohort_id: '',
  name: '',
  email: '',
  role: 'frontend',
  status: 'applied',
  portfolio_url: '',
  github_url: '',
  linkedin_url: '',
  project_description: '',
  time_commitment: false,
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

function ApplicantsPageContent() {
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    fetchApplicants();
    fetchCohorts();
  }, []);

  const fetchCohorts = async () => {
    try {
      const response = await cohortsAPI.list();
      setCohorts(response.data);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

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

    // Cohort filter
    if (selectedCohort) {
      filtered = filtered.filter((app) => app.cohort_id === selectedCohort);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((app) => new Date(app.applied_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((app) => new Date(app.applied_at) <= toDate);
    }

    return filtered;
  }, [applicants, searchQuery, selectedStatuses, selectedRoles, selectedCohort, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);
  const paginatedApplicants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredApplicants.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredApplicants, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedRoles, selectedCohort, dateFrom, dateTo, itemsPerPage]);

  const statusOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'eligible', label: 'Eligible' },
    { value: 'not_eligible', label: 'Not Eligible' },
    { value: 'microship_pending', label: 'Microship Pending' },
    { value: 'microship_submitted', label: 'Microship Submitted' },
    { value: 'microship_evaluated', label: 'Microship Evaluated' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ];

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

  // Create / edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<Applicant | null>(null);
  const [form, setForm] = useState<ApplicantForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Applicant | null>(null);

  const setField = <K extends keyof ApplicantForm>(key: K, value: ApplicantForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditingApplicant(null);
    setForm({ ...EMPTY_FORM, cohort_id: selectedCohort || cohorts[0]?.id || '' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (applicant: Applicant) => {
    setEditingApplicant(applicant);
    setForm({
      cohort_id: applicant.cohort_id,
      name: applicant.name,
      email: applicant.email,
      role: applicant.role,
      status: applicant.status,
      portfolio_url: applicant.portfolio_url || '',
      github_url: applicant.github_url || '',
      linkedin_url: applicant.linkedin_url || '',
      project_description: applicant.project_description || '',
      time_commitment: !!applicant.time_commitment,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const optional = {
      portfolio_url: form.portfolio_url.trim() || null,
      github_url: form.github_url.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      project_description: form.project_description.trim() || null,
      time_commitment: form.time_commitment,
    };
    if (!editingApplicant) {
      if (!form.cohort_id || !form.name.trim() || !form.email.trim()) {
        setFormError('Cohort, name and email are required.');
        return;
      }
    }
    setSaving(true);
    try {
      if (editingApplicant) {
        await applicantsAPI.update(editingApplicant.id, { ...optional, status: form.status });
        toast(`Updated ${editingApplicant.name}`, 'success');
      } else {
        await applicantsAPI.create({
          cohort_id: form.cohort_id,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          ...optional,
        });
        toast(`Added ${form.name.trim()}`, 'success');
      }
      setFormOpen(false);
      await fetchApplicants();
    } catch (err) {
      setFormError(apiErrorMessage(err, editingApplicant ? 'Could not update applicant.' : 'Could not create applicant.'));
    } finally {
      setSaving(false);
    }
  };

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
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredApplicants.length} of {applicants.length} applicants
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Add applicant
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={selectedCohort}
              onChange={e => setSelectedCohort(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
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
                        <span>{formatRole(applicant.role)}</span>
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
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleViewJourney(applicant.id)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Journey
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(applicant); }}
                            aria-label={`Edit ${applicant.name}`}
                            title="Edit"
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(applicant); }}
                            aria-label={`Delete ${applicant.name}`}
                            title="Delete"
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatRole(journey.applicant.role)}
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

        {/* Create / Edit Applicant Modal */}
        <Modal
          open={formOpen}
          onOpenChange={(o) => { if (!saving) setFormOpen(o); }}
          title={editingApplicant ? `Edit applicant - ${editingApplicant.name}` : 'Add applicant'}
          size="lg"
        >
          <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {editingApplicant ? (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm dark:bg-gray-900/50">
                <p className="font-medium text-gray-900 dark:text-white">{editingApplicant.name}</p>
                <p className="text-gray-500 dark:text-gray-400">{editingApplicant.email}</p>
                <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                  {formatRole(editingApplicant.role)}
                  {' · '}
                  {cohorts.find((c) => c.id === editingApplicant.cohort_id)?.name || 'Unknown cohort'}
                </p>
                <p className="mt-1 text-xs text-gray-400">Name, email, role and cohort can&apos;t be changed.</p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="applicant-cohort" className={labelClass}>Cohort *</label>
                  <select
                    id="applicant-cohort"
                    required
                    value={form.cohort_id}
                    onChange={(e) => setField('cohort_id', e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>Select a cohort</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="applicant-name" className={labelClass}>Name *</label>
                    <input
                      id="applicant-name"
                      required
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="applicant-email" className={labelClass}>Email *</label>
                    <input
                      id="applicant-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="applicant-role" className={labelClass}>Role *</label>
                  <select
                    id="applicant-role"
                    value={form.role}
                    onChange={(e) => setField('role', e.target.value as ApplicantRole)}
                    className={inputClass}
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {editingApplicant && (
              <div>
                <label htmlFor="applicant-status" className={labelClass}>Status</label>
                <select
                  id="applicant-status"
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as ApplicantStatus)}
                  className={inputClass}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="applicant-portfolio" className={labelClass}>Portfolio URL</label>
                <input
                  id="applicant-portfolio"
                  type="url"
                  value={form.portfolio_url}
                  onChange={(e) => setField('portfolio_url', e.target.value)}
                  placeholder="https://"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="applicant-github" className={labelClass}>GitHub URL</label>
                <input
                  id="applicant-github"
                  type="url"
                  value={form.github_url}
                  onChange={(e) => setField('github_url', e.target.value)}
                  placeholder="https://github.com/"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="applicant-linkedin" className={labelClass}>LinkedIn URL</label>
                <input
                  id="applicant-linkedin"
                  type="url"
                  value={form.linkedin_url}
                  onChange={(e) => setField('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="applicant-project" className={labelClass}>Project description</label>
              <textarea
                id="applicant-project"
                rows={3}
                value={form.project_description}
                onChange={(e) => setField('project_description', e.target.value)}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.time_commitment}
                onChange={(e) => setField('time_commitment', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Can commit the required time
            </label>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingApplicant ? 'Save changes' : 'Add applicant'}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDelete
          open={!!deleteTarget}
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          entity="applicant"
          name={deleteTarget?.name}
          details="Their evaluations and submissions will also be deleted."
          onConfirm={() => applicantsAPI.delete(deleteTarget!.id)}
          onDeleted={() => {
            toast(`Deleted ${deleteTarget?.name ?? 'applicant'}`, 'success');
            setDeleteTarget(null);
            fetchApplicants();
          }}
        />
        </div>
        )}
      </AppLayout>

  );
}

export default function ApplicantsPage() {
  return <ApplicantsPageContent />;
}
