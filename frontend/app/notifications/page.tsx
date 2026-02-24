'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { notificationsAPI } from '@/lib/api';
import { AppNotification, NotificationType } from '@/types';
import {
  Bell, Check, CheckCheck, Trash2, Search, Filter, ChevronLeft, ChevronRight,
  ShieldAlert, AlertTriangle, FileCheck, UserCheck, Calendar,
  Activity, Repeat, Megaphone, Send,
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  risk_alert: ShieldAlert,
  warning_issued: AlertTriangle,
  evaluation: FileCheck,
  acceptance: UserCheck,
  batch_complete: CheckCheck,
  meeting: Calendar,
  check_in: Activity,
  sprint: Repeat,
  system: Megaphone,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  risk_alert: 'text-red-500',
  warning_issued: 'text-yellow-500',
  evaluation: 'text-blue-500',
  acceptance: 'text-green-500',
  batch_complete: 'text-purple-500',
  meeting: 'text-indigo-500',
  check_in: 'text-teal-500',
  sprint: 'text-orange-500',
  system: 'text-gray-600',
};

const NOTIFICATION_BG: Record<string, string> = {
  risk_alert: 'bg-red-50',
  warning_issued: 'bg-yellow-50',
  evaluation: 'bg-blue-50',
  acceptance: 'bg-green-50',
  batch_complete: 'bg-purple-50',
  meeting: 'bg-indigo-50',
  check_in: 'bg-teal-50',
  sprint: 'bg-orange-50',
  system: 'bg-gray-50',
};

const TYPE_LABELS: Record<string, string> = {
  risk_alert: 'Risk Alerts',
  warning_issued: 'Warnings',
  evaluation: 'Evaluations',
  acceptance: 'Acceptances',
  batch_complete: 'Batch Ops',
  meeting: 'Meetings',
  check_in: 'Check-ins',
  sprint: 'Sprints',
  system: 'System',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const isAdmin = user?.role === 'admin';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [readFilter, setReadFilter] = useState<string>('all'); // all | unread | read
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Broadcast modal
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (typeFilter) params.type = typeFilter;
      if (readFilter === 'unread') params.unread_only = true;
      if (searchQuery) params.search = searchQuery;

      const res = await notificationsAPI.list(params as any);
      let items = res.data.notifications || [];

      // Client-side filter for "read" since backend doesn't have read_only param
      if (readFilter === 'read') {
        items = items.filter((n: AppNotification) => n.is_read);
      }

      setNotifications(items);
      setUnreadCount(res.data.unread_count || 0);
      setTotal(res.data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, readFilter, searchQuery]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time updates
  useEffect(() => {
    const unsub = subscribe('notification_created', () => {
      fetchNotifications();
    });
    return unsub;
  }, [subscribe, fetchNotifications]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* */ }
  };

  const handleMarkSelectedRead = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await notificationsAPI.markRead(ids);
      setNotifications(prev =>
        prev.map(n => selected.has(n.id) ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - ids.filter(id => {
        const n = notifications.find(nn => nn.id === id);
        return n && !n.is_read;
      }).length));
      setSelected(new Set());
    } catch { /* */ }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await notificationsAPI.bulkDelete(ids);
      setNotifications(prev => prev.filter(n => !selected.has(n.id)));
      setSelected(new Set());
      setTotal(prev => prev - ids.length);
    } catch { /* */ }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try {
        await notificationsAPI.markRead([notif.id]);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* */ }
    }
    if (notif.action_url) {
      router.push(notif.action_url);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map(n => n.id)));
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastSending(true);
    try {
      await notificationsAPI.broadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        action_url: broadcastUrl || undefined,
      });
      setBroadcastOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastUrl('');
      fetchNotifications();
    } catch { /* */ } finally {
      setBroadcastSending(false);
    }
  };

  // Group notifications by date
  const grouped: { label: string; items: AppNotification[] }[] = [];
  let lastLabel = '';
  for (const n of notifications) {
    const label = formatDate(n.created_at);
    if (label !== lastLabel) {
      grouped.push({ label, items: [n] });
      lastLabel = label;
    } else {
      grouped[grouped.length - 1].items.push(n);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} &middot; {total} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="secondary" onClick={handleMarkAllRead}>
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={() => setBroadcastOpen(true)}>
                <Send className="h-4 w-4 mr-1" />
                Broadcast
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const count = notifications.filter(n => n.type === key).length;
            const Icon = NOTIFICATION_ICONS[key] || Bell;
            const color = NOTIFICATION_COLORS[key] || 'text-gray-400';
            return (
              <button
                key={key}
                onClick={() => { setTypeFilter(typeFilter === key ? '' : key); setPage(0); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                  typeFilter === key
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${color}`} />
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{count}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filters & search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">Search</Button>
          </form>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={readFilter}
              onChange={(e) => { setReadFilter(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>

            {typeFilter && (
              <button onClick={() => { setTypeFilter(''); setPage(0); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors">
                {TYPE_LABELS[typeFilter]} &times;
              </button>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
            <Button size="sm" variant="secondary" onClick={handleMarkSelectedRead}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Mark read
            </Button>
            <Button size="sm" variant="danger" onClick={handleDeleteSelected}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-blue-600 hover:underline ml-auto">
              Clear selection
            </button>
          </div>
        )}

        {/* Notification list */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <Card>
            <div className="text-center py-16">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || typeFilter || readFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You\'re all caught up!'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Select all */}
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={selected.size === notifications.length && notifications.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-xs text-gray-500">Select all on page</span>
            </div>

            {grouped.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </h3>
                <Card padding={false}>
                  <div className="divide-y divide-gray-100">
                    {group.items.map((notif) => {
                      const Icon = NOTIFICATION_ICONS[notif.type] || Bell;
                      const iconColor = NOTIFICATION_COLORS[notif.type] || 'text-gray-400';
                      const bgColor = !notif.is_read ? (NOTIFICATION_BG[notif.type] || 'bg-blue-50/50') : '';

                      return (
                        <div
                          key={notif.id}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${bgColor}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(notif.id)}
                            onChange={() => toggleSelect(notif.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <button
                            onClick={() => handleNotificationClick(notif)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {notif.title}
                              </p>
                              {!notif.is_read && (
                                <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">{timeAgo(notif.created_at)}</span>
                              <Badge variant="default" className="text-[10px]">
                                {TYPE_LABELS[notif.type] || notif.type}
                              </Badge>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-gray-500">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Broadcast Modal (admin only) */}
        <Modal
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
          title="Broadcast Announcement"
          size="md"
        >
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Announcement title"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Write your announcement..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link URL <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={broadcastUrl}
                onChange={(e) => setBroadcastUrl(e.target.value)}
                placeholder="/cohorts or /announcements"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => setBroadcastOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={broadcastSending}>
                <Send className="h-4 w-4 mr-1" />
                {broadcastSending ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
