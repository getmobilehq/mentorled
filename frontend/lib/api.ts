import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// TEMPORARY: Disable auth interceptors until backend auth is implemented (Phase 4)
// This prevents infinite loops and redirects

/* Original interceptor code - re-enable in Phase 4
// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
*/

// API endpoints
export const applicantsAPI = {
  list: (cohortId?: string) =>
    api.get('/api/applicants/', { params: { cohort_id: cohortId } }),
  get: (id: string) =>
    api.get(`/api/applicants/${id}`),
  create: (data: any) =>
    api.post('/api/applicants/', data),
  update: (id: string, data: any) =>
    api.put(`/api/applicants/${id}`, data),
  getJourney: (id: string) =>
    api.get(`/api/applicants/${id}/journey`),
};

export const screeningAPI = {
  evaluateApplication: (applicantId: string) =>
    api.post('/api/screening/application/evaluate', { applicant_id: applicantId }),
  evaluateMicroship: (submissionId: string) =>
    api.post('/api/screening/microship/evaluate', { submission_id: submissionId }),
  getQueue: () =>
    api.get('/api/screening/queue'),
  approveEvaluation: (evaluationId: string, approved: boolean, feedback?: string) =>
    api.post(`/api/screening/application/${evaluationId}/approve?approved=${approved}`, {
      feedback
    }),
};

export const cohortsAPI = {
  list: () =>
    api.get('/api/cohorts/'),
  get: (id: string) =>
    api.get(`/api/cohorts/${id}`),
  create: (data: any) =>
    api.post('/api/cohorts/', data),
  update: (id: string, data: any) =>
    api.put(`/api/cohorts/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/cohorts/${id}/status`, { status }),
};

export const fellowsAPI = {
  list: (cohortId?: string) =>
    api.get('/api/fellows/', { params: { cohort_id: cohortId } }),
  get: (id: string) =>
    api.get(`/api/fellows/${id}`),
  getCheckIns: (id: string) =>
    api.get(`/api/fellows/${id}/check-ins`),
  getRisk: (id: string) =>
    api.get(`/api/fellows/${id}/risk`),
};

export const deliveryAPI = {
  analyzeCheckIn: (checkInId: string) =>
    api.post('/api/delivery/check-in/analyze', { check_in_id: checkInId }),
  assessRisk: (fellowId: string) =>
    api.post('/api/delivery/risk/assess', { fellow_id: fellowId }),
  draftWarning: (fellowId: string) =>
    api.post('/api/delivery/warning/draft', { fellow_id: fellowId }),
  approveWarning: (warningId: string, approved: boolean, editedMessage?: string) =>
    api.post(`/api/delivery/warning/${warningId}/approve`, {
      approved,
      edited_message: editedMessage
    }),
  getRiskDashboard: (cohortId?: string) =>
    api.get('/api/delivery/risk/dashboard', { params: { cohort_id: cohortId } }),
};

export const placementAPI = {
  generateProfile: (fellowId: string) =>
    api.post('/api/placement/profile/generate', { fellow_id: fellowId }),
  matchOpportunities: (fellowId: string, opportunityIds?: string[]) =>
    api.post('/api/placement/opportunities/match', {
      fellow_id: fellowId,
      opportunity_ids: opportunityIds
    }),
  draftIntroduction: (matchId: string) =>
    api.post('/api/placement/introduction/draft', { match_id: matchId }),
  listProfiles: (cohortId?: string) =>
    api.get('/api/placement/profiles', { params: { cohort_id: cohortId } }),
  listOpportunities: (status?: string) =>
    api.get('/api/placement/opportunities', { params: { status } }),
  createOpportunity: (data: any) =>
    api.post('/api/placement/opportunities', data),
  updateOpportunity: (id: string, data: any) =>
    api.put(`/api/placement/opportunities/${id}`, data),
  updateOpportunityStatus: (id: string, status: string) =>
    api.patch(`/api/placement/opportunities/${id}/status`, { status }),
  getFellowMatches: (fellowId: string) =>
    api.get(`/api/placement/matches/${fellowId}`),
  updateMatchStatus: (matchId: string, status: string) =>
    api.patch(`/api/placement/matches/${matchId}/status`, { status }),
};

export const microshipAPI = {
  listSubmissions: (limit?: number, offset?: number) =>
    api.get('/api/microship/submissions', { params: { limit, offset } }),
  getSubmission: (id: string) =>
    api.get(`/api/microship/submissions/${id}`),
  getApplicantSubmissions: (applicantId: string) =>
    api.get(`/api/microship/submissions/applicant/${applicantId}`),
  createSubmission: (data: any) =>
    api.post('/api/microship/submissions', data),
  evaluateSubmission: (submissionId: string) =>
    api.post(`/api/microship/evaluate/${submissionId}`),
  evaluateBulk: () =>
    api.post('/api/microship/evaluate-bulk'),
};

export const checkInsAPI = {
  list: (week?: number, cohortId?: string, limit?: number, offset?: number) =>
    api.get('/api/check-ins', { params: { week, cohort_id: cohortId, limit, offset } }),
  getCheckIn: (id: string) =>
    api.get(`/api/check-ins/${id}`),
  getFellowCheckIns: (fellowId: string) =>
    api.get(`/api/check-ins/fellow/${fellowId}`),
  getByWeek: (week: number) =>
    api.get(`/api/check-ins/week/${week}`),
  create: (data: any) =>
    api.post('/api/check-ins', data),
  analyze: (checkInId: string) =>
    api.post(`/api/check-ins/analyze/${checkInId}`),
  analyzeBulk: (week?: number, cohortId?: string) =>
    api.post('/api/check-ins/analyze-bulk', null, { params: { week, cohort_id: cohortId } }),
};

export const riskAPI = {
  assessFellow: (fellowId: string, week: number) =>
    api.post(`/api/risk/assess/${fellowId}?week=${week}`),
  getFellowHistory: (fellowId: string) =>
    api.get(`/api/risk/fellow/${fellowId}`),
  getDashboard: (cohortId: string, week: number) =>
    api.get(`/api/risk/dashboard/${cohortId}?week=${week}`),
  getAssessment: (assessmentId: string) =>
    api.get(`/api/risk/assessment/${assessmentId}`),
  recordAction: (assessmentId: string, action: string) =>
    api.post(`/api/risk/action/${assessmentId}`, { action }),
  getByWeek: (week: number, cohortId?: string) =>
    api.get(`/api/risk/week/${week}`, { params: { cohort_id: cohortId } }),
};

export const warningsAPI = {
  draft: (data: any) =>
    api.post('/api/warnings/draft', data),
  create: (data: any) =>
    api.post('/api/warnings', data),
  get: (warningId: string) =>
    api.get(`/api/warnings/${warningId}`),
  getFellowWarnings: (fellowId: string) =>
    api.get(`/api/warnings/fellow/${fellowId}`),
  update: (warningId: string, data: any) =>
    api.put(`/api/warnings/${warningId}`, data),
  issue: (warningId: string, sendEmail: boolean = true) =>
    api.post(`/api/warnings/${warningId}/issue`, { send_email: sendEmail }),
  acknowledge: (warningId: string, response?: string) =>
    api.post(`/api/warnings/${warningId}/acknowledge`, { response }),
  list: (cohortId?: string, level?: string, acknowledged?: boolean, limit?: number, offset?: number) =>
    api.get('/api/warnings', { params: { cohort_id: cohortId, level, acknowledged, limit, offset } }),
};

export const analyticsAPI = {
  getDashboard: (cohortId?: string) =>
    api.get('/api/analytics/dashboard', { params: { cohort_id: cohortId } }),
  getConversionFunnel: (cohortId?: string) =>
    api.get('/api/analytics/conversion-funnel', { params: { cohort_id: cohortId } }),
  getAIPerformance: (cohortId?: string) =>
    api.get('/api/analytics/ai-performance', { params: { cohort_id: cohortId } }),
  getTrends: (cohortId?: string) =>
    api.get('/api/analytics/trends', { params: { cohort_id: cohortId } }),
  getCohortComparison: () =>
    api.get('/api/analytics/cohort-comparison'),
};

export const bulkAPI = {
  evaluateApplications: (applicantIds: string[], autoProcess: boolean = false) =>
    api.post('/api/bulk/evaluate', { applicant_ids: applicantIds, auto_process: autoProcess }),
  updateStatus: (applicantIds: string[], newStatus: string) =>
    api.post('/api/bulk/status/update', { applicant_ids: applicantIds, new_status: newStatus }),
  importApplicants: (file: File, cohortId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (cohortId) formData.append('cohort_id', cohortId);
    return api.post('/api/bulk/import/applicants', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  exportApplicants: (cohortId?: string, status?: string) =>
    api.get('/api/bulk/export/applicants', {
      params: { cohort_id: cohortId, status },
      responseType: 'blob'
    }),
  exportFellows: (cohortId?: string) =>
    api.get('/api/bulk/export/fellows', {
      params: { cohort_id: cohortId },
      responseType: 'blob'
    }),
};

export const trackConfigsAPI = {
  list: (cohortId: string) =>
    api.get('/api/track-configs/', { params: { cohort_id: cohortId } }),
  get: (id: string) =>
    api.get(`/api/track-configs/${id}`),
  create: (data: { cohort_id: string; role_type: string; total_challenges: number }) =>
    api.post('/api/track-configs/', data),
  update: (id: string, data: { total_challenges: number }) =>
    api.put(`/api/track-configs/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/track-configs/${id}`),
  getCohortSummary: (cohortId: string) =>
    api.get(`/api/track-configs/cohort/${cohortId}/summary`),
};

export const challengesAPI = {
  list: (cohortId?: string, status?: string) =>
    api.get('/api/challenges/', { params: { cohort_id: cohortId, status_filter: status } }),
  get: (id: string) =>
    api.get(`/api/challenges/${id}`),
  create: (data: any) =>
    api.post('/api/challenges/', data),
  update: (id: string, data: any) =>
    api.put(`/api/challenges/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/challenges/${id}/status`, { status }),
  getSubmissions: (id: string) =>
    api.get(`/api/challenges/${id}/submissions`),
  getPublic: (shareToken: string) =>
    api.get(`/api/challenges/public/${shareToken}`),
  submitPublic: (shareToken: string, data: any) =>
    api.post(`/api/challenges/public/${shareToken}/submit`, data),
  generateContent: (data: {
    role_type: string;
    duration_hours?: number | null;
    sequence_number?: number | null;
    total_in_track?: number | null;
    track_config_id?: string | null;
    existing_title?: string;
    existing_description?: string;
  }) =>
    api.post('/api/challenges/generate-content', data),
  getAnalytics: (cohortId?: string) =>
    api.get('/api/challenges/analytics', { params: { cohort_id: cohortId } }),
};

export const healthAPI = {
  check: () =>
    api.get('/health'),
};

export default api;
