'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  TaxInvoiceDetails,
  StudentDetails,
  CreateInvoiceRequest,
  CreateInvoiceLineItem,
} from '@yogaos/contracts';

export default function InvoicesDirectoryPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [invoices, setInvoices] = useState<TaxInvoiceDetails[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<CreateInvoiceLineItem[]>([
    { description: 'Yoga Studio Group Class Pack (10 Classes)', sacCode: '9992', quantity: 1, unitPrice: 3500, discountAmount: 0 },
  ]);

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';
  const canOperate = canManage || activeRole === 'RECEPTIONIST';

  const loadInvoices = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const query: any = { limit: 100 };
      if (statusFilter !== 'ALL') {
        query.status = statusFilter;
      }
      const [invs, studs] = await Promise.all([
        client.getInvoices(query),
        client.getStudents().catch(() => null),
      ]);
      if (invs) {
        setInvoices(invs);
      }
      if (studs) {
        const list = 'students' in (studs as any) ? (studs as any).students : Array.isArray(studs) ? studs : [];
        setStudents(list);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [activeTenantId, statusFilter]);

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: '', sacCode: '9992', quantity: 1, unitPrice: 0, discountAmount: 0 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: keyof CreateInvoiceLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Please select a student');
      return;
    }
    for (const item of lineItems) {
      if (!item.description || item.unitPrice < 0 || (item.quantity ?? 1) <= 0) {
        setError('Please check line items: description, positive price and quantity are required');
        return;
      }
    }

    try {
      setError(null);
      const res = await client.createInvoice({
        studentId: selectedStudentId,
        customerGstin: customerGstin || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        lineItems,
      });

      if (res) {
        setSuccessMsg(`Invoice created successfully: ${res.invoiceNumber}`);
        setShowCreateModal(false);
        setSelectedStudentId('');
        setCustomerGstin('');
        setDueDate('');
        setNotes('');
        setLineItems([
          { description: 'Yoga Studio Group Class Pack (10 Classes)', sacCode: '9992', quantity: 1, unitPrice: 3500, discountAmount: 0 },
        ]);
        loadInvoices();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create tax invoice');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.customerName.toLowerCase().includes(term) ||
      (inv.customerPhone && inv.customerPhone.includes(term))
    );
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/billing" className="text-xs text-stone-500 hover:text-emerald-700">
              ← Back to Billing
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Tax Invoices Directory</h1>
          <p className="text-sm text-stone-500">
            GST-compliant tax invoices, place of supply calculations, and payment tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canOperate && (
            <Button
              variant="primary"
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Tax Invoice
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

      {/* Filters & Search */}
      <Card className="mb-6">
        <CardContent className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search by invoice #, student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-xs uppercase text-stone-400 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer / Student</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Taxable Value</th>
                <th className="px-4 py-3">GST Tax</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Balance Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-stone-400">
                    No tax invoices match current filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-semibold text-stone-900">
                      <Link href={`/billing/invoices/${inv.id}`} className="text-emerald-700 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900">{inv.customerName}</span>
                      {inv.customerStateCode && (
                        <div className="text-xs text-stone-400">State: {inv.customerStateCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">₹{inv.taxableAmount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      ₹{inv.totalTax.toLocaleString('en-IN')}
                      {inv.totalTax > 0 && (
                        <div className="text-[10px] text-stone-400">
                          {inv.igstAmount > 0 ? 'IGST' : 'CGST+SGST'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-900">
                      ₹{inv.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {inv.balanceDue > 0 ? (
                        <span className="text-rose-600">₹{inv.balanceDue.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-emerald-700">₹0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          inv.status === 'PAID'
                            ? 'success'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'warning'
                            : 'outline'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/billing/invoices/${inv.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          View & Print
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900 mb-1">Create Tax Invoice</h3>
            <p className="text-xs text-stone-500 mb-4">
              Generate a sequential GST tax invoice with auto place-of-supply tax calculation.
            </p>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Customer GSTIN (Optional B2B)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    placeholder="15-char GSTIN for B2B input tax credit"
                    className="w-full font-mono uppercase rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 10 Classes Pass + Workshop"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">
                    Invoice Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="rounded-md border border-stone-200 bg-stone-50 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-2">
                        <div className="md:col-span-6">
                          <label className="block text-[10px] text-stone-500 uppercase">Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            required
                            placeholder="Item description"
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-stone-500 uppercase">SAC Code</label>
                          <input
                            type="text"
                            value={item.sacCode}
                            onChange={(e) => handleLineItemChange(idx, 'sacCode', e.target.value)}
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-stone-500 uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, 'quantity', Number(e.target.value))}
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-stone-500 uppercase">Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(idx, 'unitPrice', Number(e.target.value))}
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-500">Discount (₹):</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountAmount}
                            onChange={(e) => handleLineItemChange(idx, 'discountAmount', Number(e.target.value))}
                            className="w-20 rounded border border-stone-300 px-1 py-0.5 text-xs"
                          />
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-xs text-rose-600 hover:text-rose-800"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-emerald-700 text-white">
                  Generate Tax Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
