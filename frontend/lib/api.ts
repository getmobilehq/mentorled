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
  getFellowMatches: (fellowId: string) =>
    api.get(`/api/placement/matches/${fellowId}`),
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

export const healthAPI = {
  check: () =>
    api.get('/health'),
};

export default api;
