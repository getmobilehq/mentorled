'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { RealtimeProvider } from '@/contexts/RealtimeContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <ToastProvider>{children}</ToastProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}
