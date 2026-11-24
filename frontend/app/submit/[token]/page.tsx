'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LogIn, UserPlus } from 'lucide-react';

/**
 * Challenge submissions now require a logged-in applicant account.
 * The old anonymous token link points here and guides users to log in or apply.
 */
export default function SubmitRedirectPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl border border-gray-200 dark:border-gray-700 text-center">
        <div className="flex justify-center mb-4">
          <Image src="/Logo.svg" alt="MentorLed" width={200} height={32} priority />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sign in to submit</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Challenge submissions now happen in your applicant portal. Log in to view the
          challenges assigned to your cohort and submit your work.
        </p>
        <div className="space-y-3">
          <Link href="/login" className="block">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2">
              <LogIn className="h-4 w-4" /> Log in
            </Button>
          </Link>
          <Link href="/apply" className="block">
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
              <UserPlus className="h-4 w-4" /> Apply to a cohort
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
