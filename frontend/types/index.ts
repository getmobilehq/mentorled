export type ApplicantRole = 'product_manager' | 'product_designer' | 'frontend' | 'backend' | 'qa';
export type ApplicantStatus = 'applied' | 'screening' | 'eligible' | 'not_eligible' | 'microship_pending' | 'microship_submitted' | 'microship_evaluated' | 'accepted' | 'rejected' | 'withdrawn';
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

export interface RiskSignals {
  attendance_score: number;
  check_in_sentiment: number;
  check_in_completeness: number;
  sprint_delivery: number;
  evidence_submission: number;
  mentor_flags: number;
  trend: number;
}

export interface RiskConcern {
  type: string;
  severity: string;
  description: string;
}

export interface RiskAssessment {
  id: string;
  fellow_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  signals?: RiskSignals;
  concerns?: RiskConcern[];
  recommended_action: string;
  assessed_at: string;
}

export interface RiskAssessmentDetail {
  id: string;
  fellow_id: string;
  week: number;
  risk_level: string;
  risk_score: number;
  signals?: RiskSignals;
  concerns?: RiskConcern[];
  recommended_action?: string;
  action_taken?: string;
  actioned_by?: string;
  actioned_at?: string;
  assessed_at: string;
}

export interface Warning {
  id: string;
  fellow_id: string;
  level?: string;
  concerns?: string[];
  requirements?: string[];
  draft_message?: string;
  final_message?: string;
  issued_at?: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
  outcome?: string;
  created_at?: string;
}

export interface WarningDraftResponse {
  id: string;
  message: string;
  tone: string;
  warning_number: number;
  required_actions?: string[];
  consequences?: string;
  key_points?: string[];
}

export interface Profile {
  id: string;
  fellow_id: string;
  headline?: string;
  summary: string;
  skills: any;
  projects?: any;
  linkedin_summary?: string;
  generated_at?: string;
  version?: number;
}

export interface JobOpportunity {
  id: string;
  title: string;
  employer_name: string;
  employer_contact_email?: string;
  description?: string;
  requirements?: string[];
  preferred_skills?: string[];
  experience_level?: string;
  location?: string;
  remote_ok?: boolean;
  status: string;
  created_at: string;
}

export interface PlacementMatch {
  match_id: string;
  opportunity_id: string;
  opportunity_title?: string;
  employer_name?: string;
  match_score: number;
  match_reasoning?: string;
  skill_gaps?: string[];
  status: string;
  introduction_sent: boolean;
  introduction_draft?: string;
  created_at?: string;
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

// Challenge types
export type ChallengeStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface TrackConfig {
  id: string;
  cohort_id: string;
  role_type: string;
  total_challenges: number;
  challenges_created: number;
  created_at: string;
  updated_at: string;
}

export interface TrackSummary extends TrackConfig {
  challenges: Array<{
    id: string;
    title: string;
    description: string;
    status: ChallengeStatus;
    sequence_number: number | null;
    duration_hours: number | null;
    deadline: string;
    share_token: string;
    role_type: string;
    submission_types: string[];
    requirements: string[];
  }>;
}

export interface Challenge {
  id: string;
  cohort_id?: string | null;
  title: string;
  description: string;
  requirements: string[];
  role_type: string;
  submission_types: string[];
  deadline: string;
  status: ChallengeStatus;
  share_token: string;
  created_by?: string | null;
  auto_evaluate?: boolean;
  duration_hours?: number | null;
  sequence_number?: number | null;
  track_config_id?: string | null;
  total_in_track?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengePublic {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  role_type: string;
  submission_types: string[];
  deadline: string;
  status: ChallengeStatus;
  sequence_number?: number | null;
  total_in_track?: number | null;
  duration_hours?: number | null;
}

export interface ChallengeSubmission {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_email: string;
  submission_url?: string;
  submission_type?: string;
  submitted_at?: string;
  on_time?: boolean;
  has_evaluation: boolean;
  evaluation?: MicroshipEvaluationResult | null;
  created_at: string;
}

export interface ChallengeAnalytics {
  total_challenges: number;
  total_submissions: number;
  total_evaluated: number;
  pending_evaluation: number;
  pass_rate: number;
  borderline_rate: number;
  fail_rate: number;
  average_score: number;
  on_time_rate: number;
  per_challenge: Array<{
    challenge_id: string;
    title: string;
    status: string;
    role_type: string;
    submission_count: number;
    evaluated_count: number;
    average_score: number;
    pass_rate: number;
  }>;
  submissions_by_day?: Array<{
    date: string;
    count: number;
  }>;
}

// Journey types
export type JourneyEventType = 'applied' | 'evaluation' | 'submission' | 'decision' | 'fellow_started';

export interface JourneyEvent {
  type: JourneyEventType;
  date: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface JourneyFellow {
  id: string;
  status: string;
  role: string;
  microship_score?: number | null;
  milestone_1_score?: number | null;
  milestone_2_score?: number | null;
  current_risk_level?: string | null;
  warnings_count: number;
  started_at?: string | null;
}

export interface ApplicantJourney {
  applicant: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    applied_at?: string | null;
  };
  timeline: JourneyEvent[];
  fellow: JourneyFellow | null;
}

export interface PublicSubmissionCreate {
  email: string;
  name: string;
  submission_url: string;
  submission_type: string;
  notes?: string;
}

export interface PublicSubmissionResponse {
  message: string;
  submission_id: string;
  challenge_title: string;
  submitted_at: string;
}

// Email Template types
export interface EmailTemplateListItem {
  key: string;
  name: string;
  description: string;
  category: string;
  default_subject: string;
  has_override: boolean;
  variable_count: number;
}

export interface EmailTemplateVariable {
  name: string;
  type: string;
  description: string;
  sample: any;
}

export interface EmailTemplateDetail {
  key: string;
  name: string;
  description: string;
  category: string;
  default_subject: string;
  current_subject: string;
  default_content: string;
  current_content: string;
  has_override: boolean;
  variables: EmailTemplateVariable[];
  updated_at?: string;
}

export interface EmailConfigStatus {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_from_email: string;
  smtp_from_name: string;
  has_credentials: boolean;
}

// Team types
export type TeamStatus = 'forming' | 'active' | 'completed';

export interface Team {
  id: string;
  cohort_id: string;
  name: string;
  brief_title?: string | null;
  brief_description?: string | null;
  mentor_name?: string | null;
  slack_channel?: string | null;
  github_repo?: string | null;
  status: TeamStatus;
  created_at: string;
}

// Sprint & Fellowship Execution types
export type SprintStatus = 'pending' | 'active' | 'completed';
export type ObjectiveStatus = 'not_started' | 'in_progress' | 'done' | 'not_done';
export type MeetingType = 'sprint_planning' | 'standup' | 'sprint_review' | 'sprint_retrospective';
export type MeetingStatus = 'scheduled' | 'unlocked' | 'active' | 'completed';
export type AttendanceStatus = 'present' | 'late' | 'very_late' | 'absent' | 'approved_absence';
export type EvidenceType = 'github' | 'figma' | 'deployment' | 'video' | 'document';
export type TeamMood = 'energized' | 'positive' | 'neutral' | 'tired' | 'frustrated';

export interface Sprint {
  id: string;
  team_id: string;
  sprint_number: number;
  goal?: string | null;
  status: SprintStatus;
  start_date: string;
  end_date: string;
  completion_score?: number | null;
  objective_count?: number;
  completed_objectives?: number;
  created_at: string;
  updated_at: string;
}

export interface SprintObjective {
  id: string;
  sprint_id: string;
  description: string;
  owner_role?: string;
  owner_fellow_id?: string | null;
  status: ObjectiveStatus;
  evidence_url?: string | null;
  evidence_type?: EvidenceType | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  sprint_id: string;
  team_id: string;
  meeting_type: MeetingType;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string | null;
  is_locked: boolean;
  unlock_time?: string | null;
  status: MeetingStatus;
  created_at: string;
}

export interface Attendance {
  id: string;
  meeting_id: string;
  fellow_id: string;
  status: AttendanceStatus;
  joined_at?: string | null;
  minutes_late?: number | null;
  approved_by?: string | null;
  created_at: string;
  meeting_type?: string;
  scheduled_at?: string;
}

export interface Retrospective {
  id: string;
  sprint_id: string;
  what_worked: string[];
  what_didnt_work: string[];
  what_to_improve: string[];
  team_mood?: TeamMood;
  sprint_rating?: number;
  submitted_by?: string | null;
  submitted_at?: string | null;
  created_at: string;
}

export interface MeetingJoinResult {
  meeting_link: string;
  attendance_recorded: boolean;
  status: AttendanceStatus;
  minutes_late: number;
}

export interface AttendanceSummary {
  fellow_id: string;
  fellow_name: string;
  role: string;
  total_meetings: number;
  present_count: number;
  late_count: number;
  very_late_count: number;
  absent_count: number;
  approved_absence_count: number;
  attendance_score: number;
}

export interface TeamAttendanceSummary {
  team_id: string;
  team_average: number;
  total_meetings: number;
  members: AttendanceSummary[];
}
