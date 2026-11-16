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
  StudentDetails,
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

  const [activeTab, setActiveTab] = useState<'payments' | 'refunds' | 'creditNotes' | 'taxSettings'>('payments');
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

      const [summaryData, paymentsData, refundsData, creditNotesData, taxData, studentsData] = await Promise.all([
        client.getDailyCollections(selectedDate).catch(() => null),
        client.getPayments({ limit: 50 }).catch(() => []),
        client.getRefunds({ limit: 50 }).catch(() => []),
        client.getCreditNotes().catch(() => []),
        client.getTaxSettings().catch(() => null),
        client.getStudents().catch(() => null),
      ]);

      if (summaryData) {
        setDailySummary(summaryData);
      }
      if (paymentsData) {
        setPayments(paymentsData);
      }
      if (refundsData) {
        setRefunds(refundsData);
      }
      if (creditNotesData) {
        setCreditNotes(creditNotesData);
      }
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
      setError('Please select a student and provide a valid amount');
      return;
    }
    try {
      setError(null);
      const res = await client.recordPayment({
        studentId: selectedStudentId,
        amount: Number(paymentAmount),
        paymentMode,
        utrReference: utrReference || undefined,
        notes: paymentNotes || undefined,
        idempotencyKey: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      });
      if (res) {
        setSuccessMsg(`Payment recorded successfully: Receipt #${res.receiptNumber || res.id}`);
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

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPayment || refundAmount <= 0) {
      setError('Please provide a valid refund amount');
      return;
    }
    try {
      setError(null);
      const res = await client.processRefund({
        paymentTransactionId: refundPayment.id,
        amount: Number(refundAmount),
        reason: refundReason,
        restoreMembershipCredit: refundRestoreCredits,
        idempotencyKey: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      });
      if (res) {
        setSuccessMsg(`Refund processed successfully: Refund #${res.refundNumber}`);
        setShowRefundModal(false);
        setRefundPayment(null);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to process refund');
    }
  };

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await client.updateTaxSettings({
        legalEntityName: taxFormLegalName || undefined,
        isGstRegistered: taxFormIsGst,
        gstin: taxFormIsGst ? taxFormGstin : undefined,
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
            Multi-mode payment recording, tax compliance, receipts, refunds, and daily reconciliation.
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
              Real-time settlement view across cash, UPI, cards, and bank transfers
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
              <span className="text-xs text-stone-400">{dailySummary?.transactionCount ?? 0} transactions</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Refunds Issued</span>
              <p className="text-2xl font-bold text-rose-600">
                ₹{dailySummary?.totalRefunded?.toLocaleString('en-IN') ?? '0'}
              </p>
              <span className="text-xs text-rose-400">Total adjustments</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-emerald-300">
              <span className="text-xs font-medium text-emerald-800">Net Collections</span>
              <p className="text-2xl font-bold text-emerald-700">
                ₹{dailySummary?.netCollected?.toLocaleString('en-IN') ?? '0'}
              </p>
              <span className="text-xs text-emerald-600">Settled revenue</span>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-stone-200">
              <span className="text-xs font-medium text-stone-500">Studio GST Status</span>
              <p className="text-base font-semibold text-stone-900 mt-1">
                {taxSettings?.isGstRegistered ? (
                  <Badge variant="success">GST Registered ({taxSettings.defaultTaxRatePercent}%)</Badge>
                ) : (
                  <Badge variant="outline">Unregistered (0% Tax)</Badge>
                )}
              </p>
              <span className="text-xs text-stone-400">
                State: {taxSettings?.supplierStateCode || 'DL'} • SAC: {taxSettings?.defaultSacCode || '9992'}
              </span>
            </div>
          </div>

          {/* Mode breakdown */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
            {dailySummary?.byMode &&
              Object.entries(dailySummary.byMode).map(([mode, amt]) => (
                <div key={mode} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                  <span className="font-semibold">{mode}:</span>
                  <span>₹{amt.toLocaleString('en-IN')}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-stone-200">
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
                      No payment transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const refundable = p.amount - (p.refundedAmount || 0);
                    return (
                      <tr key={p.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-stone-900">{p.receiptNumber || '—'}</span>
                          {p.utrReference && (
                            <div className="text-xs text-stone-400">UTR: {p.utrReference}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/students/${p.studentId}`} className="text-emerald-700 hover:underline font-medium">
                            {p.studentName || 'Student'}
                          </Link>
                          {p.invoiceNumber && (
                            <div className="text-xs text-stone-400">Inv: {p.invoiceNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <Badge variant="outline">{p.paymentMode}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-stone-900">₹{p.amount.toLocaleString('en-IN')}</span>
                          {p.refundedAmount > 0 && (
                            <div className="text-xs text-rose-600">Refunded: ₹{p.refundedAmount}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              p.status === 'COMPLETED'
                                ? 'success'
                                : p.status === 'REFUNDED'
                                ? 'destructive'
                                : 'warning'
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {new Date(p.paidAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage && refundable > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                              onClick={() => {
                                setRefundPayment(p);
                                setRefundAmount(refundable);
                                setShowRefundModal(true);
                              }}
                            >
                              Refund
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Refunds */}
      {activeTab === 'refunds' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Refund #</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Credit Note</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Pass Credit Restored</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                      No refunds recorded.
                    </td>
                  </tr>
                ) : (
                  refunds.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-semibold text-rose-800">{r.refundNumber}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">{r.studentName || 'Student'}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">₹{r.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-stone-600">
                        {r.creditNoteNumber ? (
                          <Badge variant="outline">{r.creditNoteNumber}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">{r.reason}</td>
                      <td className="px-4 py-3">
                        {r.creditRestored ? (
                          <Badge variant="success">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {new Date(r.createdAt).toLocaleDateString('en-IN')}
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
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Taxable Value</th>
                  <th className="px-4 py-3">Tax Adjustment</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Issued Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                      No GST credit notes issued.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-semibold text-stone-900">{cn.creditNoteNumber}</td>
                      <td className="px-4 py-3 text-xs font-medium text-emerald-700">{cn.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3 text-xs text-stone-500">{cn.reason}</td>
                      <td className="px-4 py-3">₹{cn.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-stone-500">₹{cn.taxAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-rose-700">₹{cn.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {new Date(cn.issuedAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Tax & GST Configuration */}
      {activeTab === 'taxSettings' && canManage && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Organization Tax & GST Profile</CardTitle>
            <CardDescription>
              Legal entity details, GST registration status, and place of supply settings used on issued invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTaxSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Legal Entity Name
                </label>
                <input
                  type="text"
                  value={taxFormLegalName}
                  onChange={(e) => setTaxFormLegalName(e.target.value)}
                  placeholder="e.g. Anandamayee Yoga LLP"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isGstRegistered"
                  checked={taxFormIsGst}
                  onChange={(e) => setTaxFormIsGst(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isGstRegistered" className="text-sm font-medium text-stone-900 cursor-pointer">
                  Organization is GST Registered (charge CGST/SGST/IGST on invoices)
                </label>
              </div>

              {taxFormIsGst && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md bg-stone-50 p-4 border border-stone-200">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                      15-Character GSTIN
                    </label>
                    <input
                      type="text"
                      value={taxFormGstin}
                      onChange={(e) => setTaxFormGstin(e.target.value.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      maxLength={15}
                      className="w-full font-mono uppercase rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                      10-Character PAN
                    </label>
                    <input
                      type="text"
                      value={taxFormPan}
                      onChange={(e) => setTaxFormPan(e.target.value.toUpperCase())}
                      placeholder="AAAAA0000A"
                      maxLength={10}
                      className="w-full font-mono uppercase rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxFormRate}
                    onChange={(e) => setTaxFormRate(Number(e.target.value))}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">Standard yoga rate: 18%</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Default SAC Code
                  </label>
                  <input
                    type="text"
                    value={taxFormSac}
                    onChange={(e) => setTaxFormSac(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">9992 = Training & coaching</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Supplier State Code (2-char)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={taxFormState}
                    onChange={(e) => setTaxFormState(e.target.value.toUpperCase())}
                    className="w-full font-mono uppercase rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">e.g. DL, MH, KA, HR</span>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <Button type="submit" variant="primary" className="bg-emerald-700 text-white">
                  Save Tax Configuration
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Record Payment</h3>
            <p className="text-xs text-stone-500 mb-4">
              Record receipt of cash, UPI, card or bank transfer from a student.
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Student *
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select a student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.mobilePhone ? `(${s.mobilePhone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    required
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="ONLINE">Online Payment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  UTR / Reference Number
                </label>
                <input
                  type="text"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  placeholder="e.g. UPI Ref / Bank Txn ID"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes or batch details"
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
                <Button type="submit" variant="primary" className="bg-emerald-700 text-white">
                  Record & Issue Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {showRefundModal && refundPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Process Refund</h3>
            <p className="text-xs text-stone-500 mb-4">
              Issue a refund against payment receipt #{refundPayment.receiptNumber || refundPayment.id}.
            </p>
            <form onSubmit={handleProcessRefund} className="space-y-4">
              <div>
                <span className="text-xs text-stone-500">Max Refundable Balance:</span>
                <span className="ml-2 font-bold text-stone-800">
                  ₹{(refundPayment.amount - (refundPayment.refundedAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundPayment.amount - (refundPayment.refundedAmount || 0)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  required
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
