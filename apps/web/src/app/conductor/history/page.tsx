'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import {
  ConductorSessionHistoryItem,
  ConductorSessionStatus,
} from '@yogaos/contracts';
import { Badge, Button } from '@yogaos/ui';

export default function ConductorHistoryPage() {
  const router = useRouter();
  const { user, activeTenantId } = useAuth();
  const client = getApiClient();

  const [historyItems, setHistoryItems] = useState<ConductorSessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const query: any = { limit: 50 };
        if (statusFilter !== 'ALL') {
          query.status = statusFilter as ConductorSessionStatus;
        }
        const res = await client.getConductorSessionHistory(query);
        setHistoryItems(res.items);
      } catch (err: any) {
        setError(err.message || 'Failed to load conductor session history');
      } finally {
        setLoading(false);
      }
    }

    if (activeTenantId) {
      loadHistory();
    }
  }, [activeTenantId, statusFilter]);

  const getStatusBadge = (status: ConductorSessionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-emerald-600 text-white">Completed</Badge>;
      case 'INTERRUPTED':
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Interrupted</Badge>;
      case 'INTERRUPTED_ABANDONED':
        return <Badge variant="outline" className="border-red-500 text-red-500">Abandoned</Badge>;
      case 'RUNNING':
        return <Badge variant="default" className="bg-blue-600 text-white">Running</Badge>;
      case 'PAUSED':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Paused</Badge>;
      case 'OFFLINE_READY':
        return <Badge variant="default" className="bg-indigo-600 text-white">Offline Ready</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Conductor Session History</h1>
          <p className="text-slate-400 text-sm mt-1">
            Audit logs, step completion rates, and recovery records for all conducted classes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() => router.push('/classes/schedule')}
          >
            ← Class Schedule
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap gap-2">
        {['ALL', 'COMPLETED', 'INTERRUPTED', 'INTERRUPTED_ABANDONED', 'PAUSED', 'RUNNING'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition ${
              statusFilter === s
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-950/80 border border-red-700 rounded-lg p-4 mb-6 text-red-200 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading conductor sessions...</div>
        ) : historyItems.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            No class conductor sessions found matching the filter.
          </div>
        ) : (
          <div className="space-y-4">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-lg text-white">{item.sequenceTitle}</span>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Instructor: <strong className="text-slate-300">{item.instructorName}</strong></span>
                    {item.branchName && <span>Branch: <strong className="text-slate-300">{item.branchName}</strong></span>}
                    {item.roomName && <span>Room: <strong className="text-slate-300">{item.roomName}</strong></span>}
                    <span>Date: <strong className="text-slate-300">{formatDate(item.sessionDate)}</strong></span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span>Duration: <strong className="text-slate-200">{formatDuration(item.totalElapsedSeconds)}</strong></span>
                    <span>Completed: <strong className="text-emerald-400">{item.completedStepsCount}</strong></span>
                    <span>Skipped: <strong className="text-amber-400">{item.skippedStepsCount}</strong></span>
                    <span>Events Logged: <strong className="text-slate-200">{item.eventsCount}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs"
                    onClick={() => router.push(`/conductor/history/${item.sessionInstanceId}`)}
                  >
                    View Execution Logs →
                  </Button>
                  {(item.status === 'RUNNING' || item.status === 'PAUSED' || item.status === 'INTERRUPTED') && (
                    <Button
                      variant="primary"
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
                      onClick={() => router.push(`/conductor/${item.sessionInstanceId}`)}
                    >
                      Open Conductor
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
