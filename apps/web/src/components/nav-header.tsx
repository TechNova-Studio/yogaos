'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { Badge, Button } from '@yogaos/ui';
import {
  Menu,
  X,
  ChevronDown,
  Building2,
  Calendar,
  Layers,
  Users,
  CreditCard,
  Sparkles,
  Settings,
  LogOut,
  Film,
  UserCheck,
} from 'lucide-react';

export function NavHeader() {
  const pathname = usePathname();
  const { user, memberships, activeTenantId, activeRole, logout, switchTenant } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [studioDropdownOpen, setStudioDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setStudioDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setStudioDropdownOpen(false);
  }, [pathname]);

  const activeOrg = memberships.find((m) => m.tenantId === activeTenantId);

  // Primary navigation links visible directly on the desktop bar
  const primaryNav = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Schedule', href: '/classes/schedule' },
    { label: 'Classes', href: '/classes' },
    { label: 'Bookings', href: '/bookings' },
    { label: 'Memberships', href: '/memberships/plans' },
    { label: 'Billing', href: '/billing' },
  ];

  // Secondary/studio navigation links grouped in the "Studio" dropdown
  const studioMenu = [
    { label: 'Students', href: '/students', icon: Users, desc: 'Student directory & health records' },
    { label: 'Leads & Enquiries', href: '/leads', icon: UserCheck, desc: 'Lead pipeline and conversions' },
    { label: 'Asana Library', href: '/asana-library', icon: Sparkles, desc: 'Poses, alignment & categories' },
    { label: 'Sequences', href: '/sequences', icon: Layers, desc: 'Class sequence builder' },
    { label: 'Media Library', href: '/media-library', icon: Film, desc: 'Audio cues & demo videos' },
  ];

  const isStudioRouteActive = [
    '/students',
    '/leads',
    '/asana-library',
    '/sequences',
    '/media-library',
    '/settings',
  ].some((path) => pathname.startsWith(path));

  const isOwnerOrManager = activeRole === 'OWNER' || activeRole === 'MANAGER';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-5 lg:px-6 xl:px-8">
        {/* Left side: Brand Logo + Desktop Nav */}
        <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-4 xl:gap-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </span>
            <span className="text-base font-bold tracking-tight text-stone-900">
              Yoga<span className="text-emerald-700">OS</span>
            </span>
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200/60">
              V1
            </span>
          </Link>

          {/* Desktop Navigation (>= 1024px) */}
          {user && (
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5" aria-label="Main Navigation">
              {primaryNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center whitespace-nowrap rounded-md px-2 xl:px-2.5 py-1.5 text-xs xl:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50/80 text-emerald-800 font-semibold shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Studio & Tools Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setStudioDropdownOpen(!studioDropdownOpen)}
                  aria-expanded={studioDropdownOpen}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 xl:px-2.5 py-1.5 text-xs xl:text-sm font-medium transition-colors cursor-pointer ${
                    isStudioRouteActive || studioDropdownOpen
                      ? 'bg-emerald-50/80 text-emerald-800 font-semibold'
                      : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                  }`}
                >
                  <span>Studio</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${studioDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {studioDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 xl:w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 z-50">
                    <div className="px-2 py-1.5 text-[10px] xl:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Studio Practice & Content
                    </div>
                    <div className="space-y-0.5">
                      {studioMenu.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setStudioDropdownOpen(false)}
                            className={`flex items-start gap-2.5 rounded-lg p-2 text-xs transition-colors ${
                              isActive ? 'bg-emerald-50 text-emerald-900' : 'text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <div className="mt-0.5 rounded-md p-1 bg-stone-100 text-stone-600 shrink-0">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-stone-900">{item.label}</div>
                              <div className="text-[11px] text-stone-500 line-clamp-1">{item.desc}</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {isOwnerOrManager && (
                      <>
                        <div className="my-1.5 border-t border-stone-100" />
                        <Link
                          href="/settings"
                          onClick={() => setStudioDropdownOpen(false)}
                          className={`flex items-center gap-2.5 rounded-lg p-2 text-xs transition-colors ${
                            pathname.startsWith('/settings')
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <div className="rounded-md p-1 bg-stone-100 text-stone-600 shrink-0">
                            <Settings className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">Studio Settings</div>
                            <div className="text-[11px] text-stone-500">Branches, rooms & integrations</div>
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Right side: Studio Context, User Info & Auth */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {user ? (
            <>
              {/* Active Studio Selector */}
              {memberships.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 rounded-lg border border-stone-200/90 bg-stone-50/80 px-2 py-1 text-xs">
                  <Building2 className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <select
                    value={activeTenantId || ''}
                    onChange={(e) => switchTenant(e.target.value)}
                    aria-label="Select Studio Organization"
                    className="max-w-[95px] md:max-w-[125px] xl:max-w-[160px] truncate bg-transparent font-medium text-stone-800 focus:outline-none cursor-pointer text-xs"
                  >
                    {memberships.map((m) => (
                      <option key={m.tenantId} value={m.tenantId}>
                        {m.organizationName}
                      </option>
                    ))}
                  </select>
                  {activeRole && (
                    <Badge
                      variant={activeRole === 'OWNER' ? 'default' : activeRole === 'MANAGER' ? 'success' : 'outline'}
                      className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0 shrink-0"
                    >
                      {activeRole}
                    </Badge>
                  )}
                </div>
              )}

              {/* User Identity & Sign Out */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden md:flex items-center gap-1.5 pl-0.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold shrink-0">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden xl:inline max-w-[110px] truncate text-xs font-medium text-stone-700">
                    {user.fullName}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                  className="h-8 px-2 sm:px-2.5 text-xs text-stone-600 hover:text-red-700 hover:border-red-200 shrink-0"
                  title="Sign out of YogaOS"
                >
                  <LogOut className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>

              {/* Mobile Menu Toggle Button (< 1024px) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex lg:hidden items-center justify-center rounded-md p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm" className="h-8 px-3 text-xs shadow-xs">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile & Tablet Slide-Down Navigation Menu (< 1024px) */}
      {user && mobileMenuOpen && (
        <div className="lg:hidden border-b border-stone-200 bg-white px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2">
          {/* Mobile Studio Context */}
          {memberships.length > 0 && (
            <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Active Studio
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={activeTenantId || ''}
                  onChange={(e) => switchTenant(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-800 focus:border-emerald-500 focus:outline-none"
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
            </div>
          )}

          {/* Primary Nav List */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Operations & Schedule
            </div>
            {primaryNav.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Practice & Content List */}
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Practice & Content
            </div>
            {studioMenu.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Icon className="h-4 w-4 text-stone-500 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isOwnerOrManager && (
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith('/settings') ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Settings className="h-4 w-4 text-stone-500 shrink-0" />
                <span>Studio Settings</span>
              </Link>
            )}
          </div>

          {/* Mobile User Profile Footer */}
          <div className="mt-5 pt-4 border-t border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-900">{user.fullName}</div>
                <div className="text-[11px] text-stone-500">{user.email}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="text-xs text-red-600 hover:bg-red-50"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
