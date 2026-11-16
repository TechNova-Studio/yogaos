'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { LeadDetails, BranchDetails } from '@yogaos/contracts';

export default function LeadsPipelinePage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [leads, setLeads] = useState<LeadDetails[]>([]);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // New Lead Modal state
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadBranchId, setLeadBranchId] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadSource, setLeadSource] = useState<any>('WALK_IN');
  const [leadProgram, setLeadProgram] = useState('');
  const [leadFollowUp, setLeadFollowUp] = useState('');
  const [leadNotes, setLeadNotes] = useState('');

  // Convert Lead Modal state
  const [convertingLead, setConvertingLead] = useState<LeadDetails | null>(null);
  const [convertBranchId, setConvertBranchId] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const loadLeads = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await client.getLeads({
        search: search || undefined,
        status: (selectedStatus as any) || undefined,
        source: (selectedSource as any) || undefined,
        page,
        limit: 20,
      });
      setLeads(res.leads);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    if (!activeTenantId) return;
    try {
      const branchList = await client.getBranches();
      setBranches(branchList);
      if (branchList.length > 0) {
        if (!leadBranchId) setLeadBranchId(branchList[0].id);
        if (!convertBranchId) setConvertBranchId(branchList[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [activeTenantId]);

  useEffect(() => {
    loadLeads();
  }, [activeTenantId, page, selectedStatus, selectedSource]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.createLead({
        branchId: leadBranchId || null,
        fullName: leadName,
        phone: leadPhone,
        email: leadEmail || null,
        source: leadSource,
        interestedProgram: leadProgram || null,
        followUpDate: leadFollowUp ? new Date(leadFollowUp).toISOString() : null,
        notes: leadNotes || null,
      });

      setShowLeadModal(false);
      setLeadName('');
      setLeadPhone('');
      setLeadEmail('');
      setLeadProgram('');
      setLeadFollowUp('');
      setLeadNotes('');
      setMessage('New lead enquiry successfully logged');
      loadLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to create lead');
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: any) => {
    try {
      setError(null);
      await client.updateLead(leadId, { status: newStatus });
      setMessage(`Lead status updated to ${newStatus}`);
      loadLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to update lead status');
    }
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;
    try {
      setError(null);
      const res = await client.convertLead(convertingLead.id, {
        homeBranchId: convertBranchId,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        emergencyContactRelation: emergencyRelation,
      });

      setConvertingLead(null);
      setEmergencyName('');
      setEmergencyPhone('');
      setEmergencyRelation('');
      setMessage(res.message);
      loadLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to convert lead to student');
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Leads & Enquiries Pipeline</h1>
          <p className="text-sm text-stone-500">
            Track prospective students from initial trial inquiry to paid practitioner.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowLeadModal(true)}>
          + New Enquiry
        </Button>
      </div>

      {message && (
        <div className="mb-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
                placeholder="Search leads by name, phone or email..."
                className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
              >
                <option value="">All Pipeline Stages</option>
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="TRIAL_BOOKED">TRIAL_BOOKED</option>
                <option value="CONVERTED">CONVERTED</option>
                <option value="LOST">LOST</option>
              </select>
            </div>
            <div>
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
              >
                <option value="">All Sources</option>
                <option value="WALK_IN">WALK_IN</option>
                <option value="WEBSITE">WEBSITE</option>
                <option value="INSTAGRAM">INSTAGRAM</option>
                <option value="REFERRAL">REFERRAL</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-stone-500">Loading enquiries...</div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-500">
              No enquiries found. Click "+ New Enquiry" to log a lead.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase">
                    <th className="py-3 px-4">Prospective Student</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Source / Program</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Follow-up</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900">{l.fullName}</div>
                        {l.notes && <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{l.notes}</p>}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        <div>📞 {l.phone}</div>
                        {l.email && <div className="text-stone-500">✉️ {l.email}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        <span className="font-medium text-stone-800">{l.interestedProgram || 'General Yoga'}</span>
                        <div className="text-[11px] text-stone-400">via {l.source}</div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={l.status}
                          onChange={(e) => handleUpdateStatus(l.id, e.target.value)}
                          className="rounded border border-stone-200 bg-white px-2 py-0.5 text-xs font-medium text-stone-800 focus:outline-none"
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="TRIAL_BOOKED">TRIAL_BOOKED</option>
                          <option value="CONVERTED">CONVERTED</option>
                          <option value="LOST">LOST</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        {l.followUpDate ? (
                          <span
                            className={
                              new Date(l.followUpDate) < new Date() && l.status !== 'CONVERTED'
                                ? 'font-semibold text-rose-600'
                                : 'text-stone-600'
                            }
                          >
                            📅 {new Date(l.followUpDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-stone-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {l.status === 'CONVERTED' && l.convertedStudentId ? (
                          <Link href={`/students/${l.convertedStudentId}`}>
                            <Badge variant="success">View Student →</Badge>
                          </Link>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setConvertingLead(l);
                              if (l.branchId) setConvertBranchId(l.branchId);
                            }}
                          >
                            Convert to Student
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-stone-200 pt-4 mt-4 text-xs text-stone-500">
                <span>
                  Showing {leads.length} of {total} enquiries
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={leads.length < 20 || page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Enquiry Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Log New Enquiry / Lead</h2>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700">Target Branch</label>
                <select
                  value={leadBranchId}
                  onChange={(e) => setLeadBranchId(e.target.value)}
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Any Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Full Name</label>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Phone Number</label>
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="+91 98765 11111"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="rahul@example.in"
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Lead Source</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value="WALK_IN">Walk In</option>
                    <option value="WEBSITE">Website</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Interested Program</label>
                  <input
                    type="text"
                    value={leadProgram}
                    onChange={(e) => setLeadProgram(e.target.value)}
                    placeholder="e.g. Morning Vinyasa Flow"
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Follow-Up Date</label>
                  <input
                    type="date"
                    value={leadFollowUp}
                    onChange={(e) => setLeadFollowUp(e.target.value)}
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">Enquiry Notes</label>
                <textarea
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="Practitioner looking for beginner batches, interested in weekend trial."
                  rows={2}
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowLeadModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Log Enquiry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Lead to Student Modal */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Convert Lead to Student</h2>
            <p className="text-xs text-stone-500 mb-4">
              Converting <strong>{convertingLead.fullName}</strong> ({convertingLead.phone}) into an active student.
            </p>
            <form onSubmit={handleConvertLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700">Home Branch</label>
                <select
                  value={convertBranchId}
                  onChange={(e) => setConvertBranchId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-2">
                <span className="text-xs font-semibold text-stone-700 uppercase">Emergency Contact</span>
                <div>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Contact Name"
                    required
                    className="block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs mb-2"
                  />
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Contact Phone"
                    required
                    className="block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs mb-2"
                  />
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    placeholder="Relation (e.g. Spouse / Parent)"
                    required
                    className="block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setConvertingLead(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Confirm Conversion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
