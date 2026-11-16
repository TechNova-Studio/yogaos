'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  StudentDetails,
  StudentActivityDetails,
  BookingDetails,
  StudentMembershipDetails,
  MembershipPlanDetails,
  CreditLedgerEntryDetails,
} from '@yogaos/contracts';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;
  const { activeTenantId, activeRole, token } = useAuth();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [timeline, setTimeline] = useState<StudentActivityDetails[]>([]);
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [memberships, setMemberships] = useState<StudentMembershipDetails[]>([]);
  const [availablePlans, setAvailablePlans] = useState<MembershipPlanDetails[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CreditLedgerEntryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Membership Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  const [freezeModalMembership, setFreezeModalMembership] = useState<StudentMembershipDetails | null>(null);
  const [freezeReason, setFreezeReason] = useState('Medical rest / travel');

  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerMembership, setLedgerMembership] = useState<StudentMembershipDetails | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustMembership, setAdjustMembership] = useState<StudentMembershipDetails | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('Staff courtesy balance adjustment');

  // Edit contact info state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editStatus, setEditStatus] = useState<any>('ACTIVE');

  // Health disclaimer update state (for authorized roles)
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [injurySummary, setInjurySummary] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [pregnancyAlert, setPregnancyAlert] = useState(false);

  // Staff note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const loadData = async () => {
    if (!activeTenantId || !studentId) return;
    try {
      setLoading(true);
      setError(null);
      const [studentData, timelineData, bookingsData, membershipsData, plansData] = await Promise.all([
        client.getStudent(studentId),
        client.getStudentTimeline(studentId),
        client.getStudentBookings(studentId).catch(() => []),
        client.getStudentMemberships({ studentId }).catch(() => []),
        client.getMembershipPlans({ isActive: true }).catch(() => []),
      ]);

      setStudent(studentData);
      setTimeline(timelineData);
      setBookings(bookingsData);
      setMemberships(membershipsData);
      setAvailablePlans(plansData);
      if (plansData.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plansData[0].id);
      }

      setEditPhone(studentData.mobilePhone || '');
      setEditEmail(studentData.email || '');
      setEditEmergencyName(studentData.emergencyContactName || '');
      setEditEmergencyPhone(studentData.emergencyContactPhone || '');
      setEditEmergencyRelation(studentData.emergencyContactRelation || '');
      setEditStatus(studentData.status || 'ACTIVE');

      if (studentData.healthDisclaimer) {
        setInjurySummary(studentData.healthDisclaimer.injurySummary || '');
        setHealthNotes(studentData.healthDisclaimer.healthNotes || '');
        setPregnancyAlert(studentData.healthDisclaimer.hasPregnancyAlert || false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student record');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenantId, studentId]);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.updateStudent(studentId, {
        mobilePhone: editPhone,
        email: editEmail || null,
        emergencyContactName: editEmergencyName,
        emergencyContactPhone: editEmergencyPhone,
        emergencyContactRelation: editEmergencyRelation,
        status: editStatus,
      });
      setIsEditingContact(false);
      setMessage('Contact and profile information successfully updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update contact info');
    }
  };

  const handleSaveHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.updateStudentHealth(studentId, {
        injurySummary: injurySummary || null,
        healthNotes,
        hasPregnancyAlert: pregnancyAlert,
        consentSigned: true,
      });
      setShowHealthModal(false);
      setMessage('Health disclaimer encrypted and securely updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update health disclaimer');
    }
  };

  const handleAddStaffNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.addStudentNote(studentId, {
        title: noteTitle,
        description: noteText,
      });
      setNoteTitle('');
      setNoteText('');
      setMessage('Staff note added to timeline');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add staff note');
    }
  };

  const handleAssignMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    try {
      setError(null);
      await client.assignStudentMembership({
        studentId,
        membershipPlanId: selectedPlanId,
        startDate: assignStartDate || undefined,
        notes: assignNotes || null,
      });
      setMessage('Membership / Class Pass assigned successfully');
      setShowAssignModal(false);
      setAssignNotes('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign membership');
    }
  };

  const handleFreezeMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeModalMembership) return;
    try {
      setError(null);
      await client.freezeStudentMembership(freezeModalMembership.id, {
        freezeReason,
      });
      setMessage(`Membership "${freezeModalMembership.planNameSnapshot}" is now FROZEN`);
      setFreezeModalMembership(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to freeze membership');
    }
  };

  const handleUnfreezeMembership = async (membershipId: string) => {
    try {
      setError(null);
      const updated = await client.unfreezeStudentMembership(membershipId);
      setMessage(`Membership resumed! Expiration extended to ${new Date(updated.expiryDate).toLocaleDateString()}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to unfreeze membership');
    }
  };

  const openLedgerModal = async (membership: StudentMembershipDetails) => {
    setLedgerMembership(membership);
    setShowLedgerModal(true);
    try {
      const entries = await client.getCreditLedger({
        studentMembershipId: membership.id,
        limit: 50,
      });
      setLedgerEntries(entries);
    } catch (err: any) {
      setError(err.message || 'Failed to load credit ledger');
    }
  };

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustMembership) return;
    try {
      setError(null);
      await client.adjustCreditsManually(adjustMembership.id, {
        creditsDelta: adjustDelta,
        reason: adjustReason,
      });
      setMessage(`Adjusted ${adjustDelta > 0 ? '+' : ''}${adjustDelta} credits`);
      setShowAdjustModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust credits');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 text-center text-sm text-stone-500">
        Loading student record...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 text-center">
        <h2 className="text-xl font-bold text-stone-900">Student Not Found</h2>
        <p className="mt-2 text-sm text-stone-600">{error || 'Could not find the requested student.'}</p>
        <Link href="/students" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            ← Back to Student Directory
          </Button>
        </Link>
      </div>
    );
  }

  const isFrontDesk = activeRole === 'RECEPTIONIST';

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb & Navigation */}
      <div className="mb-4">
        <Link href="/students" className="text-xs font-medium text-emerald-700 hover:underline">
          ← Back to Students Directory
        </Link>
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

      {/* Student Profile Header */}
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-stone-900">{student.fullName}</h1>
              <Badge variant={student.status === 'ACTIVE' ? 'success' : 'default'}>
                {student.status}
              </Badge>
              <span className="text-xs text-stone-400 font-mono">ID: {student.id}</span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Home Branch: <span className="font-medium text-stone-800">{student.homeBranchName}</span> | Registered on{' '}
              {new Date(student.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingContact && (
              <Button variant="outline" size="sm" onClick={() => setIsEditingContact(true)}>
                Edit Contact Details
              </Button>
            )}
          </div>
        </div>

        {/* Health Alert Caution Banner (Non-clinical caution indicator) */}
        {student.hasHealthAlert && (
          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <span className="font-semibold text-xs text-amber-900 uppercase">
                Safety & Health Alert Flagged
              </span>
              <p className="text-xs text-amber-800 mt-0.5">
                {isFrontDesk
                  ? 'Caution: Physical restriction or injury has been flagged for this student. Notify the batch instructor prior to intense practice.'
                  : `Condition flagged: ${student.healthDisclaimer?.injurySummary || 'Physical restrictions noted'}. See detailed clinical narrative below.`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Personal Info & Emergency Contact */}
        <div className="space-y-6">
          {/* Contact Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Mutable mobile phone and email identifiers.</CardDescription>
            </CardHeader>
            <CardContent>
              {isEditingContact ? (
                <form onSubmit={handleUpdateContact} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Mobile Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Student Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="TRIAL">TRIAL</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-xs font-semibold text-stone-700">Emergency Contact</span>
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={editEmergencyName}
                        onChange={(e) => setEditEmergencyName(e.target.value)}
                        placeholder="Contact Name"
                        required
                        className="block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="tel"
                        value={editEmergencyPhone}
                        onChange={(e) => setEditEmergencyPhone(e.target.value)}
                        placeholder="Contact Phone"
                        required
                        className="block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={editEmergencyRelation}
                        onChange={(e) => setEditEmergencyRelation(e.target.value)}
                        placeholder="Relation (e.g. Spouse)"
                        required
                        className="block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingContact(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                      Save Changes
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-stone-500 block">Mobile Phone</span>
                    <span className="font-medium text-stone-900">{student.mobilePhone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Email Address</span>
                    <span className="font-medium text-stone-900">{student.email || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Gender</span>
                    <span className="font-medium text-stone-900">{student.gender || 'Not specified'}</span>
                  </div>
                  <div className="pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-500 block uppercase font-semibold">Emergency Contact</span>
                    <div className="mt-1">
                      <span className="font-medium text-stone-900">{student.emergencyContactName}</span>
                      <span className="text-stone-500 text-xs ml-1">({student.emergencyContactRelation})</span>
                      <div className="text-stone-600 text-xs">📞 {student.emergencyContactPhone}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signed Consents */}
          <Card>
            <CardHeader>
              <CardTitle>Consent & Liability Waivers</CardTitle>
              <CardDescription>Affirmative legal agreements on record.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.consents && student.consents.length > 0 ? (
                <div className="space-y-2">
                  {student.consents.map((c) => (
                    <div key={c.id} className="rounded border border-stone-200 bg-stone-50 p-2 text-xs">
                      <div className="flex items-center justify-between font-medium text-stone-900">
                        <span>{c.consentType} (v{c.version})</span>
                        <Badge variant="success">Agreed</Badge>
                      </div>
                      <div className="text-stone-500 text-[11px] mt-1">
                        Signed: {new Date(c.agreedAt).toLocaleString()}
                        {c.ipAddress && ` | IP: ${c.ipAddress}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-stone-500">No consent agreements recorded yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Health Disclaimer (Redacted for Front Desk) & Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Health Disclaimer & Privacy Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Health, Injuries & Physical Limitations</CardTitle>
                <CardDescription>
                  {isFrontDesk
                    ? 'Front-desk privacy mode: Clinical narratives restricted to instructors and managers.'
                    : 'Encrypted at rest with AES-256-GCM. Visible to instructors for injury prevention.'}
                </CardDescription>
              </div>
              {!isFrontDesk && (
                <Button variant="outline" size="sm" onClick={() => setShowHealthModal(true)}>
                  {student.healthDisclaimer ? 'Update Health Record' : '+ Add Health Disclaimer'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isFrontDesk ? (
                <div className="rounded-md border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
                  <div className="font-medium text-stone-800 mb-1">🔒 Restricted Health Narrative</div>
                  <p>
                    In compliance with the student privacy architecture, sensitive medical narratives and surgery notes
                    are available exclusively to certified Yoga Instructors and Studio Managers.
                  </p>
                  <p className="mt-2 text-amber-800 font-medium">
                    Status: {student.hasHealthAlert ? '⚠️ CAUTION flag is active for this student.' : '✅ No restriction flag.'}
                  </p>
                </div>
              ) : student.healthDisclaimer ? (
                <div className="space-y-4">
                  {student.healthDisclaimer.injurySummary && (
                    <div>
                      <span className="text-xs font-semibold text-stone-500 block uppercase">Injury Summary</span>
                      <p className="text-sm font-medium text-stone-900 mt-0.5">
                        {student.healthDisclaimer.injurySummary}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-stone-500 block uppercase">
                      Instructor Guidance & Notes (Decrypted)
                    </span>
                    <div className="mt-1 rounded bg-stone-50 p-3 text-sm text-stone-800 border border-stone-200 whitespace-pre-wrap font-sans">
                      {student.healthDisclaimer.healthNotes}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-stone-500 pt-2 border-t border-stone-100">
                    {student.healthDisclaimer.hasPregnancyAlert && (
                      <span className="rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700 border border-rose-200">
                        🤰 Pregnancy Alert Active
                      </span>
                    )}
                    <span>
                      Last updated: {new Date(student.healthDisclaimer.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-stone-500">
                  No health or injury limitations recorded for this student.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Memberships & Class Passes Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Memberships & Class Passes</CardTitle>
                <CardDescription>Active subscriptions, class packages, and credit balances.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAssignModal(true)}>
                + Assign Plan / Pass
              </Button>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  No memberships or class passes recorded for this student.
                </div>
              ) : (
                <div className="space-y-4">
                  {memberships.map((m) => {
                    const isFrozen = m.status === 'FROZEN';
                    const isExpired = new Date() > new Date(m.expiryDate) || m.status === 'EXPIRED';
                    const isUnlimited = m.planTypeSnapshot === 'TIME_UNLIMITED';

                    return (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-4 text-xs transition-all ${
                          isFrozen
                            ? 'border-cyan-300 bg-cyan-50/50'
                            : m.status === 'CANCELLED'
                            ? 'border-stone-200 bg-stone-50 opacity-60'
                            : isExpired
                            ? 'border-stone-200 bg-stone-50'
                            : 'border-emerald-200 bg-emerald-50/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-900 text-sm">{m.planNameSnapshot}</span>
                              <Badge
                                variant={
                                  m.status === 'ACTIVE'
                                    ? 'success'
                                    : isFrozen
                                    ? 'outline'
                                    : m.status === 'CANCELLED'
                                    ? 'destructive'
                                    : 'default'
                                }
                              >
                                {isFrozen ? '❄️ FROZEN' : m.status}
                              </Badge>
                              <Badge variant="outline">
                                {isUnlimited
                                  ? 'Unlimited'
                                  : m.planTypeSnapshot === 'SINGLE_DROP_IN'
                                  ? 'Drop-In'
                                  : 'Class Pack'}
                              </Badge>
                            </div>
                            <div className="text-stone-500 text-[11px] mt-1">
                              Valid: {new Date(m.startDate).toLocaleDateString()} →{' '}
                              <span className="font-semibold text-stone-800">
                                {new Date(m.expiryDate).toLocaleDateString()}
                              </span>
                              {m.freezesUsed > 0 && ` • Freezes used: ${m.freezesUsed}`}
                              {m.totalFrozenDays > 0 && ` (${m.totalFrozenDays} days total)`}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {!isUnlimited && (
                              <div className="text-right">
                                <span className="text-[11px] text-stone-500 block">Remaining Credits</span>
                                <span className="text-base font-bold text-emerald-800">
                                  {m.remainingCredits ?? 0}
                                  <span className="text-xs font-normal text-stone-500"> / {m.totalCredits ?? 0}</span>
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5">
                              {m.status === 'ACTIVE' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setFreezeModalMembership(m);
                                    setFreezeReason('Medical rest / travel');
                                  }}
                                >
                                  ❄️ Freeze
                                </Button>
                              )}
                              {isFrozen && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleUnfreezeMembership(m.id)}
                                >
                                  ▶️ Resume
                                </Button>
                              )}
                              {!isUnlimited && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openLedgerModal(m)}
                                  >
                                    Ledger
                                  </Button>
                                  {(activeRole === 'OWNER' || activeRole === 'MANAGER') && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setAdjustMembership(m);
                                        setAdjustDelta(1);
                                        setAdjustReason('Staff courtesy balance adjustment');
                                        setShowAdjustModal(true);
                                      }}
                                    >
                                      ±
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isFrozen && (
                          <div className="mt-3 rounded border border-cyan-200 bg-white p-2.5 text-[11px] text-cyan-900">
                            <span className="font-semibold">Frozen at: </span>
                            {m.frozenAt ? new Date(m.frozenAt).toLocaleString() : 'N/A'}
                            {m.freezeReason && <span className="ml-2 font-medium">({m.freezeReason})</span>}
                            <span className="block mt-0.5 text-stone-500">
                              Resuming will automatically push the expiration date forward by the exact number of frozen days.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Bookings & Attendance History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Class Bookings & Attendance History</CardTitle>
                <CardDescription>Reservations, attendances, no-shows, and cancellations.</CardDescription>
              </div>
              <span className="text-xs text-stone-500 font-semibold">{bookings.length} records</span>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  No class bookings on record for this student.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {bookings.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-stone-900">{b.className}</div>
                        <div className="text-stone-500 text-[11px]">
                          {b.sessionStart
                            ? new Date(b.sessionStart).toLocaleString([], {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : b.sessionDate}{' '}
                          • {b.roomName} • {b.instructorName}
                        </div>
                        {b.checkedInAt && (
                          <div className="text-emerald-700 text-[10px] mt-0.5">
                            Checked in: {new Date(b.checkedInAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            b.status === 'ATTENDED'
                              ? 'success'
                              : b.status === 'CANCELLED'
                              ? 'outline'
                              : b.status === 'NO_SHOW' || b.status === 'LATE_CANCEL'
                              ? 'destructive'
                              : 'default'
                          }
                        >
                          {b.status}
                        </Badge>
                        <Link
                          href={`/bookings/roster/${b.sessionInstanceId}`}
                          className="text-stone-400 hover:text-emerald-700 font-medium"
                        >
                          Roster →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline Foundation */}
          <Card>
            <CardHeader>
              <CardTitle>Practice & Activity Timeline</CardTitle>
              <CardDescription>Chronological log of registrations, updates, and staff notes.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add Note Form */}
              <form onSubmit={handleAddStaffNote} className="mb-6 rounded-md border border-stone-200 bg-stone-50 p-3">
                <span className="text-xs font-semibold text-stone-700 block mb-2">Add Staff / Instructor Note</span>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note subject (e.g. Asana progression, attended trial class)"
                    required
                    className="block w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Details about practitioner's alignment, prop preferences, or membership discussion..."
                    rows={2}
                    required
                    className="block w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm">
                      Post Note
                    </Button>
                  </div>
                </div>
              </form>

              {/* Timeline Items */}
              {timeline.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">No activity logged yet.</div>
              ) : (
                <div className="relative border-l-2 border-stone-200 ml-3 space-y-4">
                  {timeline.map((act) => (
                    <div key={act.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600" />
                      <div className="rounded border border-stone-200 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-900">{act.title}</span>
                          <span className="text-stone-400">
                            {new Date(act.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {act.description && (
                          <p className="mt-1 text-xs text-stone-600 whitespace-pre-wrap">{act.description}</p>
                        )}
                        {act.performedByName && (
                          <div className="mt-1 text-[11px] text-stone-400">By: {act.performedByName}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Health Disclaimer Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Record Health & Physical Disclaimer</h2>
            <p className="text-xs text-stone-500 mb-4">
              Detailed notes will be encrypted using AES-256-GCM before saving to the database.
            </p>
            <form onSubmit={handleSaveHealth} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Short Summary (e.g. Lower Back Herniation L4/L5)
                </label>
                <input
                  type="text"
                  value={injurySummary}
                  onChange={(e) => setInjurySummary(e.target.value)}
                  placeholder="Lower back slip disc, wrist sprain"
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Clinical / Asana Modifications Narrative (Encrypted)
                </label>
                <textarea
                  value={healthNotes}
                  onChange={(e) => setHealthNotes(e.target.value)}
                  placeholder="Avoid full wheel, forward fold with bent knees only. Use blocks under sitting bones..."
                  rows={4}
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pregCheckModal"
                  checked={pregnancyAlert}
                  onChange={(e) => setPregnancyAlert(e.target.checked)}
                  className="rounded border-stone-300 text-emerald-600"
                />
                <label htmlFor="pregCheckModal" className="text-xs text-stone-700 cursor-pointer">
                  Student is pregnant (requires prenatal yoga posture guidelines)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowHealthModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save & Encrypt Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Membership / Pass Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-1">Assign Membership or Pass</h2>
            <p className="text-xs text-stone-500 mb-4">
              Select an active plan to assign to {student.fullName}. Initial pass credits will be allocated automatically.
            </p>

            <form onSubmit={handleAssignMembership} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Select Plan *</label>
                <select
                  required
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Choose a plan...</option>
                  {availablePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.price.toLocaleString('en-IN')} (
                      {p.planType === 'TIME_UNLIMITED'
                        ? 'Unlimited'
                        : `${p.creditCount} Credits`}
                      , {p.validityDays}d)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Start Date (Optional)</label>
                <input
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-stone-400 mt-0.5 block">
                  Leave blank to activate immediately starting today.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Internal Notes</label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Payment mode, discount voucher, or trial notes..."
                  rows={2}
                  className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Confirm Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Freeze Membership Modal */}
      {freezeModalMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-1">Freeze Membership</h2>
            <p className="text-xs text-stone-500 mb-4">
              Freeze &ldquo;{freezeModalMembership.planNameSnapshot}&rdquo;. The membership validity will pause, and expiration will extend upon resumption.
            </p>

            <form onSubmit={handleFreezeMembership} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Reason for Freeze *</label>
                <input
                  type="text"
                  required
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="e.g. Work travel, medical recovery, vacation"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="rounded-md bg-stone-50 p-3 text-[11px] text-stone-600 border border-stone-200">
                Current Expiration:{' '}
                <span className="font-semibold text-stone-900">
                  {new Date(freezeModalMembership.expiryDate).toLocaleDateString()}
                </span>
                <br />
                Freezes used so far: {freezeModalMembership.freezesUsed}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setFreezeModalMembership(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Confirm Freeze
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entitlement Credit Ledger Modal */}
      {showLedgerModal && ledgerMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Entitlement Credit Ledger</h2>
                <p className="text-xs text-stone-500">
                  {ledgerMembership.planNameSnapshot} • Current Balance: {ledgerMembership.remainingCredits} / {ledgerMembership.totalCredits} credits
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowLedgerModal(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4">
              {ledgerEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No credit transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="pb-2 font-medium">Timestamp</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium text-center">Change</th>
                        <th className="pb-2 font-medium text-center">Balance</th>
                        <th className="pb-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {ledgerEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2 text-stone-500">
                            {new Date(entry.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={
                                entry.entryType === 'INITIAL_ALLOCATION'
                                  ? 'default'
                                  : entry.entryType === 'REDEMPTION'
                                  ? 'outline'
                                  : entry.entryType === 'REFUND_RESTORE'
                                  ? 'success'
                                  : 'warning'
                              }
                            >
                              {entry.entryType}
                            </Badge>
                          </td>
                          <td
                            className={`py-2 text-center font-bold ${
                              entry.creditsDelta > 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {entry.creditsDelta > 0 ? `+${entry.creditsDelta}` : entry.creditsDelta}
                          </td>
                          <td className="py-2 text-center font-semibold text-stone-900">
                            {entry.balanceAfter}
                          </td>
                          <td className="py-2 text-stone-600">
                            {entry.reason || '—'}
                            {entry.performedByUserName && (
                              <span className="block text-[10px] text-stone-400">
                                By: {entry.performedByUserName}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Credit Adjustment Modal */}
      {showAdjustModal && adjustMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-1">Adjust Credit Balance</h2>
            <p className="text-xs text-stone-500 mb-4">
              Add or deduct class credits for &ldquo;{adjustMembership.planNameSnapshot}&rdquo;. Current balance: {adjustMembership.remainingCredits}.
            </p>

            <form onSubmit={handleAdjustCredits} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Credit Delta (+ or -) *</label>
                <input
                  type="number"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-stone-400 mt-0.5 block">
                  Positive number to add credits (e.g. 2), negative number to deduct (e.g. -1).
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Studio closure compensation, courtesy extension"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Apply Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
