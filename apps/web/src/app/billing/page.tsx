'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  DailyCollectionSummary,
  PaymentTransactionDetails,
  RefundRecordDetails,
  CreditNoteDetails,
  OrganizationTaxSettings,
} from '@yogaos/contracts';

export default function BillingDashboardPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dailySummary, setDailySummary] = useState<DailyCollectionSummary | null>(null);
  const [payments, setPayments] = useState<PaymentTransactionDetails[]>([]);
  const [refunds, setRefunds] = useState<RefundRecordDetails[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteDetails[]>([]);
  const [taxSettings, setTaxSettings] = useState<OrganizationTaxSettings | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  // P13 States: Renewals, Reminders, Gateways, Reconciliation
  const [upcomingRenewals, setUpcomingRenewals] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [gatewayConfigs, setGatewayConfigs] = useState<any[]>([]);
  const [reconciliationList, setReconciliationList] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<
    'payments' | 'renewals' | 'reminders' | 'gateways' | 'reconciliation' | 'refunds' | 'creditNotes' | 'taxSettings'
  >('payments');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<any>('UPI');
  const [utrReference, setUtrReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundPayment, setRefundPayment] = useState<PaymentTransactionDetails | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('Customer requested refund');
  const [refundRestoreCredits, setRefundRestoreCredits] = useState(false);

  // Renewal Modal State
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState<any | null>(null);
  const [renewCollectPayment, setRenewCollectPayment] = useState(false);
  const [renewPaymentMode, setRenewPaymentMode] = useState<any>('UPI');
  const [renewUtr, setRenewUtr] = useState('');

  // Gateway Config Form State
  const [selectedProvider, setSelectedProvider] = useState<'RAZORPAY' | 'STRIPE'>('RAZORPAY');
  const [gatewayApiKey, setGatewayApiKey] = useState('');
  const [gatewaySecret, setGatewaySecret] = useState('');
  const [gatewayWebhookSecret, setGatewayWebhookSecret] = useState('');
  const [gatewayIsTest, setGatewayIsTest] = useState(true);
  const [gatewayIsEnabled, setGatewayIsEnabled] = useState(true);

  // Reconciliation Modal State
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedReconcilePayment, setSelectedReconcilePayment] = useState<any | null>(null);
  const [newReconcileStatus, setNewReconcileStatus] = useState<any>('MATCHED');
  const [reconcileNotes, setReconcileNotes] = useState('');

  // Tax Settings Form State
  const [taxFormLegalName, setTaxFormLegalName] = useState('');
  const [taxFormIsGst, setTaxFormIsGst] = useState(false);
  const [taxFormGstin, setTaxFormGstin] = useState('');
  const [taxFormPan, setTaxFormPan] = useState('');
  const [taxFormRate, setTaxFormRate] = useState<number>(18);
  const [taxFormSac, setTaxFormSac] = useState('9992');
  const [taxFormState, setTaxFormState] = useState('DL');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';
  const canOperate = canManage || activeRole === 'RECEPTIONIST';

  const loadData = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);

      const [
        summaryData,
        paymentsData,
        refundsData,
        creditNotesData,
        taxData,
        studentsData,
        renewalsData,
        remindersData,
        gatewaysData,
        reconciliationData,
      ] = await Promise.all([
        client.getDailyCollections(selectedDate).catch(() => null),
        client.getPayments({ limit: 50 }).catch(() => []),
        client.getRefunds({ limit: 50 }).catch(() => []),
        client.getCreditNotes().catch(() => []),
        client.getTaxSettings().catch(() => null),
        client.getStudents().catch(() => null),
        client.getUpcomingRenewals({ daysAhead: 14, includeExpired: true }).catch(() => null),
        client.getBillingReminders({ limit: 50 }).catch(() => []),
        client.getGatewayConfigs().catch(() => []),
        client.getReconciliationList({ limit: 50 }).catch(() => []),
      ]);

      if (summaryData) setDailySummary(summaryData);
      if (paymentsData) setPayments(paymentsData);
      if (refundsData) setRefunds(refundsData);
      if (creditNotesData) setCreditNotes(creditNotesData);
      if (taxData) {
        setTaxSettings(taxData);
        setTaxFormLegalName(taxData.legalEntityName || '');
        setTaxFormIsGst(taxData.isGstRegistered);
        setTaxFormGstin(taxData.gstin || '');
        setTaxFormPan(taxData.panNumber || '');
        setTaxFormRate(taxData.defaultTaxRatePercent);
        setTaxFormSac(taxData.defaultSacCode);
        setTaxFormState(taxData.supplierStateCode);
      }
      if (studentsData) {
        const list = 'students' in (studentsData as any) ? (studentsData as any).students : Array.isArray(studentsData) ? studentsData : [];
        setStudents(list);
      }
      if (renewalsData && 'items' in (renewalsData as any)) setUpcomingRenewals((renewalsData as any).items);
      if (Array.isArray(remindersData)) setReminders(remindersData);
      else if (remindersData && 'items' in (remindersData as any)) setReminders((remindersData as any).items);
      if (Array.isArray(gatewaysData)) setGatewayConfigs(gatewaysData);
      if (Array.isArray(reconciliationData)) setReconciliationList(reconciliationData);
      else if (reconciliationData && 'items' in (reconciliationData as any)) setReconciliationList((reconciliationData as any).items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenantId, selectedDate]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || paymentAmount <= 0) {
      setError('Please select a student and enter a valid positive payment amount');
      return;
    }
    try {
      const res = await client.recordPayment({
        studentId: selectedStudentId,
        amount: Number(paymentAmount),
        paymentMode,
        utrReference: utrReference || undefined,
        notes: paymentNotes || undefined,
      });
      if (res) {
        setSuccessMsg(`Payment of ₹${res.amount} successfully recorded (${res.receiptNumber || res.id})`);
        setShowPaymentModal(false);
        setSelectedStudentId('');
        setPaymentAmount(0);
        setUtrReference('');
        setPaymentNotes('');
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment');
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPayment || refundAmount <= 0) return;
    try {
      const res = await client.processRefund({
        paymentTransactionId: refundPayment.id,
        amount: Number(refundAmount),
        reason: refundReason,
        refundMode: refundPayment.paymentMode,
        restoreMembershipCredit: refundRestoreCredits,
      });
      if (res) {
        setSuccessMsg(`Refund of ₹${res.amount} processed successfully (Credit Note: ${res.creditNoteId ? 'Issued' : 'N/A'})`);
        setShowRefundModal(false);
        setRefundPayment(null);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to process refund');
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenewal) return;
    try {
      const res = await client.renewMembership({
        studentMembershipId: selectedRenewal.id,
        collectPaymentNow: renewCollectPayment,
        paymentMode: renewPaymentMode,
        utrReference: renewUtr || undefined,
      });
      if (res) {
        setSuccessMsg(`Membership renewed successfully for ${selectedRenewal.studentName}!`);
        setShowRenewalModal(false);
        setSelectedRenewal(null);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to renew membership');
    }
  };

  const handleDispatchReminder = async (reminderId: string) => {
    try {
      await client.dispatchBillingReminder(reminderId);
      setSuccessMsg('Reminder dispatched successfully');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch reminder');
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.upsertGatewayConfig({
        provider: selectedProvider,
        isEnabled: gatewayIsEnabled,
        isTestMode: gatewayIsTest,
        apiKey: gatewayApiKey || undefined,
        apiSecret: gatewaySecret || undefined,
        webhookSecret: gatewayWebhookSecret || undefined,
      });
      setSuccessMsg(`${selectedProvider} configuration saved successfully`);
      setGatewaySecret('');
      setGatewayWebhookSecret('');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save gateway config');
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReconcilePayment) return;
    try {
      await client.reconcilePayment({
        paymentTransactionId: selectedReconcilePayment.id,
        reconciliationStatus: newReconcileStatus,
        notes: reconcileNotes || undefined,
      });
      setSuccessMsg('Payment reconciliation updated successfully');
      setShowReconcileModal(false);
      setSelectedReconcilePayment(null);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to reconcile payment');
    }
  };

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await client.updateTaxSettings({
        legalEntityName: taxFormLegalName,
        isGstRegistered: taxFormIsGst,
        gstin: taxFormGstin || undefined,
        panNumber: taxFormPan || undefined,
        defaultTaxRatePercent: Number(taxFormRate),
        defaultSacCode: taxFormSac,
        supplierStateCode: taxFormState.toUpperCase(),
      });
      if (res) {
        setSuccessMsg('Tax & GST settings updated successfully');
        setTaxSettings(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update tax settings');
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Billing & Revenue Operations</h1>
          <p className="text-sm text-stone-500">
            Multi-mode payments, renewals, gateways, automated reminders, and daily reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/billing/invoices">
            <Button variant="outline" size="sm">
              View Tax Invoices
            </Button>
          </Link>
          {canOperate && (
            <Button
              variant="primary"
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => setShowPaymentModal(true)}
            >
              + Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-800 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-rose-600 hover:text-rose-800">×</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-semibold text-emerald-600 hover:text-emerald-800">×</button>
        </div>
      )}

      {/* Daily Reconciliation Banner */}
      <Card className="mb-8 border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-emerald-950">Daily Collections Reconciliation</CardTitle>
            <CardDescription>
              Real-time settlement view across cash, UPI, cards, and online gateways
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-stone-600">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 shadow-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Gross Collected</span>
              <p className="text-2xl font-bold text-stone-900">
                ₹{dailySummary?.totalCollected?.toLocaleString('en-IN') ?? '0'}
              </p>
              <span className="text-xs text-emerald-700">Total verified inflows</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Refunds & Outflows</span>
              <p className="text-2xl font-bold text-rose-700">
                ₹{dailySummary?.totalRefunded?.toLocaleString('en-IN') ?? '0'}
              </p>
              <span className="text-xs text-stone-500">Approved refunds</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Net Day Settled</span>
              <p className="text-2xl font-bold text-emerald-800">
                ₹{dailySummary?.netCollected?.toLocaleString('en-IN') ?? '0'}
              </p>
              <span className="text-xs text-stone-500">Net revenue captured</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Transactions Count</span>
              <p className="text-2xl font-bold text-stone-800">
                {dailySummary?.transactionCount ?? 0}
              </p>
              <span className="text-xs text-stone-500">Receipts processed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap border-b border-stone-200">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Payments History ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('renewals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'renewals'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Renewals & Expiries ({upcomingRenewals.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reminders'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Reminders & Alerts ({reminders.length})
        </button>
        <button
          onClick={() => setActiveTab('gateways')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'gateways'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Gateways & Webhooks
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reconciliation'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Reconciliation ({reconciliationList.length})
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'refunds'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Refund Records ({refunds.length})
        </button>
        <button
          onClick={() => setActiveTab('creditNotes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'creditNotes'
              ? 'border-emerald-600 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Credit Notes ({creditNotes.length})
        </button>
        {canManage && (
          <button
            onClick={() => setActiveTab('taxSettings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'taxSettings'
                ? 'border-emerald-600 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            GST & Tax Configuration
          </button>
        )}
      </div>

      {/* Tab: Payments */}
      {activeTab === 'payments' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Receipt / Ref</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {p.receiptNumber || p.id.substring(0, 8)}
                        {p.gatewayOrderId && (
                          <div className="text-xs text-stone-400 font-mono">{p.gatewayOrderId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{p.studentName || p.studentId.substring(0, 8)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{p.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.status === 'COMPLETED'
                              ? 'success'
                              : p.status === 'REFUNDED'
                              ? 'outline'
                              : 'warning'
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && p.status === 'COMPLETED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                            onClick={() => {
                              setRefundPayment(p);
                              setRefundAmount(Number(p.amount) - Number(p.refundedAmount));
                              setShowRefundModal(true);
                            }}
                          >
                            Refund
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Renewals & Expiries */}
      {activeTab === 'renewals' && (
        <Card>
          <CardHeader>
            <CardTitle>Expiring & Lapsed Memberships</CardTitle>
            <CardDescription>
              Identify upcoming expiries and renew memberships with automatic credit ledger allocation and tax invoicing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Renewal State</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {upcomingRenewals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                        No memberships approaching expiry in this period.
                      </td>
                    </tr>
                  ) : (
                    upcomingRenewals.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900">{r.studentName}</div>
                          <div className="text-xs text-stone-400">{r.studentPhone || r.studentEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-800">{r.planName}</div>
                          <div className="text-xs text-stone-500">₹{r.planPrice}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {new Date(r.expiryDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              r.isExpired
                                ? 'destructive'
                                : r.daysRemaining <= 3
                                ? 'warning'
                                : 'success'
                            }
                          >
                            {r.isExpired ? `Expired (${Math.abs(r.daysRemaining)}d ago)` : `In ${r.daysRemaining} days`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{r.renewalStatus}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canOperate && !r.hasBeenRenewed && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                              onClick={() => {
                                setSelectedRenewal(r);
                                setShowRenewalModal(true);
                              }}
                            >
                              Renew Plan
                            </Button>
                          )}
                          {r.hasBeenRenewed && (
                            <span className="text-xs text-emerald-700 font-semibold">Renewed ✓</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Reminders & Alerts */}
      {activeTab === 'reminders' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Billing Reminders & Notifications</CardTitle>
              <CardDescription>
                Multi-channel expiry alerts and overdue invoice reminders with delivery tracking.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Scheduled / Sent</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reminders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                        No billing reminders in history.
                      </td>
                    </tr>
                  ) : (
                    reminders.map((rem) => (
                      <tr key={rem.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {rem.student?.fullName || rem.studentId?.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono bg-stone-100 px-2 py-1 rounded">
                            {rem.reminderType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{rem.channel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-600">{rem.recipient}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              rem.status === 'DELIVERED'
                                ? 'success'
                                : rem.status === 'PENDING'
                                ? 'warning'
                                : 'destructive'
                            }
                          >
                            {rem.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {rem.sentAt ? new Date(rem.sentAt).toLocaleString() : new Date(rem.scheduledFor).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {rem.status === 'PENDING' && canOperate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleDispatchReminder(rem.id)}
                            >
                              Dispatch Now
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Gateways & Webhooks */}
      {activeTab === 'gateways' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Configure Online Payment Gateway</CardTitle>
              <CardDescription>
                Razorpay (India UPI/Card/Netbanking) and Stripe (Global cards) integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGatewayConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Gateway Provider
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e: any) => setSelectedProvider(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="RAZORPAY">Razorpay (India / UPI / RuPay)</option>
                    <option value="STRIPE">Stripe (International / Cards)</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isEnabled"
                      checked={gatewayIsEnabled}
                      onChange={(e) => setGatewayIsEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="isEnabled" className="text-xs text-stone-700 cursor-pointer">
                      Enable Gateway
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isTestMode"
                      checked={gatewayIsTest}
                      onChange={(e) => setGatewayIsTest(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="isTestMode" className="text-xs text-stone-700 cursor-pointer">
                      Sandbox / Test Mode
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    API Key / Key ID
                  </label>
                  <input
                    type="text"
                    value={gatewayApiKey}
                    onChange={(e) => setGatewayApiKey(e.target.value)}
                    placeholder="rzp_test_... or pk_test_..."
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    API Secret (encrypted at rest)
                  </label>
                  <input
                    type="password"
                    value={gatewaySecret}
                    onChange={(e) => setGatewaySecret(e.target.value)}
                    placeholder="Enter new secret to update"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={gatewayWebhookSecret}
                    onChange={(e) => setGatewayWebhookSecret(e.target.value)}
                    placeholder="Enter webhook secret"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                    Save Gateway Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Endpoints & Security</CardTitle>
              <CardDescription>
                HMAC-SHA256 signature verified endpoints with idempotency and replay protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-stone-600">
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold block text-stone-800">Razorpay Webhook URL:</span>
                <code className="text-emerald-700 font-mono">https://api.yogaos.local/v1/billing/webhooks/razorpay</code>
                <span className="text-stone-400 block mt-1">Verified with X-Razorpay-Signature HMAC-SHA256</span>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold block text-stone-800">Stripe Webhook URL:</span>
                <code className="text-emerald-700 font-mono">https://api.yogaos.local/v1/billing/webhooks/stripe</code>
                <span className="text-stone-400 block mt-1">Verified with Stripe-Signature & 300s replay window</span>
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800">
                <span className="font-semibold block">Live Credentials Notice:</span>
                Neither live Razorpay nor Stripe credentials are configured on this server. Test sandbox fixtures with HMAC verification are fully operational.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Gateway Reconciliation */}
      {activeTab === 'reconciliation' && (
        <Card>
          <CardHeader>
            <CardTitle>Gateway Transactions Reconciliation</CardTitle>
            <CardDescription>
              Match external payment gateway orders against internal records to detect discrepancies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Payment State</th>
                    <th className="px-4 py-3">Reconciliation</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reconciliationList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                        No online gateway transactions to reconcile.
                      </td>
                    </tr>
                  ) : (
                    reconciliationList.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-stone-800">
                          {item.gatewayOrderId || item.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {item.student?.fullName || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{item.gatewayProvider || 'ONLINE'}</Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              item.reconciliationStatus === 'MATCHED'
                                ? 'success'
                                : item.reconciliationStatus === 'DISCREPANCY'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {item.reconciliationStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setSelectedReconcilePayment(item);
                                setNewReconcileStatus(item.reconciliationStatus);
                                setShowReconcileModal(true);
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Refunds */}
      {activeTab === 'refunds' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Refund Number</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                      No refunds recorded yet.
                    </td>
                  </tr>
                ) : (
                  refunds.map((ref) => (
                    <tr key={ref.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-900">{ref.refundNumber}</td>
                      <td className="px-4 py-3">{ref.studentName || ref.studentId.substring(0, 8)}</td>
                      <td className="px-4 py-3 font-semibold text-rose-700">
                        ₹{Number(ref.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{ref.reason}</td>
                      <td className="px-4 py-3">
                        <Badge variant="success">{ref.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Credit Notes */}
      {activeTab === 'creditNotes' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Credit Note #</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issue Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                      No credit notes issued.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-semibold text-stone-900">{cn.creditNoteNumber}</td>
                      <td className="px-4 py-3 text-stone-600">{cn.invoiceNumber || cn.invoiceId.substring(0, 8)}</td>
                      <td className="px-4 py-3 font-semibold text-rose-700">
                        ₹{Number(cn.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{cn.reason}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{cn.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {new Date(cn.issuedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: GST & Tax Configuration */}
      {activeTab === 'taxSettings' && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>GST & Tax Invoicing Rules</CardTitle>
            <CardDescription>
              Configure legal entity name, GSTIN, PAN, and default tax rates for compliant Indian tax invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTaxSettings} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Legal Entity Name *
                </label>
                <input
                  type="text"
                  value={taxFormLegalName}
                  onChange={(e) => setTaxFormLegalName(e.target.value)}
                  required
                  placeholder="e.g. Shanti Yoga Shala Private Limited"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isGst"
                  checked={taxFormIsGst}
                  onChange={(e) => setTaxFormIsGst(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isGst" className="text-xs text-stone-700 cursor-pointer">
                  GST Registered Entity (Requires 15-character GSTIN)
                </label>
              </div>

              {taxFormIsGst && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    GSTIN *
                  </label>
                  <input
                    type="text"
                    value={taxFormGstin}
                    onChange={(e) => setTaxFormGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={taxFormPan}
                  onChange={(e) => setTaxFormPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder="AAAAA0000A"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxFormRate}
                    onChange={(e) => setTaxFormRate(Number(e.target.value))}
                    min={0}
                    max={28}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    SAC Code
                  </label>
                  <input
                    type="text"
                    value={taxFormSac}
                    onChange={(e) => setTaxFormSac(e.target.value)}
                    placeholder="9992"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    State Code
                  </label>
                  <input
                    type="text"
                    value={taxFormState}
                    onChange={(e) => setTaxFormState(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="DL"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  Save GST Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Record Payment Collection</h3>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Select Student *
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.mobilePhone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  min={1}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Payment Mode *
                </label>
                <select
                  value={paymentMode}
                  onChange={(e: any) => setPaymentMode(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="ONLINE">Online Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  UTR / Reference Number
                </label>
                <input
                  type="text"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  placeholder="e.g. UPI Ref / Bank Tx ID"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  Confirm & Generate Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && selectedRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Renew Membership Plan</h3>
            <p className="text-xs text-stone-500 mb-4">
              Renew {selectedRenewal.studentName} for {selectedRenewal.planName} (₹{selectedRenewal.planPrice})
            </p>
            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="collectNow"
                  checked={renewCollectPayment}
                  onChange={(e) => setRenewCollectPayment(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="collectNow" className="text-xs text-stone-700 cursor-pointer">
                  Collect payment immediately at renewal
                </label>
              </div>

              {renewCollectPayment && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={renewPaymentMode}
                      onChange={(e: any) => setRenewPaymentMode(e.target.value)}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                      UTR / Transaction Ref
                    </label>
                    <input
                      type="text"
                      value={renewUtr}
                      onChange={(e) => setRenewUtr(e.target.value)}
                      placeholder="Optional UTR"
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRenewalModal(false);
                    setSelectedRenewal(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  Confirm Renewal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {showReconcileModal && selectedReconcilePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Reconcile Payment Transaction</h3>
            <p className="text-xs text-stone-500 mb-4">
              Order: {selectedReconcilePayment.gatewayOrderId} | Amount: ₹{selectedReconcilePayment.amount}
            </p>
            <form onSubmit={handleReconcileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Reconciliation Status
                </label>
                <select
                  value={newReconcileStatus}
                  onChange={(e: any) => setNewReconcileStatus(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="MATCHED">MATCHED</option>
                  <option value="DISCREPANCY">DISCREPANCY</option>
                  <option value="MANUALLY_RECONCILED">MANUALLY_RECONCILED</option>
                  <option value="UNMATCHED">UNMATCHED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Reconciliation Notes
                </label>
                <textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for manual override or reconciliation details"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReconcileModal(false);
                    setSelectedReconcilePayment(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  Save Reconciliation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {showRefundModal && refundPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Process Customer Refund</h3>
            <p className="text-xs text-stone-500 mb-4">
              Receipt #{refundPayment.receiptNumber || refundPayment.id.substring(0, 8)} | Max Eligible: ₹
              {Number(refundPayment.amount) - Number(refundPayment.refundedAmount)}
            </p>
            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  required
                  min={1}
                  max={Number(refundPayment.amount) - Number(refundPayment.refundedAmount)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Reason for Refund *
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                  placeholder="e.g. Student relocation, class cancellation"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {refundPayment.studentMembershipId && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="restoreCredits"
                    checked={refundRestoreCredits}
                    onChange={(e) => setRefundRestoreCredits(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="restoreCredits" className="text-xs text-stone-700 cursor-pointer">
                    Adjust membership credit balance (Credit Ledger debit)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRefundModal(false);
                    setRefundPayment(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" className="bg-rose-700 hover:bg-rose-800 text-white">
                  Confirm Refund & Credit Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
