'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  TaxInvoiceDetails,
  PaymentTransactionDetails,
  CreditNoteDetails,
} from '@yogaos/contracts';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;
  const { activeTenantId, activeRole, token } = useAuth();

  const [invoice, setInvoice] = useState<TaxInvoiceDetails | null>(null);
  const [payments, setPayments] = useState<PaymentTransactionDetails[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<any>('UPI');
  const [utrReference, setUtrReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Void Modal State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('Issued in error');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';
  const canOperate = canManage || activeRole === 'RECEPTIONIST';

  const loadData = async () => {
    if (!activeTenantId || !invoiceId) return;
    try {
      setLoading(true);
      setError(null);
      const [inv, pays, cns] = await Promise.all([
        client.getInvoice(invoiceId),
        client.getPayments({ invoiceId }),
        client.getCreditNotes(invoiceId),
      ]);

      if (inv) {
        setInvoice(inv);
        setPaymentAmount(inv.balanceDue);
      }
      if (pays) {
        setPayments(pays);
      }
      if (cns) {
        setCreditNotes(cns);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenantId, invoiceId]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || paymentAmount <= 0) {
      setError('Please provide a valid payment amount');
      return;
    }
    try {
      setError(null);
      const res = await client.recordPayment({
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: Number(paymentAmount),
        paymentMode,
        utrReference: utrReference || undefined,
        notes: paymentNotes || undefined,
        idempotencyKey: `pay-${invoice.id}-${Date.now()}`,
      });

      if (res) {
        setSuccessMsg(`Payment recorded: Receipt #${res.receiptNumber || res.id}`);
        setShowPaymentModal(false);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment');
    }
  };

  const handleVoidInvoice = async () => {
    if (!invoice) return;
    try {
      setError(null);
      const res = await client.voidInvoice(invoice.id, voidReason);
      if (res) {
        setSuccessMsg('Invoice has been voided successfully');
        setShowVoidModal(false);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to void invoice');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center text-stone-500">
        Loading tax invoice details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center text-stone-600">
        <h2 className="text-xl font-bold mb-2">Invoice Not Found</h2>
        <Link href="/billing/invoices">
          <Button variant="outline">Return to Invoices Directory</Button>
        </Link>
      </div>
    );
  }

  const isInterState = invoice.igstAmount > 0;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Action Bar (Hidden on print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Link href="/billing/invoices" className="text-xs text-stone-500 hover:text-emerald-700">
            ← Back to Invoices
          </Link>
          <span className="text-stone-300">|</span>
          <span className="text-xs text-stone-500">Fiscal Year: {invoice.fiscalYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5"
          >
            🖨️ Print / Download PDF
          </Button>

          {canOperate && invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
            <Button
              variant="primary"
              size="sm"
              className="bg-emerald-700 text-white"
              onClick={() => {
                setPaymentAmount(invoice.balanceDue);
                setShowPaymentModal(true);
              }}
            >
              + Record Payment
            </Button>
          )}

          {canManage && invoice.amountPaid === 0 && invoice.status !== 'VOID' && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-700 border-rose-200 hover:bg-rose-50"
              onClick={() => setShowVoidModal(true)}
            >
              Void Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="print:hidden mb-6 rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-800 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-rose-600 hover:text-rose-800">×</button>
        </div>
      )}
      {successMsg && (
        <div className="print:hidden mb-6 rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-semibold text-emerald-600 hover:text-emerald-800">×</button>
        </div>
      )}

      {/* Printable Invoice Document */}
      <div className="bg-white rounded-lg border border-stone-200 p-8 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="border-b border-stone-200 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-stone-100 text-stone-700 mb-2">
                Tax Invoice
              </span>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                {invoice.supplierLegalName || 'YogaOS Studio'}
              </h1>
              {invoice.supplierGstin && (
                <div className="text-xs text-stone-600 mt-1">
                  <span className="font-semibold">GSTIN:</span> {invoice.supplierGstin}
                </div>
              )}
              <div className="text-xs text-stone-500">
                <span className="font-semibold">State & Code:</span> {invoice.supplierStateCode}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-stone-900">{invoice.invoiceNumber}</div>
              <div className="text-xs text-stone-500 mt-1">
                <span className="font-medium">Issue Date:</span>{' '}
                {new Date(invoice.issueDate).toLocaleDateString('en-IN')}
              </div>
              {invoice.dueDate && (
                <div className="text-xs text-stone-500">
                  <span className="font-medium">Due Date:</span>{' '}
                  {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                </div>
              )}
              <div className="mt-2">
                <Badge
                  variant={
                    invoice.status === 'PAID'
                      ? 'success'
                      : invoice.status === 'PARTIALLY_PAID'
                      ? 'warning'
                      : 'outline'
                  }
                >
                  {invoice.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Supply Info */}
        <div className="grid grid-cols-2 gap-8 border-b border-stone-200 pb-6 mb-6 text-sm">
          <div>
            <span className="text-xs font-semibold uppercase text-stone-400 block mb-1">
              Billed To (Student / Customer)
            </span>
            <div className="font-bold text-stone-900 text-base">{invoice.customerName}</div>
            {invoice.customerPhone && (
              <div className="text-xs text-stone-600">Mobile: {invoice.customerPhone}</div>
            )}
            {invoice.customerEmail && (
              <div className="text-xs text-stone-600">Email: {invoice.customerEmail}</div>
            )}
            {invoice.customerGstin && (
              <div className="text-xs font-mono font-medium text-stone-800 mt-1">
                Customer GSTIN: {invoice.customerGstin}
              </div>
            )}
            <div className="text-xs text-stone-500 mt-1">
              Place of Supply: State Code {invoice.customerStateCode} (
              {isInterState ? 'Inter-State IGST' : 'Intra-State CGST+SGST'})
            </div>
          </div>

          <div className="text-right text-xs text-stone-600 space-y-1">
            <span className="text-xs font-semibold uppercase text-stone-400 block mb-1">
              Payment Summary
            </span>
            <div>
              <span className="text-stone-500">Invoice Amount:</span>{' '}
              <span className="font-semibold text-stone-900">₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-stone-500">Amount Received:</span>{' '}
              <span className="font-semibold text-emerald-700">₹{invoice.amountPaid.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-stone-500">Balance Due:</span>{' '}
              <span className="font-bold text-rose-600">₹{invoice.balanceDue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 uppercase text-[10px] text-stone-500 border-y border-stone-200">
              <tr>
                <th className="py-2 px-2 text-center w-8">#</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-2">SAC</th>
                <th className="py-2 px-2 text-center">Qty</th>
                <th className="py-2 px-2 text-right">Unit Price</th>
                <th className="py-2 px-2 text-right">Discount</th>
                <th className="py-2 px-2 text-right">Taxable</th>
                {!isInterState && <th className="py-2 px-2 text-right">CGST</th>}
                {!isInterState && <th className="py-2 px-2 text-right">SGST</th>}
                {isInterState && <th className="py-2 px-2 text-right">IGST</th>}
                <th className="py-2 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.lineItems?.map((item, idx) => (
                <tr key={item.id}>
                  <td className="py-2.5 px-2 text-center text-stone-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium text-stone-900">{item.description}</td>
                  <td className="py-2.5 px-2 font-mono text-stone-500">{item.sacCode}</td>
                  <td className="py-2.5 px-2 text-center">{item.quantity}</td>
                  <td className="py-2.5 px-2 text-right">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-2 text-right">₹{item.discountAmount.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-2 text-right font-medium">₹{item.taxableAmount.toLocaleString('en-IN')}</td>
                  {!isInterState && (
                    <td className="py-2.5 px-2 text-right text-stone-600">
                      ₹{item.cgstAmount.toLocaleString('en-IN')}
                    </td>
                  )}
                  {!isInterState && (
                    <td className="py-2.5 px-2 text-right text-stone-600">
                      ₹{item.sgstAmount.toLocaleString('en-IN')}
                    </td>
                  )}
                  {isInterState && (
                    <td className="py-2.5 px-2 text-right text-stone-600">
                      ₹{item.igstAmount.toLocaleString('en-IN')}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                    ₹{item.totalAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Breakup */}
        <div className="flex justify-end border-t border-stone-200 pt-4 mb-8">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal:</span>
              <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Total Discount:</span>
                <span className="text-rose-600">-₹{invoice.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-stone-800 border-t border-stone-100 pt-1">
              <span>Taxable Value:</span>
              <span>₹{invoice.taxableAmount.toLocaleString('en-IN')}</span>
            </div>
            {!isInterState && (
              <>
                <div className="flex justify-between text-stone-600">
                  <span>CGST:</span>
                  <span>₹{invoice.cgstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>SGST:</span>
                  <span>₹{invoice.sgstAmount.toLocaleString('en-IN')}</span>
                </div>
              </>
            )}
            {isInterState && (
              <div className="flex justify-between text-stone-600">
                <span>IGST:</span>
                <span>₹{invoice.igstAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-stone-900 border-t-2 border-stone-900 pt-2">
              <span>Grand Total:</span>
              <span>₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold pt-1">
              <span>Amount Received:</span>
              <span>₹{invoice.amountPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-rose-600 font-bold text-sm pt-1">
              <span>Balance Due:</span>
              <span>₹{invoice.balanceDue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Notes / Footer */}
        {invoice.notes && (
          <div className="border-t border-stone-100 pt-4 text-xs text-stone-500">
            <span className="font-semibold text-stone-700">Notes / Terms:</span> {invoice.notes}
          </div>
        )}

        <div className="border-t border-stone-200 mt-8 pt-4 text-[10px] text-stone-400 text-center">
          This is a computer-generated tax invoice issued via YogaOS. Registered yoga studio operations.
        </div>
      </div>

      {/* Payment Transactions History (Below Invoice) */}
      <div className="print:hidden mt-8">
        <h3 className="text-base font-bold text-stone-900 mb-3">Recorded Payment Receipts</h3>
        {payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
            No payments have been received for this invoice yet.
          </div>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 uppercase text-[10px] text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="py-2 px-3">Receipt #</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Mode</th>
                  <th className="py-2 px-3">UTR / Ref</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-semibold text-stone-900">{p.receiptNumber || '—'}</td>
                    <td className="py-2.5 px-3">{new Date(p.paidAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-medium">{p.paymentMode}</td>
                    <td className="py-2.5 px-3 text-stone-500">{p.utrReference || '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-stone-900">₹{p.amount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={p.status === 'COMPLETED' ? 'success' : 'outline'}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Notes (if adjustments were made) */}
      {creditNotes.length > 0 && (
        <div className="print:hidden mt-6">
          <h3 className="text-base font-bold text-stone-900 mb-3">Issued Credit Notes</h3>
          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 uppercase text-[10px] text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="py-2 px-3">Credit Note #</th>
                  <th className="py-2 px-3">Issued Date</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Taxable Value</th>
                  <th className="py-2 px-3">Tax Adjustment</th>
                  <th className="py-2 px-3">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {creditNotes.map((cn) => (
                  <tr key={cn.id}>
                    <td className="py-2.5 px-3 font-semibold text-rose-800">{cn.creditNoteNumber}</td>
                    <td className="py-2.5 px-3">{new Date(cn.issuedAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-stone-500">{cn.reason}</td>
                    <td className="py-2.5 px-3">₹{cn.amount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3">₹{cn.taxAmount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-700">₹{cn.totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Record Payment for {invoice.invoiceNumber}</h3>
            <p className="text-xs text-stone-500 mb-4">
              Current balance due: ₹{invoice.balanceDue.toLocaleString('en-IN')}
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.balanceDue}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    required
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  UTR / Reference
                </label>
                <input
                  type="text"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  placeholder="UPI Ref ID or Cheque No."
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
                  placeholder="Optional notes"
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
                  Record Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Invoice Confirmation Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-rose-800 mb-2">Void Tax Invoice</h3>
            <p className="text-xs text-stone-500 mb-4">
              Are you sure you want to void invoice {invoice.invoiceNumber}? This action is irreversible.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Void Reason
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowVoidModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                  onClick={handleVoidInvoice}
                >
                  Confirm Void
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
