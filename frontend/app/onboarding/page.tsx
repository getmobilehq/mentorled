'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cohortsAPI } from '@/lib/api';
import {
  CheckCircle, ChevronRight, ChevronLeft, Calendar,
  Flag, Users, Rocket,
} from 'lucide-react';

const STEPS = [
  { key: 'cohort', label: 'Cohort Details', icon: Calendar },
  { key: 'challenges', label: 'Challenge Planning', icon: Flag },
  { key: 'teams', label: 'Team Formation', icon: Users },
  { key: 'launch', label: 'Review & Launch', icon: Rocket },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Cohort
  const [cohortName, setCohortName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetSize, setTargetSize] = useState(30);
  const [cohortCreated, setCohortCreated] = useState(false);
  const [cohortId, setCohortId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Step 2: Challenge planning (guidance only)
  const [challengeNotes, setChallengeNotes] = useState('');

  // Step 3: Team planning
  const [teamSize, setTeamSize] = useState(4);
  const [teamCount, setTeamCount] = useState(0);

  const handleCreateCohort = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await cohortsAPI.create({
        name: cohortName,
        start_date: startDate,
        end_date: endDate,
        target_size: targetSize,
      });
      setCohortId(res.data.id);
      setCohortCreated(true);
      setTeamCount(Math.ceil(targetSize / teamSize));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create cohort');
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return cohortCreated;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Cohort Setup</h1>
          <p className="text-sm text-gray-600 mt-1">Follow the steps to set up a new cohort</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && (
                  <div className={`flex-1 h-0.5 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-green-50 text-green-700 border border-green-200' :
                    done ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {done ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Cohort Details */}
        {step === 0 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cohort Details</h2>
            {cohortCreated ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-medium text-green-700">Cohort "{cohortName}" created successfully!</p>
                </div>
                <p className="text-sm text-green-600 mt-1">You can proceed to the next step.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cohort Name</label>
                  <input type="text" value={cohortName} onChange={(e) => setCohortName(e.target.value)}
                    placeholder="e.g., Cohort 2026 Q1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Size</label>
                  <input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))}
                    min={1} max={500} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                </div>
                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
                <Button onClick={handleCreateCohort} disabled={!cohortName || !startDate || !endDate || creating}>
                  {creating ? 'Creating...' : 'Create Cohort'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Step 2: Challenge Planning */}
        {step === 1 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Challenge Planning</h2>
            <p className="text-sm text-gray-500 mb-4">Plan the challenges for your cohort. You can create them in detail later from the Challenges page.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-700 text-sm">Screening Challenge</h3>
                  <p className="text-xs text-blue-600 mt-1">Initial skills assessment for applicants</p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-semibold text-purple-700 text-sm">Microship Challenge</h3>
                  <p className="text-xs text-purple-600 mt-1">In-depth project submission</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-700 text-sm">Track Challenges</h3>
                  <p className="text-xs text-green-600 mt-1">Role-specific track assignments</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planning Notes</label>
                <textarea value={challengeNotes} onChange={(e) => setChallengeNotes(e.target.value)}
                  rows={4} placeholder="Outline your challenge strategy, timelines, and requirements..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Team Formation */}
        {step === 2 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Formation</h2>
            <p className="text-sm text-gray-500 mb-4">Plan team structure. Teams can be created from the Teams page after fellows are accepted.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
                  <input type="number" value={teamSize} onChange={(e) => { setTeamSize(Number(e.target.value)); setTeamCount(Math.ceil(targetSize / Number(e.target.value))); }}
                    min={2} max={10} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Teams</label>
                  <div className="flex items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                    {teamCount} teams
                  </div>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                Teams will be auto-generated with sprint schedules (6 sprints, 6 meetings each) once fellows are assigned.
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Review & Launch */}
        {step === 3 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review & Launch</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-medium">Cohort</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{cohortName}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-medium">Timeline</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{startDate} to {endDate}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-medium">Target Size</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{targetSize} fellows</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-medium">Teams</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{teamCount} teams of {teamSize}</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-700">Next Steps</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-600">
                  <li>1. Create challenges on the Challenges page</li>
                  <li>2. Import or add applicants via Bulk Operations</li>
                  <li>3. Run screening evaluations</li>
                  <li>4. Accept fellows and form teams</li>
                  <li>5. Activate the cohort to begin the program</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => router.push('/challenges')}>
                  <Flag className="h-4 w-4 mr-1" /> Set Up Challenges
                </Button>
                <Button variant="secondary" onClick={() => router.push('/cohorts')}>
                  Go to Cohorts
                </Button>
                <Button variant="secondary" onClick={() => router.push('/')}>
                  Dashboard
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            size="sm" variant="secondary"
            disabled={step === 0}
            onClick={() => setStep(s => s - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button
              size="sm"
              disabled={!canProceed()}
              onClick={() => setStep(s => s + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
