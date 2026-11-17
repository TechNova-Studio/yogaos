'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import {
  DashboardOperationsData,
  BranchDetails,
} from '@yogaos/contracts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@yogaos/ui';

export default function DashboardPage() {
  const { user, memberships, activeTenantId, activeRole, isLoading, refreshProfile } = useAuth();
  
  // Dashboard state
  const [data, setData] = useState<DashboardOperationsData | null>(null);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // New org modal
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  const activeOrg = memberships.find((m) => m.tenantId === activeTenantId);
  const userRole = activeRole || activeOrg?.role || '';
  const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(userRole);

  const fetchDashboardData = useCallback(async () => {
    if (!activeTenantId) return;
    setLoadingMetrics(true);
    setErrorMsg(null);
    try {
      const client = getApiClient();
      const [opsData, branchList] = await Promise.all([
        client.getDashboardOperations({
          branchId: selectedBranchId || undefined,
          startDate: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
          endDate: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
        }),
        branches.length === 0 ? client.getBranches().catch(() => []) : Promise.resolve(branches),
      ]);
      setData(opsData);
      if (branches.length === 0 && branchList) {
        setBranches(branchList);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load operational dashboard metrics');
    } finally {
      setLoadingMetrics(false);
    }
  }, [activeTenantId, selectedBranchId, dateFilter, branches]);

  useEffect(() => {
    if (activeTenantId) {
      fetchDashboardData();
    }
  }, [activeTenantId, selectedBranchId, dateFilter, fetchDashboardData]);

  const handleRetryReminder = async (reminderId: string) => {
    setRetryingId(reminderId);
    setActionSuccessMsg(null);
    try {
      const client = getApiClient();
      await client.retryBillingReminder(reminderId);
      setActionSuccessMsg('Notification redelivery initiated successfully.');
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(`Failed to retry notification: ${err?.message || 'Unknown error'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const client = getApiClient();
      await client.createOrganization({
        name: orgName,
        slug: orgSlug.toLowerCase(),
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });
      setActionSuccessMsg('Organization created successfully!');
      setCreatingOrg(false);
      setOrgName('');
      setOrgSlug('');
      await refreshProfile();
    } catch (err: any) {
      setErrorMsg(`Error: ${err?.message || 'Failed to create studio'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-stone-500">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-stone-900">Authentication Required</h2>
        <p className="mt-2 text-stone-600">Please sign in to access your studio management workspace.</p>
        <div className="mt-6">
          <Link href="/login">
            <Button variant="primary">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              {activeOrg ? activeOrg.organizationName : 'Studio Dashboard'}
            </h1>
            <Badge variant="default">{userRole}</Badge>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Studio Operations & Live Metric Control Center • Logged in as <span className="font-medium text-stone-800">{user.fullName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData()} disabled={loadingMetrics}>
            {loadingMetrics ? 'Refreshing...' : '↻ Refresh Data'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreatingOrg(!creatingOrg)}>
            {creatingOrg ? 'Cancel' : '+ New Studio'}
          </Button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {actionSuccessMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Studio Creation Form */}
      {creatingOrg && (
        <Card className="border-emerald-300 bg-emerald-50/20">
          <CardHeader>
            <CardTitle>Create Studio Organization</CardTitle>
            <CardDescription>
              Set up a new isolated multi-branch yoga studio organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4 max-w-md">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">Studio Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    if (!orgSlug) {
                      setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="Prana Yoga Shala"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">Studio Slug (URL key)</label>
                <input
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="prana-yoga-shala"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <Button variant="primary" type="submit" size="sm">
                Create & Become Owner
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeOrg ? (
        <>
          {/* Operational Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-stone-600">Branch:</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-stone-600">Date:</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                  className="text-xs text-emerald-700 underline hover:text-emerald-800"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="text-xs text-stone-500">
              Tenant ID: <span className="font-mono text-stone-700">{activeTenantId}</span>
            </div>
          </div>

          {/* Operational KPI Metric Cards */}
          {data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Classes & Capacity Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase font-semibold text-stone-500">
                    Sessions & Capacity
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-stone-900">
                    {data.attendanceSummary.totalScheduledToday} Classes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-stone-600">
                  <div className="flex justify-between">
                    <span>Capacity Utilization:</span>
                    <span className="font-semibold text-stone-900">
                      {data.capacityUtilization.utilizationPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Booked Seats:</span>
                    <span>{data.capacityUtilization.totalBooked} / {data.capacityUtilization.totalCapacity}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase font-semibold text-stone-500">
                    Today Attendance
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-emerald-700">
                    {data.attendanceSummary.attendanceRatePercentage}% Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-stone-600">
                  <div className="flex justify-between">
                    <span>Attended:</span>
                    <span className="font-medium text-emerald-600">{data.attendanceSummary.totalAttended}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No-Shows / Late Cancels:</span>
                    <span className="text-amber-700 font-medium">
                      {data.attendanceSummary.totalNoShow} / {data.attendanceSummary.totalLateCancel}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Membership Alerts Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase font-semibold text-stone-500">
                    Active Memberships
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-stone-900">
                    {data.membershipAlerts.activeCount} Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-stone-600">
                  <div className="flex justify-between">
                    <span>Expiring (7 days):</span>
                    <span className="font-medium text-amber-600">
                      {data.membershipAlerts.expiringIn7DaysCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expired Unrenewed:</span>
                    <span className="font-medium text-stone-700">
                      {data.membershipAlerts.expiredUnrenewedCount}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary Card (or Role Restriction Notice) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase font-semibold text-stone-500">
                    Billing & Revenue
                  </CardDescription>
                  {data.financialSummary ? (
                    <CardTitle className="text-2xl font-bold text-stone-900">
                      ₹{data.financialSummary.totalCollectedMonth.toLocaleString('en-IN')}
                    </CardTitle>
                  ) : (
                    <div className="py-1">
                      <Badge variant="outline">Restricted to Owner/Manager</Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-stone-600">
                  {data.financialSummary ? (
                    <>
                      <div className="flex justify-between">
                        <span>Collected Today:</span>
                        <span className="font-medium text-emerald-600">
                          ₹{data.financialSummary.totalCollectedToday.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overdue Balance:</span>
                        <span className="font-medium text-red-600">
                          ₹{data.financialSummary.totalOverdueAmount.toLocaleString('en-IN')} ({data.financialSummary.overdueInvoicesCount} inv)
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-stone-400">
                      Front-desk and instructor staff access restricted by policy.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lead Pipeline Bar */}
          {data && (
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Lead & Enquiry Pipeline</CardTitle>
                  <span className="text-xs font-medium text-emerald-700">
                    Conversion Rate: {data.leadPipeline.conversionRatePercentage}% ({data.leadPipeline.convertedLeads} converted)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                  <div className="rounded bg-stone-100 p-2">
                    <p className="text-xs text-stone-500">Total Leads</p>
                    <p className="text-lg font-bold text-stone-800">{data.leadPipeline.totalLeads}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-xs text-blue-600">New</p>
                    <p className="text-lg font-bold text-blue-800">{data.leadPipeline.newLeads}</p>
                  </div>
                  <div className="rounded bg-purple-50 p-2">
                    <p className="text-xs text-purple-600">Contacted</p>
                    <p className="text-lg font-bold text-purple-800">{data.leadPipeline.contactedLeads}</p>
                  </div>
                  <div className="rounded bg-amber-50 p-2">
                    <p className="text-xs text-amber-600">Trial Booked</p>
                    <p className="text-lg font-bold text-amber-800">{data.leadPipeline.trialBookedLeads}</p>
                  </div>
                  <div className="rounded bg-emerald-50 p-2">
                    <p className="text-xs text-emerald-600">Converted</p>
                    <p className="text-lg font-bold text-emerald-800">{data.leadPipeline.convertedLeads}</p>
                  </div>
                  <div className="rounded bg-stone-50 p-2">
                    <p className="text-xs text-stone-400">Lost</p>
                    <p className="text-lg font-bold text-stone-600">{data.leadPipeline.lostLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Scheduled Sessions Table & Conductor Quick Launch */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Today&apos;s Class Schedule</CardTitle>
                  <CardDescription>
                    Live session list with real-time booking rosters, attendance, and Automated Conductor controls.
                  </CardDescription>
                </div>
                <Link href="/conductor">
                  <Button variant="outline" size="sm">
                    Open Conductor Engine ↗
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {data && data.todaySessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Class & Batch</th>
                        <th className="py-2.5 px-3">Branch / Room</th>
                        <th className="py-2.5 px-3">Instructor</th>
                        <th className="py-2.5 px-3">Roster / Cap</th>
                        <th className="py-2.5 px-3">Conductor</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.todaySessions.map((session) => (
                        <tr key={session.id} className="hover:bg-stone-50/50">
                          <td className="py-2.5 px-3 font-mono text-stone-700">
                            {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-stone-900">{session.classTemplateName}</p>
                            {session.batchName && (
                              <p className="text-[10px] text-stone-500">{session.batchName}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="text-stone-800">{session.branchName}</p>
                            <p className="text-[10px] text-stone-500">{session.roomName}</p>
                          </td>
                          <td className="py-2.5 px-3 text-stone-700">{session.instructorName}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-stone-900">{session.bookedCount}</span> / {session.capacity}
                            {session.waitlistCount > 0 && (
                              <span className="ml-1 text-[10px] text-amber-600">
                                ({session.waitlistCount} waitlist)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {session.conductorStatus ? (
                              <Badge
                                variant={
                                  session.conductorStatus === 'RUNNING'
                                    ? 'success'
                                    : session.conductorStatus === 'PAUSED'
                                    ? 'warning'
                                    : session.conductorStatus === 'COMPLETED'
                                    ? 'outline'
                                    : 'default'
                                }
                              >
                                {session.conductorStatus}
                              </Badge>
                            ) : (
                              <span className="text-stone-400">Not initialized</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link href={`/conductor`}>
                              <Button variant="outline" size="sm">
                                {session.conductorStatus ? 'Resume' : 'Launch'}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-stone-500">
                  <p className="text-sm font-medium">No classes scheduled for this date & branch filter.</p>
                  <p className="text-xs text-stone-400 mt-1">Select another branch or date, or create a new session.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integrations & Notifications Hub */}
          {data && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Payment Gateways & Integrations Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Integrations & Gateway Health</CardTitle>
                  <CardDescription>
                    Provider connection status and webhook health.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {data.integrations.gateways.map((g) => (
                      <div
                        key={g.provider}
                        className="flex items-center justify-between rounded border border-stone-200 p-3"
                      >
                        <div>
                          <p className="font-semibold text-stone-900">{g.provider}</p>
                          <p className="text-xs text-stone-500">
                            {g.isEnabled ? (g.mode === 'test' ? 'Sandbox Mode' : 'Live Mode') : 'Disabled'}
                          </p>
                        </div>
                        <Badge
                          variant={
                            g.status === 'LIVE_CONFIGURED'
                              ? 'success'
                              : g.status === 'SANDBOX_CONFIGURED'
                              ? 'warning'
                              : 'outline'
                          }
                        >
                          {g.status}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded bg-stone-50 p-3 text-xs">
                    <span className="text-stone-600">Webhook Exceptions:</span>
                    <Badge variant={data.integrations.webhookExceptionsCount > 0 ? 'destructive' : 'success'}>
                      {data.integrations.webhookExceptionsCount} Failed Webhooks
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded bg-stone-50 p-3 text-xs">
                    <span className="text-stone-600">Background Worker:</span>
                    <Badge variant={data.integrations.workerStatus === 'HEALTHY' ? 'success' : 'destructive'}>
                      {data.integrations.workerStatus}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Notifications & Reminders Delivery Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Notifications & Reminders</CardTitle>
                  <CardDescription>
                    Multi-channel delivery overview (WhatsApp, SMS, Email).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded bg-stone-100 p-2">
                      <p className="text-stone-500">Total</p>
                      <p className="text-base font-bold text-stone-800">
                        {data.integrations.notifications.totalReminders}
                      </p>
                    </div>
                    <div className="rounded bg-emerald-50 p-2">
                      <p className="text-emerald-700">Delivered</p>
                      <p className="text-base font-bold text-emerald-800">
                        {data.integrations.notifications.deliveredCount}
                      </p>
                    </div>
                    <div className="rounded bg-blue-50 p-2">
                      <p className="text-blue-700">Pending</p>
                      <p className="text-base font-bold text-blue-800">
                        {data.integrations.notifications.pendingCount}
                      </p>
                    </div>
                    <div className="rounded bg-red-50 p-2">
                      <p className="text-red-700">Failed</p>
                      <p className="text-base font-bold text-red-800">
                        {data.integrations.notifications.failedCount}
                      </p>
                    </div>
                  </div>

                  {/* Failed Reminders Actionable List */}
                  {data.integrations.notifications.failedReminders.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-stone-700">
                        Actionable Delivery Failures (1-Click Retry):
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {data.integrations.notifications.failedReminders.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between rounded border border-red-200 bg-red-50/50 p-2 text-xs"
                          >
                            <div>
                              <p className="font-medium text-stone-900">
                                {f.reminderType} ({f.channel})
                              </p>
                              <p className="text-[10px] text-stone-500">
                                To: {f.recipientContact} • Error: {f.lastError || 'Undelivered'}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retryingId === f.id}
                              onClick={() => handleRetryReminder(f.id)}
                            >
                              {retryingId === f.id ? 'Retrying...' : 'Retry'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-emerald-700 py-2">
                      ✓ All notifications and reminders delivered without errors.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Membership Expiry Pipeline List */}
          {data && data.membershipAlerts.recentExpiring.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Membership Renewals</CardTitle>
                <CardDescription>
                  Students requiring renewal follow-up in the next 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Current Plan</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3">Days Remaining</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.membershipAlerts.recentExpiring.map((m) => (
                        <tr key={m.id} className="hover:bg-stone-50/50">
                          <td className="py-2.5 px-3 font-semibold text-stone-900">{m.studentName}</td>
                          <td className="py-2.5 px-3 text-stone-700">{m.planName}</td>
                          <td className="py-2.5 px-3 text-stone-600">
                            {new Date(m.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={m.daysRemaining <= 1 ? 'destructive' : m.daysRemaining <= 3 ? 'warning' : 'outline'}>
                              {m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining} days`}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link href={`/memberships`}>
                              <Button variant="outline" size="sm">
                                Renew
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Active Studio Affiliation</CardTitle>
            <CardDescription>
              You do not currently belong to any studio organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              You can create a new studio organization to become its Studio Owner, or wait for an invitation from a studio manager.
            </p>
            <Button variant="primary" onClick={() => setCreatingOrg(true)}>
              Create Your First Studio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
