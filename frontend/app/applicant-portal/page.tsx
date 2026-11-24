'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/Toast';
import { applicantsAPI, challengesAPI } from '@/lib/api';
import { Flag, CheckCircle, Clock, ExternalLink, FileText } from 'lucide-react';

interface Submission {
  id: string;
  challenge_ref: string | null;
  submission_url: string | null;
  submission_type: string | null;
  submitted_at: string | null;
  on_time: boolean | null;
}

interface MyApplication {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  cohort_name: string | null;
  applied_at: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  linkedin_url?: string | null;
  submissions: Submission[];
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  role_type: string;
  submission_types: string[];
  deadline: string;
  sequence_number?: number | null;
  total_in_track?: number | null;
  duration_hours?: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'In Screening',
  eligible: 'Eligible',
  not_eligible: 'Not Eligible',
  microship_pending: 'Challenge Pending',
  microship_submitted: 'Challenge Submitted',
  microship_evaluated: 'Challenge Evaluated',
  accepted: 'Accepted 🎉',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn',
};

function ChallengeCard({
  challenge,
  submitted,
  onSubmitted,
}: {
  challenge: Challenge;
  submitted?: Submission;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [type, setType] = useState(challenge.submission_types[0] || 'github');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const deadlinePassed = challenge.deadline && new Date(challenge.deadline) < new Date();

  const submit = async () => {
    if (!url.trim()) {
      toast('Please enter a submission link', 'error');
      return;
    }
    setBusy(true);
    try {
      await challengesAPI.submit(challenge.id, { submission_url: url, submission_type: type, notes });
      toast('Submission received!', 'success');
      onSubmitted();
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Submission failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-green-600" />
              {challenge.title}
            </CardTitle>
            {challenge.sequence_number && challenge.total_in_track && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Challenge {challenge.sequence_number} of {challenge.total_in_track}
              </p>
            )}
          </div>
          {submitted ? (
            <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Submitted</Badge>
          ) : deadlinePassed ? (
            <Badge variant="danger">Closed</Badge>
          ) : (
            <Badge variant="secondary">Open</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{challenge.description}</p>

        {challenge.requirements?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Requirements</p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {challenge.requirements.map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Due {new Date(challenge.deadline).toLocaleString()}
          </span>
          {challenge.duration_hours && <span>~{challenge.duration_hours}h effort</span>}
        </div>

        {submitted ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm">
            <p className="text-green-800 dark:text-green-300 font-medium">You submitted this challenge.</p>
            {submitted.submission_url && (
              <a href={submitted.submission_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 hover:underline mt-1">
                <ExternalLink className="h-3 w-3" /> View your submission
              </a>
            )}
          </div>
        ) : deadlinePassed ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">The deadline for this challenge has passed.</p>
        ) : !open ? (
          <Button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">Submit Work</Button>
        ) : (
          <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Submission Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {challenge.submission_types.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Submission Link</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/you/repo" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy} className="bg-green-600 hover:bg-green-700 text-white">{busy ? 'Submitting...' : 'Submit'}</Button>
              <Button onClick={() => setOpen(false)} variant="secondary">Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApplicantPortalPage() {
  const [app, setApp] = useState<MyApplication | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [appRes, chRes] = await Promise.all([
        applicantsAPI.me(),
        challengesAPI.myChallenges().catch(() => ({ data: [] })),
      ]);
      setApp(appRes.data);
      setChallenges(chRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load your application.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submittedByChallenge = new Map<string, Submission>();
  app?.submissions.forEach((s) => { if (s.challenge_ref) submittedByChallenge.set(s.challenge_ref, s); });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Application</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your status and submit your challenges.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" /></div>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-gray-600 dark:text-gray-400">{error}</CardContent></Card>
        ) : app ? (
          <>
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{app.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {app.role.replace('_', ' ')} · {app.cohort_name || 'Cohort'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <Badge variant={getStatusBadgeVariant(app.status)}>{STATUS_LABELS[app.status] || app.status}</Badge>
                  </div>
                </div>
                {app.status === 'accepted' && (
                  <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
                    Congratulations — you've been accepted! Your fellow portal will be available shortly.
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" /> Your Challenges
              </h2>
              {challenges.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-600 dark:text-gray-400">
                  No challenges are open for you right now. We'll notify you when one is assigned.
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {challenges.map((c) => (
                    <ChallengeCard key={c.id} challenge={c} submitted={submittedByChallenge.get(c.id)} onSubmitted={load} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
