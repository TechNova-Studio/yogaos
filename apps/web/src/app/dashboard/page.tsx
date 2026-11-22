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
import {
  Calendar,
  Users,
  CreditCard,
  Layers,
  Building2,
  RefreshCw,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, memberships, activeTenantId, activeRole, isLoading } = useAuth();

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
      setCreatingOrg(false);
      setOrgName('');
      setOrgSlug('');
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create organization');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <p className="text-sm font-medium text-stone-500">Verifying studio session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Authentication Required</h2>
        <p className="mt-2 max-w-sm text-sm text-stone-600">
          Please sign in to access your studio management workspace and live conductor engine.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/login">
            <Button variant="primary" size="md">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="md">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in-50 duration-300">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              {activeOrg ? activeOrg.organizationName : 'Studio Dashboard'}
            </h1>
            {userRole && (
              <Badge
                variant={userRole === 'OWNER' ? 'default' : userRole === 'MANAGER' ? 'success' : 'outline'}
                className="text-xs uppercase font-bold tracking-wider px-2 py-0.5"
              >
                {userRole}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Hub
            </span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-stone-600">
            Studio Operations & Live Metric Control Center • Logged in as <span className="font-semibold text-stone-900">{user.fullName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData()}
            disabled={loadingMetrics}
            className="h-9 px-3 text-xs font-medium shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            {loadingMetrics ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant={creatingOrg ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setCreatingOrg(!creatingOrg)}
            className="h-9 px-3 text-xs font-medium shadow-2xs"
          >
            {creatingOrg ? 'Cancel' : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Studio
              </>
            )}
          </Button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs sm:text-sm font-medium text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm font-medium text-red-800 shadow-2xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Studio Creation Form Card */}
      {creatingOrg && (
        <Card className="border-emerald-300 bg-emerald-50/30 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Create Studio Organization</CardTitle>
            <CardDescription className="text-xs">
              Set up a new isolated multi-branch yoga studio organization with dedicated GST invoicing, instructors, and class schedules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4 max-w-md">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Studio Name</label>
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
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Studio Slug (URL key)</label>
                <input
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="prana-yoga-shala"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <Button variant="primary" type="submit" size="sm" className="h-9 px-4">
                Create & Become Owner
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeOrg ? (
        <>
          {/* Operational Filter Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-white p-3 sm:px-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-stone-400 shrink-0" />
                <label htmlFor="branch-select" className="text-xs font-semibold text-stone-600">Branch:</label>
                <select
                  id="branch-select"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-stone-50/70 px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:border-emerald-500 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-[1px] bg-stone-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-400 shrink-0" />
                <label htmlFor="date-filter" className="text-xs font-semibold text-stone-600">Date:</label>
                <input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-stone-50/70 px-2 py-1 text-xs font-medium text-stone-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                  className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
              <span>Tenant:</span>
              <span className="font-mono text-stone-700 truncate max-w-[150px] sm:max-w-none">{activeTenantId}</span>
            </div>
          </div>

          {/* Operational KPI Metric Cards */}
          {data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Classes & Capacity Card */}
              <Card className="hover:border-stone-300 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription className="text-[11px] uppercase font-bold tracking-wider text-stone-500">
                    Sessions & Capacity
                  </CardDescription>
                  <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
                    <Calendar className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    {data.attendanceSummary.totalScheduledToday} <span className="text-sm font-semibold text-stone-500">Classes</span>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Capacity Utilization:</span>
                      <span className="font-semibold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                        {data.capacityUtilization.utilizationPercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Booked Seats:</span>
                      <span className="font-medium text-stone-800">
                        {data.capacityUtilization.totalBooked} / {data.capacityUtilization.totalCapacity}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Card */}
              <Card className="hover:border-stone-300 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription className="text-[11px] uppercase font-bold tracking-wider text-stone-500">
                    Today Attendance
                  </CardDescription>
                  <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
                    <Users className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                    {data.attendanceSummary.attendanceRatePercentage}% <span className="text-sm font-semibold text-stone-500">Rate</span>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Attended Check-ins:</span>
                      <span className="font-semibold text-emerald-700">{data.attendanceSummary.totalAttended}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">No-Shows / Late Cancels:</span>
                      <span className="font-semibold text-amber-700">
                        {data.attendanceSummary.totalNoShow} / {data.attendanceSummary.totalLateCancel}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Memberships Card */}
              <Card className="hover:border-stone-300 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription className="text-[11px] uppercase font-bold tracking-wider text-stone-500">
                    Active Memberships
                  </CardDescription>
                  <div className="rounded-lg bg-stone-100 p-1.5 text-stone-700">
                    <Layers className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    {data.membershipAlerts.activeCount} <span className="text-sm font-semibold text-stone-500">Active</span>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Expiring (7 days):</span>
                      <span className={`font-semibold ${data.membershipAlerts.expiringIn7DaysCount > 0 ? 'text-amber-600' : 'text-stone-800'}`}>
                        {data.membershipAlerts.expiringIn7DaysCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Expired Unrenewed:</span>
                      <span className="font-medium text-stone-700">{data.membershipAlerts.expiredUnrenewedCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary Card */}
              <Card className="hover:border-stone-300 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription className="text-[11px] uppercase font-bold tracking-wider text-stone-500">
                    Billing & Revenue
                  </CardDescription>
                  <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.financialSummary ? (
                    <>
                      <div className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                        ₹{data.financialSummary.totalCollectedMonth.toLocaleString('en-IN')}
                      </div>
                      <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs text-stone-600">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Collected Today:</span>
                          <span className="font-semibold text-emerald-700">
                            ₹{data.financialSummary.totalCollectedToday.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Overdue Balance:</span>
                          <span className="font-semibold text-red-600">
                            ₹{data.financialSummary.totalOverdueAmount.toLocaleString('en-IN')} ({data.financialSummary.overdueInvoicesCount} inv)
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-2">
                      <Badge variant="outline" className="text-xs">Restricted to Owner/Manager</Badge>
                      <p className="mt-2 text-xs text-stone-400">
                        Front-desk and instructor staff access restricted by policy.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lead Pipeline Overview Bar */}
          {data && (
            <Card>
              <CardHeader className="py-3.5 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-700" />
                    <CardTitle className="text-sm sm:text-base font-bold text-stone-900">
                      Lead & Enquiry Pipeline
                    </CardTitle>
                  </div>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    Conversion Rate: {data.leadPipeline.conversionRatePercentage}% ({data.leadPipeline.convertedLeads} enrolled)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 sm:px-6 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 text-center">
                  <div className="rounded-lg border border-stone-200/80 bg-stone-50/80 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Total Leads</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-stone-900">{data.leadPipeline.totalLeads}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">New</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-blue-900">{data.leadPipeline.newLeads}</p>
                  </div>
                  <div className="rounded-lg border border-purple-200/80 bg-purple-50/50 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">Contacted</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-purple-900">{data.leadPipeline.contactedLeads}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Trial Booked</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-amber-900">{data.leadPipeline.trialBookedLeads}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Converted</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-emerald-900">{data.leadPipeline.convertedLeads}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200/80 bg-stone-50 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Lost</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-stone-600">{data.leadPipeline.lostLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Scheduled Sessions Table & Conductor Quick Launch */}
          <Card>
            <CardHeader className="py-4 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-stone-900">
                    Today&apos;s Class Schedule & Conductor
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live session list with real-time booking rosters, attendance, and Automated Conductor controls.
                  </CardDescription>
                </div>
                <Link href="/conductor" className="shrink-0">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                    <Play className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Open Conductor Engine
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-6 pb-4">
              {data && data.todaySessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="border-y border-stone-200 bg-stone-50/80 text-stone-600 font-semibold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Class & Batch</th>
                        <th className="py-3 px-4">Branch / Room</th>
                        <th className="py-3 px-4">Instructor</th>
                        <th className="py-3 px-4">Roster / Cap</th>
                        <th className="py-3 px-4">Conductor</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.todaySessions.map((session) => (
                        <tr key={session.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-stone-800 whitespace-nowrap">
                            {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-stone-900">{session.classTemplateName}</p>
                            {session.batchName && (
                              <p className="text-[11px] text-stone-500">{session.batchName}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-stone-800">{session.branchName}</p>
                            <p className="text-[11px] text-stone-500">{session.roomName}</p>
                          </td>
                          <td className="py-3 px-4 text-stone-700 font-medium">{session.instructorName}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-stone-900">{session.bookedCount}</span>
                            <span className="text-stone-500"> / {session.capacity}</span>
                            {session.waitlistCount > 0 && (
                              <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                {session.waitlistCount} waitlist
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
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
                                className="text-[10px] font-bold"
                              >
                                {session.conductorStatus}
                              </Badge>
                            ) : (
                              <span className="text-stone-400 text-xs">Ready</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Link href={`/conductor`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
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
                <div className="py-10 text-center text-stone-500 px-4">
                  <Calendar className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                  <p className="text-sm font-semibold text-stone-700">No classes scheduled for this date & branch filter.</p>
                  <p className="text-xs text-stone-400 mt-1">Select another branch or date, or schedule a new class batch.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integrations & Notifications Hub */}
          {data && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Payment Gateways & Integrations Card */}
              <Card>
                <CardHeader className="py-4 px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg font-bold">Integrations & Gateway Health</CardTitle>
                  <CardDescription className="text-xs">
                    Provider connection status and webhook health.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6 pb-6 pt-0">
                  <div className="space-y-2.5">
                    {data.integrations.gateways.map((g) => (
                      <div
                        key={g.provider}
                        className="flex items-center justify-between rounded-xl border border-stone-200/90 bg-stone-50/50 p-3 hover:bg-stone-50 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-stone-900 text-xs sm:text-sm">{g.provider}</p>
                          <p className="text-[11px] text-stone-500">
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
                          className="text-[10px] font-bold"
                        >
                          {g.status}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3 text-xs">
                    <span className="font-medium text-stone-600">Webhook Exceptions:</span>
                    <Badge variant={data.integrations.webhookExceptionsCount > 0 ? 'destructive' : 'success'}>
                      {data.integrations.webhookExceptionsCount} Failed
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3 text-xs">
                    <span className="font-medium text-stone-600">Background Worker:</span>
                    <Badge variant={data.integrations.workerStatus === 'HEALTHY' ? 'success' : 'destructive'}>
                      {data.integrations.workerStatus}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Notifications & Reminders Delivery Status */}
              <Card>
                <CardHeader className="py-4 px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg font-bold">Notifications & Reminders</CardTitle>
                  <CardDescription className="text-xs">
                    Multi-channel delivery overview (WhatsApp, SMS, Email).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6 pb-6 pt-0">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                      <p className="text-[11px] font-semibold text-stone-500">Total</p>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-stone-800">
                        {data.integrations.notifications.totalReminders}
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                      <p className="text-[11px] font-semibold text-emerald-700">Delivered</p>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-emerald-800">
                        {data.integrations.notifications.deliveredCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5">
                      <p className="text-[11px] font-semibold text-blue-700">Pending</p>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-blue-800">
                        {data.integrations.notifications.pendingCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-2.5">
                      <p className="text-[11px] font-semibold text-red-700">Failed</p>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-red-800">
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
                            className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-2.5 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-stone-900">
                                {f.reminderType} ({f.channel})
                              </p>
                              <p className="text-[11px] text-stone-500">
                                To: {f.recipientContact} • Error: {f.lastError || 'Undelivered'}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retryingId === f.id}
                              onClick={() => handleRetryReminder(f.id)}
                              className="h-7 text-xs"
                            >
                              {retryingId === f.id ? 'Retrying...' : 'Retry'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50/60 p-3 text-xs font-medium text-emerald-800 border border-emerald-200/50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>All notifications and reminders delivered without errors.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Membership Expiry Pipeline List */}
          {data && data.membershipAlerts.recentExpiring.length > 0 && (
            <Card>
              <CardHeader className="py-4 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg font-bold">Upcoming Membership Renewals</CardTitle>
                <CardDescription className="text-xs">
                  Students requiring renewal follow-up in the next 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 px-0 sm:px-6 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="border-y border-stone-200 bg-stone-50/80 text-stone-600 font-semibold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Current Plan</th>
                        <th className="py-3 px-4">Expiry Date</th>
                        <th className="py-3 px-4">Days Remaining</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.membershipAlerts.recentExpiring.map((m) => (
                        <tr key={m.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-stone-900">{m.studentName}</td>
                          <td className="py-3 px-4 text-stone-700">{m.planName}</td>
                          <td className="py-3 px-4 text-stone-600">
                            {new Date(m.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={m.daysRemaining <= 1 ? 'destructive' : m.daysRemaining <= 3 ? 'warning' : 'outline'} className="text-[10px] font-bold">
                              {m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining} days`}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link href="/memberships">
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
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
        <Card className="border-dashed border-stone-300">
          <CardHeader className="text-center py-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">No Active Studio Affiliation</CardTitle>
            <CardDescription className="max-w-md mx-auto text-xs mt-1">
              You do not currently belong to any studio organization. You can create a new studio organization to become its Studio Owner, or wait for an invitation from your studio manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button variant="primary" onClick={() => setCreatingOrg(true)} size="md" className="shadow-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Your First Studio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
