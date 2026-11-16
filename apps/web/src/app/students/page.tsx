'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { StudentSummary, BranchDetails } from '@yogaos/contracts';

export default function StudentsListPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Student Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [homeBranchId, setHomeBranchId] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [waiverAgreed, setWaiverAgreed] = useState(true);

  // Optional initial health disclaimer
  const [hasHealthIssue, setHasHealthIssue] = useState(false);
  const [injurySummary, setInjurySummary] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [pregnancyAlert, setPregnancyAlert] = useState(false);

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const loadStudents = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await client.getStudents({
        search: search || undefined,
        branchId: selectedBranch || undefined,
        status: (selectedStatus as any) || undefined,
        page,
        limit: 15,
      });
      setStudents(res.students);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    if (!activeTenantId) return;
    try {
      const branchList = await client.getBranches();
      setBranches(branchList);
      if (branchList.length > 0 && !homeBranchId) {
        setHomeBranchId(branchList[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [activeTenantId]);

  useEffect(() => {
    loadStudents();
  }, [activeTenantId, page, selectedBranch, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadStudents();
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.createStudent({
        homeBranchId,
        fullName,
        mobilePhone,
        email: email || null,
        gender: gender || null,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        emergencyContactRelation: emergencyRelation,
        status: 'ACTIVE',
        initialConsent: waiverAgreed
          ? {
              consentType: 'LIABILITY_WAIVER',
              version: '1.0',
              isAgreed: true,
            }
          : undefined,
        healthDisclaimer: hasHealthIssue
          ? {
              injurySummary: injurySummary || null,
              healthNotes: healthNotes || 'Health condition flagged during registration',
              hasPregnancyAlert: pregnancyAlert,
              consentSigned: true,
            }
          : undefined,
      });

      setShowRegisterModal(false);
      // Reset form
      setFullName('');
      setMobilePhone('');
      setEmail('');
      setEmergencyName('');
      setEmergencyPhone('');
      setEmergencyRelation('');
      setHasHealthIssue(false);
      setInjurySummary('');
      setHealthNotes('');
      setPregnancyAlert(false);

      loadStudents();
    } catch (err: any) {
      setError(err.message || 'Failed to register student');
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Student Directory</h1>
          <p className="text-sm text-stone-500">
            Registered studio practitioners, emergency contacts, and privacy flags.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowRegisterModal(true)}>
          + Register New Student
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, phone or email..."
                className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-stone-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-500">
              No students found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase">
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Home Branch</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Health Safety Flag</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-stone-900">
                        <Link href={`/students/${s.id}`} className="hover:text-emerald-700 hover:underline">
                          {s.fullName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        <div>📞 {s.mobilePhone}</div>
                        {s.email && <div className="text-stone-500">✉️ {s.email}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        {s.homeBranchName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            s.status === 'ACTIVE'
                              ? 'success'
                              : s.status === 'TRIAL'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {s.hasHealthAlert ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                            ⚠️ CAUTION: Flagged
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">Clear</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/students/${s.id}`}>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-stone-200 pt-4 mt-4 text-xs text-stone-500">
                <span>
                  Showing {students.length} of {total} students
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
                    disabled={students.length < 15 || page * 15 >= total}
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

      {/* Register New Student Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl my-8">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Register New Student</h2>
            <form onSubmit={handleRegisterStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Home Branch Location</label>
                <select
                  value={homeBranchId}
                  onChange={(e) => setHomeBranchId(e.target.value)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Student Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ananya Sen"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Gender (Optional)</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Mobile Phone</label>
                  <input
                    type="tel"
                    value={mobilePhone}
                    onChange={(e) => setMobilePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ananya@example.in"
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-2">
                <span className="text-xs font-semibold text-stone-700 uppercase">Emergency Contact (Mandatory)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-stone-600">Contact Name</label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="e.g. Ramesh Sen"
                      required
                      className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600">Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+91 98765 00000"
                      required
                      className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600">Relation</label>
                    <input
                      type="text"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      placeholder="Spouse / Parent"
                      required
                      className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Health & Injury Disclosure Option */}
              <div className="border border-stone-200 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="healthCheck"
                    checked={hasHealthIssue}
                    onChange={(e) => setHasHealthIssue(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600"
                  />
                  <label htmlFor="healthCheck" className="text-xs font-medium text-stone-900 cursor-pointer">
                    Student has existing physical injuries, surgeries, or limitations
                  </label>
                </div>

                {hasHealthIssue && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-stone-100">
                    <div>
                      <label className="block text-xs text-stone-600">
                        Short Summary (e.g. Lower back slip disc L4/L5)
                      </label>
                      <input
                        type="text"
                        value={injurySummary}
                        onChange={(e) => setInjurySummary(e.target.value)}
                        placeholder="Lumbar disc herniation, right knee meniscus"
                        className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600">
                        Detailed Health Narrative (Encrypted with AES-256-GCM at rest; hidden from front-desk)
                      </label>
                      <textarea
                        value={healthNotes}
                        onChange={(e) => setHealthNotes(e.target.value)}
                        placeholder="Avoid deep twists and inversions. Requires yoga blocks under sitting bones."
                        rows={2}
                        className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="pregnancyCheck"
                        checked={pregnancyAlert}
                        onChange={(e) => setPregnancyAlert(e.target.checked)}
                        className="rounded border-stone-300 text-emerald-600"
                      />
                      <label htmlFor="pregnancyCheck" className="text-xs text-stone-700 cursor-pointer">
                        Pregnancy alert (requires prenatal modifications)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Consent check */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="waiverCheck"
                  checked={waiverAgreed}
                  onChange={(e) => setWaiverAgreed(e.target.checked)}
                  required
                  className="rounded border-stone-300 text-emerald-600"
                />
                <label htmlFor="waiverCheck" className="text-xs text-stone-700 cursor-pointer">
                  Student has signed the studio Liability Waiver and General Terms & Conditions
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Register Student
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
