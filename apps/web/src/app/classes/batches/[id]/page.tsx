'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { BatchDetails, SessionDetails } from '@yogaos/contracts';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.id;

  const { activeTenantId, activeRole, token } = useAuth();
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Cancellation Modal
  const [cancelModalSession, setCancelModalSession] = useState<SessionDetails | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  const loadBatchData = async () => {
    if (!activeTenantId || !batchId) return;
    try {
      setLoading(true);
      setError(null);
      const b = await client.getBatch(batchId);
      setBatch(b);

      // Load sessions for this batch (next 60 days)
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const sList = await client.getSessions({
        startDate,
        endDate,
        branchId: b.branchId,
      });
      // Filter for this batch
      setSessions(sList.filter((s) => s.batchId === batchId));
    } catch (err: any) {
      setError(err.message || 'Failed to load batch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchData();
  }, [activeTenantId, batchId]);

  const handleGenerateNext30Days = async () => {
    if (!batch) return;
    try {
      setGenerating(true);
      setError(null);
      // Next 30 days from now or last session
      const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = await client.generateBatchSessions(batch.id, targetDate);
      setActionSuccess(`Generated ${result.generatedCount} sessions successfully.`);
      await loadBatchData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate sessions');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalSession) return;
    try {
      setError(null);
      await client.cancelSession(cancelModalSession.id, {
        cancellationReason,
      });
      setCancelModalSession(null);
      setCancellationReason('');
      setActionSuccess('Session cancelled successfully.');
      await loadBatchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel session');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12 text-center text-stone-500">
        Loading batch information...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12 text-center">
        <h2 className="text-lg font-bold text-stone-900">Batch Not Found</h2>
        <Link href="/classes" className="mt-4 inline-block text-sm text-emerald-700 underline">
          Back to Classes & Batches
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb / Back Link */}
      <div className="mb-4">
        <Link href="/classes" className="text-xs font-semibold text-emerald-700 hover:underline">
          ← Back to Classes & Batches
        </Link>
      </div>

      {actionSuccess && (
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200 flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 font-bold hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">{batch.name}</h1>
            <Badge
              variant={
                batch.status === 'ACTIVE'
                  ? 'success'
                  : batch.status === 'PAUSED'
                  ? 'warning'
                  : 'outline'
              }
            >
              {batch.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {batch.classTypeName} • {batch.branchName} • {batch.roomName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/classes/schedule">
            <Button variant="outline">View on Calendar</Button>
          </Link>
          {canManage && (
            <Button onClick={handleGenerateNext30Days} disabled={generating}>
              {generating ? 'Generating...' : '+ Generate Next 30 Days'}
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-stone-900">
              {batch.daysOfWeek.map((d) => DAYS_OF_WEEK[d]).join(', ')}
            </div>
            <div className="text-sm text-stone-600 mt-1">
              {batch.startTime} - {batch.endTime} ({batch.sessionDurationMins} mins)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">Instructor & Room</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-stone-900">{batch.instructorName}</div>
            <div className="text-sm text-stone-600 mt-1">
              Room: {batch.roomName} (Max: {batch.roomMaxCapacity})
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">Capacity & Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-stone-900">
              {batch.capacity} Students{' '}
              <span className="text-xs text-stone-400 font-normal">
                / {batch.roomMaxCapacity} mats
              </span>
            </div>
            <div className="text-sm text-stone-600 mt-1">
              Started {new Date(batch.startDate).toLocaleDateString()}
              {batch.endDate ? ` • Ends ${new Date(batch.endDate).toLocaleDateString()}` : ' • Ongoing'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Session Instances List */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Generated Session Instances</h2>
          <p className="text-xs text-stone-500">
            Each individual session can be rescheduled or cancelled without breaking the recurring
            schedule series.
          </p>
        </div>
        <span className="text-xs text-stone-500 font-medium">
          {sessions.length} sessions in view window
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Session Date</th>
                  <th className="px-4 py-3">Timing (Local)</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Instructor</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                      No upcoming sessions generated. Click "+ Generate Next 30 Days" above to
                      populate sessions.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => {
                    const startDateObj = new Date(s.startTimestamp);
                    const endDateObj = new Date(s.endTimestamp);
                    const timeStr = `${startDateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} - ${endDateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`;
                    const isCancelled = s.status === 'CANCELLED';

                    return (
                      <tr key={s.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {startDateObj.toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{timeStr}</td>
                        <td className="px-4 py-3 text-stone-600">{s.roomName}</td>
                        <td className="px-4 py-3 font-medium text-stone-800">
                          {s.instructorName}
                        </td>
                        <td className="px-4 py-3">{s.capacity} mats</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              s.status === 'SCHEDULED'
                                ? 'success'
                                : s.status === 'IN_PROGRESS'
                                ? 'default'
                                : s.status === 'COMPLETED'
                                ? 'outline'
                                : 'destructive'
                            }
                          >
                            {s.status}
                          </Badge>
                          {isCancelled && s.cancellationReason && (
                            <div className="text-xs text-red-600 mt-0.5 line-clamp-1">
                              Reason: {s.cancellationReason}
                            </div>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {!isCancelled && (
                              <button
                                onClick={() => setCancelModalSession(s)}
                                className="text-xs text-stone-500 hover:text-red-700 font-medium"
                              >
                                Cancel Instance
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CANCELLATION MODAL */}
      {cancelModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-stone-900">Cancel Class Session Instance</h2>
            <p className="mb-4 text-xs text-stone-600">
              This will cancel the session on{' '}
              <strong className="text-stone-900">
                {new Date(cancelModalSession.startTimestamp).toLocaleDateString()}
              </strong>{' '}
              without affecting other recurring sessions in this batch.
            </p>
            <form onSubmit={handleCancelSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Reason for Cancellation *
                </label>
                <input
                  type="text"
                  required
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Instructor ill, Studio maintenance, Public holiday"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCancelModalSession(null);
                    setCancellationReason('');
                  }}
                >
                  Keep Session
                </Button>
                <Button type="submit" variant="danger">
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
