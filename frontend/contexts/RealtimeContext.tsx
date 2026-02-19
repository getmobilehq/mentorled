'use client';

import React, { createContext, useContext } from 'react';
import { useWebSocket, WebSocketEventType, WebSocketMessage } from '@/hooks/useWebSocket';

type EventHandler = (data: Record<string, any>) => void;

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: WebSocketMessage | null;
  subscribe: (eventType: WebSocketEventType, handler: EventHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  lastEvent: null,
  subscribe: () => () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket();

  return (
    <RealtimeContext.Provider value={ws}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
