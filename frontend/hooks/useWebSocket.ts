'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type WebSocketEventType =
  | 'meeting_unlocked'
  | 'attendance_recorded'
  | 'objective_completed'
  | 'check_in_submitted'
  | 'check_in_analyzed'
  | 'risk_level_changed'
  | 'sprint_completed'
  | 'absence_approved'
  | 'notification_created';

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: Record<string, any>;
  timestamp: string;
}

type EventHandler = (data: Record<string, any>) => void;

interface UseWebSocketReturn {
  connected: boolean;
  lastEvent: WebSocketMessage | null;
  subscribe: (eventType: WebSocketEventType, handler: EventHandler) => () => void;
}

const WS_URL = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000/api/ws`
  : '';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const PING_INTERVAL_MS = 25000;

export function useWebSocket(): UseWebSocketReturn {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketMessage | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const subscribe = useCallback((eventType: WebSocketEventType, handler: EventHandler): (() => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('access_token');
    if (!token || !WS_URL) return;

    let unmounted = false;

    const connect = () => {
      if (unmounted) return;

      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) { ws.close(); return; }
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_DELAY_MS;

        // Start ping interval to keep connection alive
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastEvent(message);

          // Route to subscribed handlers
          const handlers = handlersRef.current.get(message.type);
          if (handlers) {
            handlers.forEach(handler => {
              try { handler(message.data); } catch { /* ignore handler errors */ }
            });
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }

        // Reconnect with exponential backoff
        if (!unmounted) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 1.5,
              MAX_RECONNECT_DELAY_MS
            );
            connect();
          }, reconnectDelayRef.current);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      setConnected(false);
    };
  }, [user]);

  return { connected, lastEvent, subscribe };
}
