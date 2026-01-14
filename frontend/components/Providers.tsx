'use client';

import { ReactNode, useEffect } from 'react';
import { AuthProvider, setupAxiosInterceptors } from '@/contexts/AuthContext';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Setup axios interceptors once on mount
    setupAxiosInterceptors();
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
