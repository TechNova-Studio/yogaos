'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import { Badge, Button } from '@yogaos/ui';

export function NavHeader() {
  const { user, memberships, activeTenantId, activeRole, logout, switchTenant } = useAuth();

  const activeOrg = memberships.find((m) => m.tenantId === activeTenantId);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-emerald-600" />
            <span className="font-semibold tracking-tight text-stone-900">YogaOS</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              V1
            </span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
              <Link href="/dashboard" className="text-stone-700 hover:text-emerald-700">
                Dashboard
              </Link>
              <Link href="/classes" className="text-stone-700 hover:text-emerald-700">
                Classes & Batches
              </Link>
              <Link href="/classes/schedule" className="text-stone-700 hover:text-emerald-700">
                Schedule
              </Link>
              <Link href="/bookings" className="text-stone-700 hover:text-emerald-700">
                Bookings & Rosters
              </Link>
              <Link href="/memberships/plans" className="text-stone-700 hover:text-emerald-700">
                Plans & Passes
              </Link>
              <Link href="/billing" className="text-stone-700 hover:text-emerald-700">
                Billing & Tax
              </Link>
              <Link href="/asana-library" className="text-stone-700 hover:text-emerald-700">
                Asanas
              </Link>
              <Link href="/media-library" className="text-stone-700 hover:text-emerald-700">
                Media
              </Link>
              <Link href="/students" className="text-stone-700 hover:text-emerald-700">
                Students
              </Link>
              <Link href="/leads" className="text-stone-700 hover:text-emerald-700">
                Leads
              </Link>
              {(activeRole === 'OWNER' || activeRole === 'MANAGER') && (
                <Link href="/settings" className="text-stone-700 hover:text-emerald-700">
                  Studio Settings
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Studio Organization Context Switcher */}
              {memberships.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 hidden sm:inline">Active Studio:</span>
                  <select
                    value={activeTenantId || ''}
                    onChange={(e) => switchTenant(e.target.value)}
                    className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-800 shadow-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {memberships.map((m) => (
                      <option key={m.tenantId} value={m.tenantId}>
                        {m.organizationName} ({m.role})
                      </option>
                    ))}
                  </select>
                  {activeRole && (
                    <Badge variant={activeRole === 'OWNER' ? 'default' : 'success'}>
                      {activeRole}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-700 hidden md:inline">
                  {user.fullName}
                </span>
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
