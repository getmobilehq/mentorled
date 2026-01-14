'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Configure platform settings and preferences
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <Settings className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Coming Soon</h3>
          <p className="mt-2 text-sm text-gray-600">
            Settings interface will be available in Phase 2
          </p>
        </div>
      </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
