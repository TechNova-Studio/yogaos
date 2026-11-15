'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '@yogaos/ui';

export default function DashboardPage() {
  const { user, memberships, activeTenantId, activeRole, isLoading, refreshProfile } = useAuth();
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeOrg = memberships.find((m) => m.tenantId === activeTenantId);

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
      setStatusMsg('Organization created successfully!');
      setCreatingOrg(false);
      setOrgName('');
      setOrgSlug('');
      await refreshProfile();
    } catch (err: any) {
      setStatusMsg(`Error: ${err?.message || 'Failed to create studio'}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            Welcome back, {user.fullName}
          </h1>
          <p className="text-stone-600">
            Global Identity: <span className="font-mono text-xs">{user.email}</span>
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setCreatingOrg(!creatingOrg)}>
          {creatingOrg ? 'Cancel' : '+ New Studio Organization'}
        </Button>
      </div>

      {statusMsg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {statusMsg}
        </div>
      )}

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
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{activeOrg.organizationName}</CardTitle>
                <Badge variant="default">{activeRole || activeOrg.role}</Badge>
              </div>
              <CardDescription>
                Tenant ID: <span className="font-mono text-xs">{activeOrg.tenantId}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded bg-stone-50 p-4 border border-stone-100">
                <p className="text-xs font-medium text-stone-500">Role Authority</p>
                <p className="text-sm font-semibold text-stone-800 mt-1">
                  You are operating as {activeRole || activeOrg.role} for this studio.
                </p>
                <p className="text-xs text-stone-500 mt-2">
                  All queries, class rosters, attendance records, and financial reports are strictly
                  isolated to this studio tenant.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Manage Members (Phase 3)
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Schedule Classes (Phase 4)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Studio Affiliations</CardTitle>
              <CardDescription>
                You belong to {memberships.length} studio organization(s) with this single global account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-stone-100">
                {memberships.map((m) => (
                  <li key={m.tenantId} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{m.organizationName}</p>
                      <p className="text-xs text-stone-500">slug: {m.organizationSlug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.tenantId === activeTenantId ? 'success' : 'outline'}>
                        {m.role}
                      </Badge>
                      {m.tenantId === activeTenantId && (
                        <span className="text-xs font-medium text-emerald-700">Active</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
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
