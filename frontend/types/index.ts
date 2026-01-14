export type ApplicantRole = 'product_manager' | 'product_designer' | 'frontend' | 'backend' | 'qa';
export type ApplicantStatus = 'applied' | 'screening' | 'microship_pending' | 'microship_completed' | 'accepted' | 'rejected' | 'withdrawn';
export type CohortStatus = 'planning' | 'applications_open' | 'microship' | 'active' | 'completed';

export interface Applicant {
  id: string;
  cohort_id: string;
  email: string;
  name: string;
  role: ApplicantRole;
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
  project_description?: string;
  time_commitment: boolean;
  source?: string;
  status: ApplicantStatus;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: CohortStatus;
  target_size?: number;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  evaluation_id: string;
  applicant_id: string;
  scores: {
    [key: string]: number;
  };
  overall_score?: number;
  weighted_score?: number;
  eligibility?: string;
  outcome?: string;
  reasoning: string;
  flags?: string[];
  strengths?: string[];
  concerns?: string[];
  confidence: number;
  recommended_action: string;
  requires_human_review: boolean;
  evidence?: {
    [key: string]: string;
  };
}

export interface QueueStats {
  pending_applications: number;
  pending_microships: number;
  requires_review: number;
  total_in_queue: number;
}

export interface HealthCheck {
  status: string;
  version: string;
  service: string;
}

export type FellowRole = ApplicantRole;
export type FellowStatus = 'onboarded' | 'active' | 'at_risk' | 'warned_once' | 'warned_twice' | 'removed' | 'completed' | 'placed';
export type RiskLevel = 'on_track' | 'monitor' | 'at_risk' | 'critical';

export interface Fellow {
  id: string;
  cohort_id: string;
  team_id?: string;
  name: string;
  email: string;
  role: FellowRole;
  status: FellowStatus;
  github_username?: string;
  linkedin_url?: string;
  milestone_1_score?: number;
  milestone_2_score?: number;
  current_risk_level?: RiskLevel;
  warnings_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  fellow_id: string;
  week: number;
  accomplishments?: string;
  next_focus?: string;
  blockers?: string;
  needs_help?: string;
  self_assessment?: string;
  collaboration_rating?: string;
  energy_level?: number;
  submitted_at: string;
  analysis?: CheckInAnalysisData;
  sentiment_score?: number;
  risk_contribution?: number;
  blockers_extracted?: string[];
  action_items?: string[];
  analyzed_at?: string;
}

export interface CheckInAnalysisData {
  sentiment_score: number;
  risk_contribution: number;
  blockers_extracted: string[];
  action_items: string[];
  themes: string[];
  concerns: string[];
  positive_signals: string[];
  confidence: number;
  summary: string;
}

export interface CheckInAnalysisResponse {
  check_in_id: string;
  fellow_id: string;
  fellow_name: string;
  week: number;
  analysis: CheckInAnalysisData;
  analyzed_at: string;
}

export interface RiskAssessment {
  id: string;
  fellow_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  contributing_factors: any;
  ai_concerns?: string[];
  recommended_action: string;
  assessed_at: string;
}

export interface Warning {
  id: string;
  fellow_id: string;
  warning_number: number;
  ai_draft: string;
  final_message?: string;
  tone: string;
  required_actions?: string[];
  consequences?: string;
  sent: boolean;
  sent_at?: string;
}

export interface Profile {
  id: string;
  fellow_id: string;
  summary: string;
  skills: any;
  work_samples?: any[];
  created_at: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location?: string;
  job_type?: string;
  required_skills?: string[];
  status: string;
  posted_date?: string;
}

export interface PlacementMatch {
  match_id: string;
  opportunity_id: string;
  match_score: number;
  status: string;
  introduction_sent: boolean;
  ai_reasoning?: string;
  skill_gaps?: string[];
}

export interface RiskDashboard {
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
    team_id?: string;
    risk_level?: RiskLevel;
    warnings_count: number;
    milestone_1_score?: number;
    milestone_2_score?: number;
  }>;
}

// Microship types
export type SubmissionType = 'github' | 'figma' | 'document' | 'other';
export type MicroshipOutcome = 'progress' | 'borderline' | 'do_not_progress';

export interface CommunicationLog {
  timestamp: string;
  type: string;
  content: string;
}

export interface MicroshipScores {
  technical_execution: number;
  execution_discipline: number;
  professional_behavior: number;
  instruction_following: number;
}

export interface MicroshipEvidence {
  technical: string;
  execution: string;
  professional: string;
  instructions: string;
}

export interface MicroshipEvaluationResult {
  scores: MicroshipScores;
  weighted_score: number;
  outcome: MicroshipOutcome;
  evidence: MicroshipEvidence;
  disqualifiers?: string[] | null;
  strengths: string[];
  concerns: string[];
  confidence: number;
  reasoning: string;
}

export interface MicroshipSubmission {
  id: string;
  applicant_id: string;
  challenge_id?: string | null;
  submission_url?: string | null;
  submission_type?: SubmissionType | null;
  submitted_at?: string | null;
  deadline?: string | null;
  on_time?: boolean | null;
  acknowledgment_time?: string | null;
  communication_log?: CommunicationLog[] | null;
  raw_analysis?: MicroshipEvaluationResult | null;
  created_at: string;
}

export interface MicroshipEvaluationResponse {
  submission_id: string;
  applicant_id: string;
  applicant_name: string;
  evaluation: MicroshipEvaluationResult;
  evaluated_at: string;
}
