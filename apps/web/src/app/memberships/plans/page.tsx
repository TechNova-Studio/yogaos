'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  MembershipPlanDetails,
  CreateMembershipPlanRequest,
  UpdateMembershipPlanRequest,
  BranchDetails,
} from '@yogaos/contracts';

export default function MembershipPlansPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [plans, setPlans] = useState<MembershipPlanDetails[]>([]);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlanDetails | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState<'TIME_UNLIMITED' | 'CLASS_PACK' | 'SINGLE_DROP_IN'>('CLASS_PACK');
  const [price, setPrice] = useState<number>(3500);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(18);
  const [sacCode, setSacCode] = useState('9992');
  const [validityDays, setValidityDays] = useState<number>(30);
  const [creditCount, setCreditCount] = useState<number>(10);
  const [maxFreezesAllowed, setMaxFreezesAllowed] = useState<number>(1);
  const [maxFreezeDays, setMaxFreezeDays] = useState<number>(14);
  const [isMultiBranchValid, setIsMultiBranchValid] = useState(true);
  const [homeBranchId, setHomeBranchId] = useState<string>('');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';

  const loadData = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const [plansData, branchesData] = await Promise.all([
        client.getMembershipPlans({
          planType: filterType !== 'ALL' ? (filterType as any) : undefined,
          isActive: showArchived ? undefined : true,
          search: searchTerm || undefined,
        }),
        client.getBranches().catch(() => []),
      ]);
      setPlans(plansData);
      setBranches(branchesData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load membership plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenantId, filterType, showArchived]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setPlanType('CLASS_PACK');
    setPrice(3500);
    setTaxRatePercent(18);
    setSacCode('9992');
    setValidityDays(30);
    setCreditCount(10);
    setMaxFreezesAllowed(1);
    setMaxFreezeDays(14);
    setIsMultiBranchValid(true);
    setHomeBranchId(branches[0]?.id || '');
    setShowCreateModal(true);
  };

  const openEditModal = (plan: MembershipPlanDetails) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPlanType(plan.planType);
    setPrice(plan.price);
    setTaxRatePercent(plan.taxRatePercent);
    setSacCode(plan.sacCode);
    setValidityDays(plan.validityDays);
    setCreditCount(plan.creditCount || 10);
    setMaxFreezesAllowed(plan.maxFreezesAllowed);
    setMaxFreezeDays(plan.maxFreezeDays);
    setIsMultiBranchValid(plan.isMultiBranchValid);
    setHomeBranchId(plan.homeBranchId || '');
    setShowCreateModal(true);
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingPlan) {
        await client.updateMembershipPlan(editingPlan.id, {
          name,
          description: description || null,
          price,
          taxRatePercent,
          sacCode,
          validityDays,
          creditCount: planType === 'TIME_UNLIMITED' ? null : creditCount,
          maxFreezesAllowed,
          maxFreezeDays,
          isMultiBranchValid,
          homeBranchId: homeBranchId || null,
        });
        setSuccessMsg(`Plan "${name}" updated successfully`);
      } else {
        await client.createMembershipPlan({
          name,
          description: description || null,
          planType,
          price,
          taxRatePercent,
          sacCode,
          validityDays,
          creditCount: planType === 'TIME_UNLIMITED' ? null : creditCount,
          maxFreezesAllowed,
          maxFreezeDays,
          isMultiBranchValid,
          homeBranchId: homeBranchId || null,
        });
        setSuccessMsg(`Plan "${name}" created successfully`);
      }
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save membership plan');
    }
  };

  const handleArchivePlan = async (plan: MembershipPlanDetails) => {
    if (!confirm(`Are you sure you want to archive "${plan.name}"? Existing active student memberships will be preserved.`)) {
      return;
    }
    try {
      setError(null);
      await client.archiveMembershipPlan(plan.id);
      setSuccessMsg(`Plan "${plan.name}" archived`);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Membership Plans & Class Passes</h1>
          <p className="text-sm text-stone-500">
            Configure unlimited memberships, multi-class packs, drop-in passes, GST rates, and freeze limits.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateModal}>
            + Create New Plan
          </Button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          {successMsg}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search plans by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Plan Types</option>
                <option value="TIME_UNLIMITED">Unlimited Time-based</option>
                <option value="CLASS_PACK">Class Packs</option>
                <option value="SINGLE_DROP_IN">Single Drop-in</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                Include archived
              </label>
            </div>
            <div className="text-xs text-stone-500">
              Showing {plans.length} plan{plans.length === 1 ? '' : 's'}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading membership plans...</div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-sm font-semibold text-stone-900">No membership plans found</div>
            <p className="mt-1 text-xs text-stone-500">
              Get started by creating unlimited monthly plans, class packs, or drop-in passes.
            </p>
            {canManage && (
              <div className="mt-4">
                <Button size="sm" onClick={openCreateModal}>
                  Create Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? 'opacity-70 bg-stone-50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      plan.planType === 'TIME_UNLIMITED'
                        ? 'default'
                        : plan.planType === 'CLASS_PACK'
                        ? 'success'
                        : 'outline'
                    }
                  >
                    {plan.planType === 'TIME_UNLIMITED'
                      ? 'Unlimited'
                      : plan.planType === 'CLASS_PACK'
                      ? `${plan.creditCount} Classes Pack`
                      : 'Drop-In Pass'}
                  </Badge>
                  {!plan.isActive ? (
                    <span className="text-[11px] font-semibold text-stone-500 uppercase">Archived</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase">Active</span>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="rounded-lg bg-stone-50 p-3 border border-stone-100">
                  <div className="text-2xl font-bold text-stone-900">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    +{plan.taxRatePercent}% GST (SAC {plan.sacCode})
                  </div>
                </div>

                <div className="space-y-2 text-xs text-stone-600">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Validity:</span>
                    <span className="font-medium text-stone-900">{plan.validityDays} calendar days</span>
                  </div>
                  {plan.creditCount !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Class Credits:</span>
                      <span className="font-medium text-stone-900">{plan.creditCount} attendances</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Freeze Policy:</span>
                    <span className="font-medium text-stone-900">
                      {plan.maxFreezesAllowed > 0
                        ? `Up to ${plan.maxFreezesAllowed} freeze (${plan.maxFreezeDays} days max)`
                        : 'No freeze allowed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Studio Branch:</span>
                    <span className="font-medium text-stone-900">
                      {plan.isMultiBranchValid
                        ? 'All Studio Branches'
                        : plan.homeBranchName || 'Home Branch Only'}
                    </span>
                  </div>
                </div>

                {canManage && plan.isActive && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(plan)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleArchivePlan(plan)}>
                      Archive
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-900 mb-1">
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Membership Plan'}
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              {editingPlan
                ? 'Editing this plan will apply to future assignments. Existing memberships keep their historical snapshots.'
                : 'Define pricing, validity, entitlement credits, and GST tax characteristics.'}
            </p>

            <form onSubmit={handleSubmitPlan} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Monthly Unlimited Ashtanga"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Plan benefits, inclusions, or level prerequisites..."
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!editingPlan && (
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Plan Type *</label>
                  <select
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value as any)}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="TIME_UNLIMITED">Unlimited (Time-based, no credit limit)</option>
                    <option value="CLASS_PACK">Class Pack (Debits 1 credit per class)</option>
                    <option value="SINGLE_DROP_IN">Single Drop-in (1 class attendance)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Validity (Days) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={validityDays}
                    onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {planType !== 'TIME_UNLIMITED' && (
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Class Credits Count {planType === 'CLASS_PACK' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required={planType === 'CLASS_PACK'}
                    value={creditCount}
                    onChange={(e) => setCreditCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">SAC Code</label>
                  <input
                    type="text"
                    value={sacCode}
                    onChange={(e) => setSacCode(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Max Freezes Allowed</label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezesAllowed}
                    onChange={(e) => setMaxFreezesAllowed(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Max Freeze Days</label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezeDays}
                    onChange={(e) => setMaxFreezeDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={isMultiBranchValid}
                    onChange={(e) => setIsMultiBranchValid(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Valid Across All Branches (Multi-branch)
                </label>

                {!isMultiBranchValid && (
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Home Branch Restriction</label>
                    <select
                      value={homeBranchId}
                      onChange={(e) => setHomeBranchId(e.target.value)}
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
