'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { authAPI, cohortsAPI } from '@/lib/api';

interface OpenCohort {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const ROLES = [
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'product_designer', label: 'Product Designer' },
  { value: 'frontend', label: 'Frontend Engineer' },
  { value: 'backend', label: 'Backend Engineer' },
  { value: 'qa', label: 'QA Engineer' },
];

const inputClass =
  'w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800';

export default function ApplyPage() {
  const { setSession } = useAuth();
  const [cohorts, setCohorts] = useState<OpenCohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    cohort_id: '',
    name: '',
    email: '',
    role: 'frontend',
    password: '',
    portfolio_url: '',
    github_url: '',
    linkedin_url: '',
    project_description: '',
    time_commitment: false,
  });

  useEffect(() => {
    cohortsAPI
      .listOpen()
      .then((res) => {
        setCohorts(res.data);
        if (res.data.length > 0) {
          setForm((f) => ({ ...f, cohort_id: res.data[0].id }));
        }
      })
      .catch(() => setError('Could not load open cohorts.'))
      .finally(() => setLoadingCohorts(false));
  }, []);

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.cohort_id) {
      setError('Please select a cohort.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authAPI.apply(form);
      const { access_token, refresh_token, user } = res.data;
      setSession(access_token, refresh_token, user); // redirects to /applicant-portal
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Application failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/Logo.svg" alt="MentorLed" width={200} height={32} priority />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Apply to a Cohort</p>
        </div>

        {loadingCohorts ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        ) : cohorts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              There are no cohorts accepting applications right now. Please check back later.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Cohort</label>
              <select
                value={form.cohort_id}
                onChange={(e) => update('cohort_id', e.target.value)}
                className={inputClass}
                required
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Full Name</label>
                <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ada Lovelace" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Role</label>
                <select value={form.role} onChange={(e) => update('role', e.target.value)} className={inputClass} required>
                  {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Email Address</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Password</label>
              <input type="password" className={inputClass} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="At least 8 characters" required />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">You'll use this to log in and submit challenges.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">GitHub <span className="font-normal text-gray-400">(optional)</span></label>
                <input className={inputClass} value={form.github_url} onChange={(e) => update('github_url', e.target.value)} placeholder="github.com/you" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Portfolio <span className="font-normal text-gray-400">(optional)</span></label>
                <input className={inputClass} value={form.portfolio_url} onChange={(e) => update('portfolio_url', e.target.value)} placeholder="yoursite.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">LinkedIn <span className="font-normal text-gray-400">(optional)</span></label>
              <input className={inputClass} value={form.linkedin_url} onChange={(e) => update('linkedin_url', e.target.value)} placeholder="linkedin.com/in/you" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Tell us about a project you're proud of <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea className={inputClass} rows={3} value={form.project_description} onChange={(e) => update('project_description', e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.time_commitment} onChange={(e) => update('time_commitment', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              I can commit the required hours per week to the fellowship.
            </label>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already applied?{' '}
          <Link href="/login" className="font-semibold text-green-600 hover:text-green-700">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
