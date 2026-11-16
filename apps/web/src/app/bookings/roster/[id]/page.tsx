'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  SessionRoster,
  BookingDetails,
  WaitlistEntryDetails,
  StudentSummary,
} from '@yogaos/contracts';

export default function SessionRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  const { activeTenantId, activeRole, token } = useAuth();
  const [roster, setRoster] = useState<SessionRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Student Search / Booking Modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Cancellation Modal
  const [cancelBookingItem, setCancelBookingItem] = useState<BookingDetails | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage =
    activeRole === 'OWNER' ||
    activeRole === 'MANAGER' ||
    activeRole === 'RECEPTIONIST' ||
    activeRole === 'INSTRUCTOR';

  const loadRoster = async () => {
    if (!activeTenantId || !sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await client.getSessionRoster(sessionId);
      setRoster(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load session roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [activeTenantId, sessionId]);

  // Search students for booking modal
  useEffect(() => {
    if (!activeTenantId || !showBookModal || studentSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await client.getStudents({
          search: studentSearch.trim(),
          page: 1,
          limit: 8,
        });
        setSearchResults(res.students.filter((s) => s.status === 'ACTIVE'));
      } catch (err) {
        console.error('Failed to search students:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [activeTenantId, showBookModal, studentSearch]);

  // Handle Book or Waitlist submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setError('Please select an active student to proceed.');
      return;
    }

    try {
      setSubmittingBooking(true);
      setError(null);

      if (isWaitlistMode) {
        await client.joinWaitlist({
          sessionInstanceId: sessionId,
          studentId: selectedStudent.id,
          notes: bookingNotes || undefined,
        });
        setActionSuccess(`Added ${selectedStudent.fullName} to waitlist.`);
      } else {
        await client.createBooking({
          sessionInstanceId: sessionId,
          studentId: selectedStudent.id,
          source: 'FRONT_DESK',
          notes: bookingNotes || undefined,
        });
        setActionSuccess(`Confirmed booking for ${selectedStudent.fullName}.`);
      }

      setShowBookModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setBookingNotes('');
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to complete booking');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // 1-Click Attendance Marking
  const handleMarkAttendance = async (
    bookingId: string,
    status: 'ATTENDED' | 'NO_SHOW' | 'LATE_CANCEL' | 'BOOKED'
  ) => {
    try {
      setError(null);
      await client.markAttendance(bookingId, {
        status,
        checkInMethod: 'FRONT_DESK_ROSTER',
      });
      setActionSuccess(`Attendance status updated to ${status}.`);
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance');
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelBookingItem) return;

    try {
      setError(null);
      await client.cancelBooking(cancelBookingItem.id, {
        cancellationReason: cancelReason || undefined,
      });
      setCancelBookingItem(null);
      setCancelReason('');
      setActionSuccess('Booking cancelled. (Waitlist auto-promoted if queue existed).');
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel booking');
    }
  };

  // Promote Waitlist Entry
  const handlePromoteWaitlist = async (waitlistId: string) => {
    try {
      setError(null);
      await client.promoteWaitlistEntry(waitlistId);
      setActionSuccess('Waitlist entry promoted to confirmed booking.');
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to promote waitlist entry');
    }
  };

  // Remove / Cancel Waitlist Entry
  const handleCancelWaitlist = async (waitlistId: string) => {
    if (!confirm('Remove this student from the waitlist?')) return;
    try {
      setError(null);
      await client.cancelWaitlist(waitlistId);
      setActionSuccess('Waitlist entry removed.');
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to remove from waitlist');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12 text-center text-stone-500">
        Loading session roster...
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12 text-center">
        <h2 className="text-lg font-bold text-stone-900">Session Not Found</h2>
        <Link href="/classes/schedule" className="mt-4 inline-block text-sm text-emerald-700 underline">
          Back to Schedule Calendar
        </Link>
      </div>
    );
  }

  const isFull = roster.availableCapacity <= 0;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/classes/schedule" className="text-xs font-semibold text-emerald-700 hover:underline">
          ← Back to Schedule Calendar
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

      {/* Session Header Card */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              {roster.className} Roster & Check-In
            </h1>
            <Badge variant={roster.status === 'SCHEDULED' ? 'success' : 'outline'}>
              {roster.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {new Date(roster.startTimestamp).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            •{' '}
            {new Date(roster.startTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            -{' '}
            {new Date(roster.endTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            • 📍 {roster.roomName} ({roster.branchName}) • 🧘 {roster.instructorName}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {!isFull ? (
              <Button
                onClick={() => {
                  setIsWaitlistMode(false);
                  setShowBookModal(true);
                }}
              >
                + Book Student
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setIsWaitlistMode(true);
                  setShowBookModal(true);
                }}
              >
                + Add to Waitlist
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Capacity & Attendance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase">
              Confirmed Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-extrabold text-stone-900">
              {roster.bookedCount} <span className="text-xs font-normal text-stone-400">/ {roster.capacity}</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {isFull ? (
                <span className="text-amber-700 font-semibold">Session Full</span>
              ) : (
                <span className="text-emerald-700 font-semibold">{roster.availableCapacity} spots remaining</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase">
              Attended Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-extrabold text-emerald-700">
              {roster.attendedCount}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {roster.bookedCount > 0
                ? `${Math.round((roster.attendedCount / roster.bookedCount) * 100)}% check-in rate`
                : 'No bookings yet'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase">
              Waitlist Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-extrabold text-amber-600">
              {roster.waitlistCount}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {roster.waitlistCount > 0 ? 'FIFO queue active' : 'Queue empty'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase">
              Room Capacity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-extrabold text-stone-900">
              {roster.capacity} mats
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Room: {roster.roomName}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: CONFIRMED ATTENDEES ROSTER */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Class Roster & Attendance</h2>
            <p className="text-xs text-stone-500">
              Front desk 1-click attendance check-in. Non-clinical safety alerts are flagged.
            </p>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {roster.bookings.length} reservations recorded
          </span>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-700">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Safety Caution</th>
                    <th className="px-4 py-3">Booking Status</th>
                    <th className="px-4 py-3">Check-In Info</th>
                    {canManage && <th className="px-4 py-3 text-right">Attendance Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {roster.bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                        No students booked for this session yet. Click "+ Book Student" above to reserve a mat.
                      </td>
                    </tr>
                  ) : (
                    roster.bookings.map((b) => {
                      const isAttended = b.status === 'ATTENDED';
                      const isCancelled = b.status === 'CANCELLED';
                      const isNoShow = b.status === 'NO_SHOW';
                      const isLateCancel = b.status === 'LATE_CANCEL';

                      return (
                        <tr key={b.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-medium text-stone-900">
                            <Link
                              href={`/students/${b.studentId}`}
                              className="text-emerald-700 hover:underline"
                            >
                              {b.studentName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-stone-600">{b.studentPhone}</td>
                          <td className="px-4 py-3">
                            {b.hasHealthCaution ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                                ⚠️ CAUTION
                              </span>
                            ) : (
                              <span className="text-xs text-stone-400">Clear</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                isAttended
                                  ? 'success'
                                  : isCancelled
                                  ? 'outline'
                                  : isNoShow || isLateCancel
                                  ? 'destructive'
                                  : 'default'
                              }
                            >
                              {b.status}
                            </Badge>
                            {isCancelled && b.cancellationReason && (
                              <div className="text-[11px] text-stone-400 mt-0.5">
                                Reason: {b.cancellationReason}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-600">
                            {b.checkedInAt ? (
                              <div>
                                <span className="font-semibold text-stone-800">
                                  {new Date(b.checkedInAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>{' '}
                                <span className="text-stone-400">by {b.checkedInByUserName || 'Staff'}</span>
                              </div>
                            ) : (
                              <span className="text-stone-400">Not checked in</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              {!isCancelled ? (
                                <div className="inline-flex items-center gap-1.5">
                                  {!isAttended ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAttendance(b.id, 'ATTENDED')}
                                    >
                                      ✓ Check In
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMarkAttendance(b.id, 'BOOKED')}
                                    >
                                      Revert
                                    </Button>
                                  )}
                                  {!isAttended && (
                                    <>
                                      <button
                                        onClick={() => handleMarkAttendance(b.id, 'NO_SHOW')}
                                        className="rounded px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                                      >
                                        No-Show
                                      </button>
                                      <button
                                        onClick={() => handleMarkAttendance(b.id, 'LATE_CANCEL')}
                                        className="rounded px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                                      >
                                        Late Cancel
                                      </button>
                                      <button
                                        onClick={() => setCancelBookingItem(b)}
                                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-stone-400 italic">Cancelled</span>
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
      </div>

      {/* SECTION 2: WAITLIST QUEUE */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">FIFO Waitlist Queue</h2>
            <p className="text-xs text-stone-500">
              Sequential priority order. When a spot is cancelled, position #1 is automatically promoted.
            </p>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {roster.waitlist.length} waiting
          </span>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-700">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Queue Rank</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Waitlist Status</th>
                    <th className="px-4 py-3">Joined Time</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {roster.waitlist.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                        No students currently on the waitlist.
                      </td>
                    </tr>
                  ) : (
                    roster.waitlist.map((w) => (
                      <tr key={w.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-bold text-stone-900">
                          #{w.priorityRank}
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900">
                          <Link
                            href={`/students/${w.studentId}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {w.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{w.studentPhone}</td>
                        <td className="px-4 py-3">
                          <Badge variant={w.status === 'WAITING' ? 'warning' : 'outline'}>
                            {w.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {new Date(w.createdAt).toLocaleString()}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {w.status === 'WAITING' && (
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePromoteWaitlist(w.id)}
                                >
                                  Promote to Spot
                                </Button>
                                <button
                                  onClick={() => handleCancelWaitlist(w.id)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOOK / WAITLIST MODAL */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-stone-900">
              {isWaitlistMode ? 'Add Student to Waitlist' : 'Book Student into Session'}
            </h2>
            <p className="mb-4 text-xs text-stone-600">
              {isWaitlistMode
                ? 'Session is full. Student will be queued in FIFO order.'
                : `Reserving spot in ${roster.className} (${roster.availableCapacity} spots remaining).`}
            </p>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Search Active Student (by Name or Mobile) *
                </label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Type student name or phone..."
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg divide-y divide-stone-100">
                    {searchResults.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setStudentSearch(`${s.fullName} (${s.mobilePhone})`);
                          setSearchResults([]);
                        }}
                        className="cursor-pointer p-2.5 text-xs hover:bg-emerald-50 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-semibold text-stone-900">{s.fullName}</div>
                          <div className="text-stone-500">{s.mobilePhone}</div>
                        </div>
                        {s.hasHealthAlert && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            ⚠️ CAUTION
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedStudent && (
                  <div className="mt-2 rounded-md bg-stone-50 p-2.5 text-xs border border-stone-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-stone-900">Selected: </span>
                      <span>{selectedStudent.fullName}</span> ({selectedStudent.mobilePhone})
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(null);
                        setStudentSearch('');
                      }}
                      className="text-stone-400 hover:text-stone-600 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Staff Notes (Optional)
                </label>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g. Drop-in payment received, Mat requested"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBookModal(false);
                    setSelectedStudent(null);
                    setStudentSearch('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingBooking || !selectedStudent}>
                  {submittingBooking
                    ? 'Processing...'
                    : isWaitlistMode
                    ? 'Confirm Waitlist Queue'
                    : 'Confirm Booking'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION REASON MODAL */}
      {cancelBookingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-stone-900">Cancel Booking</h2>
            <p className="mb-4 text-xs text-stone-600">
              Cancel booking for <strong className="text-stone-900">{cancelBookingItem.studentName}</strong>. If a waitlist queue exists, the top student will automatically be promoted.
            </p>
            <form onSubmit={handleCancelBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Cancellation Reason (Optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Student requested, Travel, unwell"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCancelBookingItem(null);
                    setCancelReason('');
                  }}
                >
                  Keep Booking
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
