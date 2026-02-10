'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { challengesAPI } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  ListChecks,
} from 'lucide-react';
import type { ChallengePublic, PublicSubmissionResponse } from '@/types';

type PageState = 'loading' | 'not_found' | 'closed' | 'expired' | 'form' | 'success';

export default function PublicSubmitPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [challenge, setChallenge] = useState<ChallengePublic | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicSubmissionResponse | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    submission_url: '',
    submission_type: '',
    notes: '',
  });

  useEffect(() => {
    fetchChallenge();
  }, [token]);

  const fetchChallenge = async () => {
    try {
      const res = await challengesAPI.getPublic(token);
      const data = res.data as ChallengePublic;
      setChallenge(data);

      if (data.status !== 'active') {
        setPageState('closed');
        return;
      }

      if (new Date(data.deadline) < new Date()) {
        setPageState('expired');
        return;
      }

      if (data.submission_types.length > 0) {
        setFormData(prev => ({ ...prev, submission_type: data.submission_types[0] }));
      }

      setPageState('form');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setPageState('not_found');
      } else {
        setPageState('not_found');
      }
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!challenge || pageState !== 'form') return;

    const timer = setInterval(() => {
      const now = new Date();
      const deadline = new Date(challenge.deadline);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Deadline passed');
        setPageState('expired');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge, pageState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await challengesAPI.submitPublic(token, {
        email: formData.email,
        name: formData.name,
        submission_url: formData.submission_url,
        submission_type: formData.submission_type,
        notes: formData.notes || undefined,
      });
      setResult(res.data);
      setPageState('success');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    all: 'All Roles',
    product_manager: 'Product Manager',
    product_designer: 'Product Designer',
    frontend: 'Frontend Developer',
    backend: 'Backend Developer',
    qa: 'QA Engineer',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Image
            src="/Logo.svg"
            alt="MentorLed"
            width={140}
            height={24}
            priority
          />
          <span className="text-sm text-gray-500">Challenge Submission</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Loading */}
        {pageState === 'loading' && (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-r-transparent" />
            <p className="mt-4 text-gray-500">Loading challenge...</p>
          </div>
        )}

        {/* Not Found */}
        {pageState === 'not_found' && (
          <div className="py-20 text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-gray-400" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Challenge Not Found</h2>
            <p className="mt-2 text-gray-600">
              This challenge link is invalid or has been removed.
            </p>
          </div>
        )}

        {/* Closed */}
        {pageState === 'closed' && challenge && (
          <div className="py-20 text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-yellow-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Challenge Closed</h2>
            <p className="mt-2 text-gray-600">
              &quot;{challenge.title}&quot; is no longer accepting submissions.
            </p>
          </div>
        )}

        {/* Expired */}
        {pageState === 'expired' && challenge && (
          <div className="py-20 text-center">
            <Clock className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Deadline Passed</h2>
            <p className="mt-2 text-gray-600">
              The deadline for &quot;{challenge.title}&quot; was{' '}
              {new Date(challenge.deadline).toLocaleString()}.
            </p>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && result && (
          <div className="py-16 text-center">
            <CheckCircle className="mx-auto h-20 w-20 text-green-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Submission Received!</h2>
            <p className="mt-3 text-lg text-gray-600">
              Thank you, {formData.name}. Your submission for &quot;{result.challenge_title}&quot; has
              been recorded.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Submitted on {new Date(result.submitted_at).toLocaleString()}
            </p>
            <div className="mt-8 rounded-lg bg-green-50 border border-green-200 p-4 inline-block text-left">
              <p className="text-sm text-green-800">
                Your submission will be reviewed by our team. We&apos;ll be in touch if we need any
                additional information.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {pageState === 'form' && challenge && (
          <div className="space-y-6">
            {/* Challenge Info */}
            <Card>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">{challenge.title}</h1>
                    {challenge.sequence_number && challenge.total_in_track && (
                      <Badge variant="secondary">
                        Challenge {challenge.sequence_number} of {challenge.total_in_track}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="info">
                    {roleLabels[challenge.role_type] || challenge.role_type}
                  </Badge>
                </div>

                <p className="text-gray-700 whitespace-pre-line">{challenge.description}</p>

                {/* Requirements */}
                {challenge.requirements.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="h-5 w-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Requirements</h3>
                    </div>
                    <ul className="space-y-1.5 ml-7">
                      {challenge.requirements.map((req, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">&#8226;</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deadline Countdown */}
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      Deadline: {new Date(challenge.deadline).toLocaleString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-amber-700 font-semibold">{timeLeft}</p>
                      {challenge.duration_hours && (
                        <span className="text-sm text-amber-600">
                          Duration: {challenge.duration_hours} hours
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Submission Form */}
            <Card>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Submit Your Work</h2>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submission URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.submission_url}
                    onChange={e => setFormData(prev => ({ ...prev, submission_url: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="https://github.com/your-username/your-repo"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Link to your GitHub repo, Figma file, or document
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submission Type *
                  </label>
                  <select
                    required
                    value={formData.submission_type}
                    onChange={e => setFormData(prev => ({ ...prev, submission_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    {challenge.submission_types.map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Any additional context about your submission..."
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  className="w-full py-3"
                >
                  {submitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Challenge
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12 py-6">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm text-gray-500">
          MentorLed AI-Ops Platform
        </div>
      </footer>
    </div>
  );
}
