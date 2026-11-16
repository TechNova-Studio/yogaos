'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { BookingDetails, BookingStatusType } from '@yogaos/contracts';

export default function BookingsOverviewPage() {
  const { activeTenantId, token } = useAuth();
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const loadBookings = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await client.getBookings({
        status: (selectedStatus as BookingStatusType) || undefined,
        page,
        limit: 25,
      });
      setBookings(res.bookings);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [activeTenantId, selectedStatus, page]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Studio Bookings & Check-Ins
          </h1>
          <p className="text-sm text-stone-600">
            View all student class reservations, attendance records, and session rosters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/classes/schedule">
            <Button variant="outline">View Class Schedule</Button>
          </Link>
        </div>
      </div>

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

      {/* Filters Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Statuses ({total})</option>
          <option value="BOOKED">Booked</option>
          <option value="ATTENDED">Attended</option>
          <option value="NO_SHOW">No-Show</option>
          <option value="LATE_CANCEL">Late Cancel</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class Session</th>
                  <th className="px-4 py-3">Timing</th>
                  <th className="px-4 py-3">Safety Caution</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3 text-right">Roster</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                      Loading bookings...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                      No bookings found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <Link
                          href={`/students/${b.studentId}`}
                          className="text-emerald-700 hover:underline"
                        >
                          {b.studentName}
                        </Link>
                        <div className="text-xs text-stone-500">{b.studentPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-stone-900">{b.className}</div>
                        <div className="text-xs text-stone-500">{b.roomName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-700">
                        <div className="font-medium text-stone-900">
                          {b.sessionStart
                            ? new Date(b.sessionStart).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : b.sessionDate}
                        </div>
                        <div className="text-stone-500">
                          {b.sessionStart &&
                            new Date(b.sessionStart).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                        </div>
                      </td>
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
                            b.status === 'ATTENDED'
                              ? 'success'
                              : b.status === 'CANCELLED'
                              ? 'outline'
                              : b.status === 'NO_SHOW' || b.status === 'LATE_CANCEL'
                              ? 'destructive'
                              : 'default'
                          }
                        >
                          {b.status}
                        </Badge>
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
                      <td className="px-4 py-3 text-right">
                        <Link href={`/bookings/roster/${b.sessionInstanceId}`}>
                          <Button size="sm" variant="outline">
                            Roster
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
