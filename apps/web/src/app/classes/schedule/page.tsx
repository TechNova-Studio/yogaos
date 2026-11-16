'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  SessionDetails,
  BranchDetails,
  RoomDetails,
  InstructorSummary,
  SessionStatusType,
} from '@yogaos/contracts';

export default function ScheduleCalendarPage() {
  const { activeTenantId, activeRole, token } = useAuth();

  // Navigation State: Start of selected week (UTC Sunday or Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  // Filters
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [rooms, setRooms] = useState<RoomDetails[]>([]);
  const [instructors, setInstructors] = useState<InstructorSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Cancellation Modal
  const [cancelModalSession, setCancelModalSession] = useState<SessionDetails | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Reschedule / Substitute Modal
  const [rescheduleSession, setRescheduleSession] = useState<SessionDetails | null>(null);
  const [rescheduleRoomId, setRescheduleRoomId] = useState('');
  const [rescheduleInstructorId, setRescheduleInstructorId] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  // Load Filters Lookup Data
  useEffect(() => {
    if (!activeTenantId) return;
    const loadLookups = async () => {
      try {
        const [bList, instList] = await Promise.all([
          client.getBranches(),
          client.getInstructors().catch(() => []),
        ]);
        setBranches(bList);
        setInstructors(instList);
      } catch (err: any) {
        console.error('Failed to load filter lookup data:', err);
      }
    };
    loadLookups();
  }, [activeTenantId]);

  // Load Rooms for selected branch (or all rooms when branch changes)
  useEffect(() => {
    if (!activeTenantId) return;
    const branchToFetch = rescheduleSession?.branchId || selectedBranch || (branches[0]?.id ?? '');
    if (!branchToFetch) return;

    client
      .getRooms(branchToFetch)
      .then((rList) => setRooms(rList))
      .catch((err) => console.error('Failed to load rooms:', err));
  }, [activeTenantId, selectedBranch, rescheduleSession?.branchId, branches]);

  // Calculate Date Boundaries
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const startDate =
    viewMode === 'week'
      ? weekDays[0].toISOString()
      : new Date(weekDays[selectedDayOffset].setHours(0, 0, 0, 0)).toISOString();

  const endDate =
    viewMode === 'week'
      ? new Date(new Date(weekDays[6]).setHours(23, 59, 59, 999)).toISOString()
      : new Date(new Date(weekDays[selectedDayOffset]).setHours(23, 59, 59, 999)).toISOString();

  // Load Sessions for current window
  const loadSessions = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await client.getSessions({
        startDate,
        endDate,
        branchId: selectedBranch || undefined,
        instructorId: selectedInstructor || undefined,
        status: (selectedStatus as SessionStatusType) || undefined,
      });
      setSessions(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [
    activeTenantId,
    currentWeekStart,
    viewMode,
    selectedDayOffset,
    selectedBranch,
    selectedInstructor,
    selectedStatus,
  ]);

  // Navigate Weeks
  const navigateWeek = (weeks: number) => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + weeks * 7);
    setCurrentWeekStart(next);
  };

  const jumpToToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    setSelectedDayOffset(0);
  };

  // Open Reschedule Modal
  const openRescheduleModal = (session: SessionDetails) => {
    setRescheduleSession(session);
    setRescheduleRoomId(session.roomId);
    setRescheduleInstructorId(session.instructorId);

    const startObj = new Date(session.startTimestamp);
    const endObj = new Date(session.endTimestamp);

    setRescheduleDate(startObj.toISOString().slice(0, 10));
    setRescheduleStartTime(
      startObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
    setRescheduleEndTime(
      endObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  };

  // Submit Reschedule / Substitute
  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleSession) return;
    try {
      setSubmitting(true);
      setError(null);

      // Reconstruct UTC timestamps from the edited date and time
      const startDateTime = new Date(`${rescheduleDate}T${rescheduleStartTime}:00.000Z`).toISOString();
      const endDateTime = new Date(`${rescheduleDate}T${rescheduleEndTime}:00.000Z`).toISOString();

      await client.updateSession(rescheduleSession.id, {
        roomId: rescheduleRoomId,
        instructorId: rescheduleInstructorId,
        startTimestamp: startDateTime,
        endTimestamp: endDateTime,
      });

      setRescheduleSession(null);
      setActionSuccess('Session rescheduled / instructor substituted successfully.');
      await loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to update session');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Cancellation
  const handleCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalSession) return;
    try {
      setSubmitting(true);
      setError(null);
      await client.cancelSession(cancelModalSession.id, {
        cancellationReason,
      });
      setCancelModalSession(null);
      setCancellationReason('');
      setActionSuccess('Session cancelled successfully.');
      await loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel session');
    } finally {
      setSubmitting(false);
    }
  };

  // Group sessions by local date (YYYY-MM-DD)
  const sessionsByDate: Record<string, SessionDetails[]> = {};
  sessions.forEach((s) => {
    const key = new Date(s.startTimestamp).toISOString().slice(0, 10);
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    sessionsByDate[key].push(s);
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Studio Schedule & Calendar
          </h1>
          <p className="text-sm text-stone-600">
            Real-time schedule of yoga classes, room assignments, and instructor rosters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/classes">
            <Button variant="outline">Manage Batches</Button>
          </Link>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-l-md px-3 py-1.5 text-xs font-semibold border ${
                viewMode === 'week'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`rounded-r-md px-3 py-1.5 text-xs font-semibold border-t border-b border-r ${
                viewMode === 'day'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              Day View
            </button>
          </div>
        </div>
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

      {/* Navigation & Filters Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-4 border border-stone-200 shadow-sm">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigateWeek(-1)}>
            ‹ Prev Week
          </Button>
          <Button size="sm" variant="outline" onClick={jumpToToday}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigateWeek(1)}>
            Next Week ›
          </Button>
          <span className="ml-2 text-sm font-semibold text-stone-800">
            {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Instructors</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.fullName}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Week Day Header Buttons (when in Day view) */}
      {viewMode === 'day' && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {weekDays.map((d, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayOffset(idx)}
              className={`flex-1 min-w-[100px] rounded-lg p-2.5 text-center border transition-all ${
                selectedDayOffset === idx
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <div className="text-xs uppercase text-stone-500">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className="text-lg">{d.getDate()}</div>
            </button>
          ))}
        </div>
      )}

      {/* Calendar Grid / Agenda View */}
      {loading ? (
        <div className="py-16 text-center text-stone-500">Loading schedule...</div>
      ) : (
        <div
          className={`grid gap-4 ${
            viewMode === 'week'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-7'
              : 'grid-cols-1 max-w-3xl mx-auto'
          }`}
        >
          {(viewMode === 'week' ? weekDays : [weekDays[selectedDayOffset]]).map((day, idx) => {
            const dateKey = day.toISOString().slice(0, 10);
            const daySessions = sessionsByDate[dateKey] || [];
            const isToday = new Date().toISOString().slice(0, 10) === dateKey;

            return (
              <div
                key={dateKey}
                className={`flex flex-col rounded-lg border bg-stone-50/50 p-3 min-h-[360px] ${
                  isToday ? 'border-emerald-500 bg-emerald-50/20 shadow-sm' : 'border-stone-200'
                }`}
              >
                {/* Day Header */}
                <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span
                      className={`ml-1.5 inline-block text-sm font-extrabold ${
                        isToday ? 'text-emerald-700' : 'text-stone-900'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <span className="text-xs text-stone-400 font-medium">
                    {daySessions.length} {daySessions.length === 1 ? 'class' : 'classes'}
                  </span>
                </div>

                {/* Sessions in this day */}
                <div className="flex flex-col gap-2.5 flex-1">
                  {daySessions.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-stone-400 italic">
                      No classes scheduled
                    </div>
                  ) : (
                    daySessions.map((session) => {
                      const startTime = new Date(session.startTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const endTime = new Date(session.endTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isCancelled = session.status === 'CANCELLED';

                      return (
                        <div
                          key={session.id}
                          className={`rounded-md border p-2.5 text-xs transition-shadow shadow-xs hover:shadow-md ${
                            isCancelled
                              ? 'border-red-200 bg-red-50/40 text-stone-500 opacity-75'
                              : 'border-stone-200 bg-white text-stone-800'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-emerald-800">
                              {startTime} – {endTime}
                            </span>
                            <Badge
                              variant={
                                session.status === 'SCHEDULED'
                                  ? 'success'
                                  : session.status === 'IN_PROGRESS'
                                  ? 'default'
                                  : session.status === 'COMPLETED'
                                  ? 'outline'
                                  : 'destructive'
                              }
                            >
                              {session.status}
                            </Badge>
                          </div>

                          <div className="mt-1 font-bold text-stone-900 line-clamp-1">
                            {session.classTypeName}
                          </div>

                          {session.batchName && (
                            <div className="text-[11px] text-stone-500 line-clamp-1">
                              {session.batchName}
                            </div>
                          )}

                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-600">
                            <span>📍 {session.roomName}</span>
                            <span>👥 {session.capacity} mats</span>
                          </div>

                          <div className="mt-1 text-[11px] font-medium text-stone-700">
                            🧘 {session.instructorName}
                          </div>

                          {isCancelled && session.cancellationReason && (
                            <div className="mt-1 rounded bg-red-100/60 p-1 text-[10px] text-red-800">
                              Reason: {session.cancellationReason}
                            </div>
                          )}

                          {canManage && !isCancelled && (
                            <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-1.5">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/bookings/roster/${session.id}`}
                                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                                >
                                  Roster
                                </Link>
                                <Link
                                  href={`/conductor/${session.id}`}
                                  className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                                >
                                  ⏱️ Conduct
                                </Link>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openRescheduleModal(session)}
                                  className="text-[11px] font-medium text-stone-500 hover:text-stone-800"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => setCancelModalSession(session)}
                                  className="text-[11px] font-medium text-stone-400 hover:text-red-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RESCHEDULE / SUBSTITUTE MODAL */}
      {rescheduleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-stone-900">
              Reschedule Class / Substitute Instructor
            </h2>
            <p className="mb-4 text-xs text-stone-600">
              Modify the room, instructor, or time for this single session instance without
              affecting the batch recurrence series.
            </p>
            <form onSubmit={handleSaveReschedule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Room *</label>
                <select
                  required
                  value={rescheduleRoomId}
                  onChange={(e) => setRescheduleRoomId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Max {r.maxMatCapacity} mats)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Substitute Instructor *
                </label>
                <select
                  required
                  value={rescheduleInstructorId}
                  onChange={(e) => setRescheduleInstructorId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.fullName} ({i.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">End Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRescheduleSession(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Validating Conflicts...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-stone-900">Cancel Class Session Instance</h2>
            <p className="mb-4 text-xs text-stone-600">
              Provide a reason for cancelling the session on{' '}
              <strong className="text-stone-900">
                {new Date(cancelModalSession.startTimestamp).toLocaleDateString()}
              </strong>
              . This instance will be marked as cancelled.
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
                  placeholder="e.g. Instructor unwell, Studio maintenance"
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
                <Button type="submit" variant="danger" disabled={submitting}>
                  {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
