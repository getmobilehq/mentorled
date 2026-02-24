'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { auditAPI } from '@/lib/api';
import {
  Search, Filter, ChevronLeft, ChevronRight,
  User, Bot, Cpu, Clock,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  ai_model: string | null;
  ai_prompt_tokens: number | null;
  ai_completion_tokens: number | null;
  ai_cost_usd: number | null;
}

const ACTOR_ICONS: Record<string, React.ElementType> = {
  user: User,
  system: Cpu,
  ai_agent: Bot,
};

const ACTOR_COLORS: Record<string, string> = {
  user: 'text-blue-500',
  system: 'text-gray-500',
  ai_agent: 'text-purple-500',
};

const PAGE_SIZE = 30;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState(30);

  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // Fetch filter options once
  useEffect(() => {
    (async () => {
      try {
        const [actRes, entRes] = await Promise.all([
          auditAPI.getActions(),
          auditAPI.getEntityTypes(),
        ]);
        setActions(actRes.data || []);
        setEntityTypes(entRes.data || []);
      } catch { /* */ }
    })();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditAPI.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        actor_type: actorFilter || undefined,
        search: searchQuery || undefined,
        days: daysFilter,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, actorFilter, searchQuery, daysFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-600 mt-1">System activity and AI usage tracking &middot; {total} entries</p>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search actions..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">Search</Button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">All Actions</option>
                {actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">All Entities</option>
                {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setPage(0); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">All Actors</option>
                <option value="user">User</option>
                <option value="system">System</option>
                <option value="ai_agent">AI Agent</option>
              </select>
              <select value={daysFilter} onChange={(e) => { setDaysFilter(Number(e.target.value)); setPage(0); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Log table */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <Card>
            <div className="text-center py-16 text-gray-500">No audit log entries found</div>
          </Card>
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">AI Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const ActorIcon = ACTOR_ICONS[log.actor_type] || Cpu;
                    const actorColor = ACTOR_COLORS[log.actor_type] || 'text-gray-400';
                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs text-gray-600">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <ActorIcon className={`h-4 w-4 ${actorColor}`} />
                            <div>
                              <Badge variant={log.actor_type === 'ai_agent' ? 'info' : log.actor_type === 'user' ? 'success' : 'default'}>
                                {log.actor_type}
                              </Badge>
                              {log.actor_id && (
                                <p className="text-xs text-gray-500 mt-0.5 font-mono">{log.actor_id}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-gray-900">{log.action}</span>
                        </td>
                        <td className="py-3 px-4">
                          {log.entity_type ? (
                            <div>
                              <Badge variant="default">{log.entity_type}</Badge>
                              {log.entity_id && (
                                <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[120px]">{log.entity_id}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {log.ai_model ? (
                            <div className="text-xs">
                              <p className="font-medium text-purple-600">{log.ai_model}</p>
                              <p className="text-gray-500">
                                {log.ai_prompt_tokens}+{log.ai_completion_tokens} tokens
                              </p>
                              {log.ai_cost_usd && (
                                <p className="text-gray-400">${log.ai_cost_usd.toFixed(4)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
