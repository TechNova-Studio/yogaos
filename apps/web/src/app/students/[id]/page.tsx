'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { StudentDetails, StudentActivityDetails, BookingDetails } from '@yogaos/contracts';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;
  const { activeTenantId, activeRole, token } = useAuth();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [timeline, setTimeline] = useState<StudentActivityDetails[]>([]);
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      const [studentData, timelineData, bookingsData] = await Promise.all([
        client.getStudent(studentId),
        client.getStudentTimeline(studentId),
        client.getStudentBookings(studentId).catch(() => []),
      ]);

      setStudent(studentData);
      setTimeline(timelineData);
      setBookings(bookingsData);

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
    </div>
  );
}
