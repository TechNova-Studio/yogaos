'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, MembershipSummary } from '@yogaos/contracts';
import { getApiClient } from '@yogaos/api-client';

interface AuthContextType {
  user: UserProfile | null;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  activeRole: string | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = getApiClient();

  const refreshProfile = async () => {
    try {
      const storedToken = localStorage.getItem('yogaos_token');
      const storedTenant = localStorage.getItem('yogaos_tenant_id');

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      client.setAuthToken(storedToken);
      if (storedTenant) {
        client.setTenantId(storedTenant);
      }

      const profile = await client.getMe();
      setUser(profile);
      setMemberships(profile.memberships || []);
      setActiveTenantId(profile.activeTenantId || storedTenant || null);
      setActiveRole(profile.activeRole || null);
      setToken(storedToken);
    } catch (err) {
      console.warn('Failed to restore session:', err);
      localStorage.removeItem('yogaos_token');
      localStorage.removeItem('yogaos_tenant_id');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await client.login({ email, password });
    setUser(res.user);
    setMemberships(res.memberships);
    setActiveTenantId(res.activeTenantId || null);
    setToken(res.token);

    if (res.activeTenantId) {
      const activeMem = res.memberships.find((m) => m.tenantId === res.activeTenantId);
      setActiveRole(activeMem?.role || null);
      localStorage.setItem('yogaos_tenant_id', res.activeTenantId);
    }

    localStorage.setItem('yogaos_token', res.token);
  };

  const logout = async () => {
    try {
      await client.logout();
    } catch (err) {
      console.warn('Error during logout:', err);
    } finally {
      localStorage.removeItem('yogaos_token');
      localStorage.removeItem('yogaos_tenant_id');
      setUser(null);
      setMemberships([]);
      setActiveTenantId(null);
      setActiveRole(null);
      setToken(null);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const res = await client.switchTenant(tenantId);
    setActiveTenantId(res.activeTenantId);
    setActiveRole(res.role);
    localStorage.setItem('yogaos_tenant_id', res.activeTenantId);
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeTenantId,
        activeRole,
        token,
        isLoading,
        login,
        logout,
        switchTenant,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
