'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type {
  ClassTypeDetails,
  BatchDetails,
  BranchDetails,
  RoomDetails,
  InstructorSummary,
  ClassLevelType,
} from '@yogaos/contracts';

const DAYS_OF_WEEK = [
  { val: 0, label: 'Sun' },
  { val: 1, label: 'Mon' },
  { val: 2, label: 'Tue' },
  { val: 3, label: 'Wed' },
  { val: 4, label: 'Thu' },
  { val: 5, label: 'Fri' },
  { val: 6, label: 'Sat' },
];

export default function ClassesAndBatchesPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'types' | 'batches'>('types');

  // Class Types state
  const [classTypes, setClassTypes] = useState<ClassTypeDetails[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  // Batches state
  const [batches, setBatches] = useState<BatchDetails[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Lookup data for creation forms
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [rooms, setRooms] = useState<RoomDetails[]>([]);
  const [instructors, setInstructors] = useState<InstructorSummary[]>([]);

  // Modals
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Class Type Form
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState('Hatha Yoga');
  const [newTypeLevel, setNewTypeLevel] = useState<ClassLevelType>('ALL_LEVELS');
  const [newTypeDuration, setNewTypeDuration] = useState(60);
  const [newTypeCapacity, setNewTypeCapacity] = useState(20);

  // New Batch Form
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDesc, setNewBatchDesc] = useState('');
  const [newBatchClassTypeId, setNewBatchClassTypeId] = useState('');
  const [newBatchBranchId, setNewBatchBranchId] = useState('');
  const [newBatchRoomId, setNewBatchRoomId] = useState('');
  const [newBatchInstructorId, setNewBatchInstructorId] = useState('');
  const [newBatchDays, setNewBatchDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [newBatchStartTime, setNewBatchStartTime] = useState('07:00');
  const [newBatchEndTime, setNewBatchEndTime] = useState('08:00');
  const [newBatchStartDate, setNewBatchStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newBatchEndDate, setNewBatchEndDate] = useState('');
  const [newBatchCapacity, setNewBatchCapacity] = useState(15);

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';

  // Load Lookups
  useEffect(() => {
    if (!activeTenantId) return;
    const loadLookups = async () => {
      try {
        const [bList, instList] = await Promise.all([
          client.getBranches(),
          client.getInstructors().catch(() => []),
        ]);
        setBranches(bList);
        setInstructors(instList);
        if (bList.length > 0 && !newBatchBranchId) {
          setNewBatchBranchId(bList[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load lookup data:', err);
      }
    };
    loadLookups();
  }, [activeTenantId]);

  // Load Rooms when branch changes
  useEffect(() => {
    if (!activeTenantId || !newBatchBranchId) {
      setRooms([]);
      return;
    }
    const loadRooms = async () => {
      try {
        const rList = await client.getRooms(newBatchBranchId);
        setRooms(rList);
        if (rList.length > 0) {
          setNewBatchRoomId(rList[0].id);
          setNewBatchCapacity(Math.min(15, rList[0].maxMatCapacity));
        }
      } catch (err) {
        console.error('Failed to load rooms:', err);
      }
    };
    loadRooms();
  }, [activeTenantId, newBatchBranchId]);

  // Load Class Types
  const loadClassTypes = async () => {
    if (!activeTenantId) return;
    try {
      setTypesLoading(true);
      setError(null);
      const res = await client.getClassTypes({
        search: typeSearch || undefined,
        level: (selectedLevel as any) || undefined,
      });
      setClassTypes(res.classTypes);
      if (res.classTypes.length > 0 && !newBatchClassTypeId) {
        setNewBatchClassTypeId(res.classTypes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load class types');
    } finally {
      setTypesLoading(false);
    }
  };

  // Load Batches
  const loadBatches = async () => {
    if (!activeTenantId) return;
    try {
      setBatchesLoading(true);
      setError(null);
      const res = await client.getBatches({
        search: batchSearch || undefined,
        branchId: selectedBranch || undefined,
      });
      setBatches(res.batches);
    } catch (err: any) {
      setError(err.message || 'Failed to load batches');
    } finally {
      setBatchesLoading(false);
    }
  };

  useEffect(() => {
    loadClassTypes();
  }, [activeTenantId, typeSearch, selectedLevel]);

  useEffect(() => {
    loadBatches();
  }, [activeTenantId, batchSearch, selectedBranch]);

  // Create Class Type
  const handleCreateClassType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.createClassType({
        name: newTypeName,
        description: newTypeDescription || undefined,
        category: newTypeCategory,
        level: newTypeLevel,
        defaultDurationMins: Number(newTypeDuration),
        defaultCapacity: Number(newTypeCapacity),
      });
      setShowTypeModal(false);
      setNewTypeName('');
      setNewTypeDescription('');
      setActionSuccess('Class type created successfully');
      loadClassTypes();
    } catch (err: any) {
      setError(err.message || 'Failed to create class type');
    }
  };

  // Archive Class Type
  const handleArchiveClassType = async (id: string) => {
    if (!confirm('Are you sure you want to archive this class type?')) return;
    try {
      setError(null);
      await client.archiveClassType(id);
      setActionSuccess('Class type archived');
      loadClassTypes();
    } catch (err: any) {
      setError(err.message || 'Failed to archive class type');
    }
  };

  // Create Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBatchDays.length === 0) {
      setError('Select at least one day of the week for the batch schedule.');
      return;
    }
    try {
      setError(null);
      await client.createBatch({
        name: newBatchName,
        description: newBatchDesc || undefined,
        classTypeId: newBatchClassTypeId,
        branchId: newBatchBranchId,
        roomId: newBatchRoomId,
        instructorId: newBatchInstructorId,
        scheduleType: 'RECURRING_WEEKLY',
        daysOfWeek: newBatchDays,
        startTime: newBatchStartTime,
        endTime: newBatchEndTime,
        startDate: new Date(newBatchStartDate).toISOString(),
        endDate: newBatchEndDate ? new Date(newBatchEndDate).toISOString() : undefined,
        capacity: Number(newBatchCapacity),
      });
      setShowBatchModal(false);
      setNewBatchName('');
      setNewBatchDesc('');
      setActionSuccess('Class batch created successfully and first 30 days generated!');
      loadBatches();
    } catch (err: any) {
      setError(err.message || 'Failed to create batch');
    }
  };

  // Toggle Day selection
  const toggleDay = (dayVal: number) => {
    if (newBatchDays.includes(dayVal)) {
      setNewBatchDays(newBatchDays.filter((d) => d !== dayVal));
    } else {
      setNewBatchDays([...newBatchDays, dayVal].sort());
    }
  };

  const selectedRoom = rooms.find((r) => r.id === newBatchRoomId);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Classes & Batches Management
          </h1>
          <p className="text-sm text-stone-600">
            Define yoga class programs, recurring batches, and room-level schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/classes/schedule">
            <Button variant="outline">Interactive Schedule Calendar</Button>
          </Link>
          {canManage && (
            <>
              {activeTab === 'types' ? (
                <Button onClick={() => setShowTypeModal(true)}>+ New Class Type</Button>
              ) : (
                <Button onClick={() => setShowBatchModal(true)}>+ New Batch</Button>
              )}
            </>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200 flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 font-bold hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'types'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Class Types & Programs ({classTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Batches & Class Groups ({batches.length})
        </button>
      </div>

      {/* TAB 1: Class Types */}
      {activeTab === 'types' && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search class types..."
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none w-full sm:w-64"
            />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Levels</option>
              <option value="ALL_LEVELS">All Levels</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-700">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Program Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Default Capacity</th>
                      <th className="px-4 py-3">Status</th>
                      {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {typesLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                          Loading class types...
                        </td>
                      </tr>
                    ) : classTypes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                          No class types configured yet.
                        </td>
                      </tr>
                    ) : (
                      classTypes.map((t) => (
                        <tr key={t.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-medium text-stone-900">
                            <div>{t.name}</div>
                            {t.description && (
                              <div className="text-xs text-stone-500 line-clamp-1">
                                {t.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-stone-600">{t.category}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{t.level}</Badge>
                          </td>
                          <td className="px-4 py-3">{t.defaultDurationMins} mins</td>
                          <td className="px-4 py-3">{t.defaultCapacity} mats</td>
                          <td className="px-4 py-3">
                            <Badge variant={t.isActive ? 'success' : 'outline'}>
                              {t.isActive ? 'ACTIVE' : 'ARCHIVED'}
                            </Badge>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              {t.isActive && (
                                <button
                                  onClick={() => handleArchiveClassType(t.id)}
                                  className="text-xs text-stone-500 hover:text-red-700"
                                >
                                  Archive
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Batches */}
      {activeTab === 'batches' && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search batches..."
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none w-full sm:w-64"
            />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-700">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Batch Name</th>
                      <th className="px-4 py-3">Class Program</th>
                      <th className="px-4 py-3">Branch & Room</th>
                      <th className="px-4 py-3">Instructor</th>
                      <th className="px-4 py-3">Weekly Schedule</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {batchesLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                          Loading batches...
                        </td>
                      </tr>
                    ) : batches.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                          No batches created yet.
                        </td>
                      </tr>
                    ) : (
                      batches.map((b) => (
                        <tr key={b.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-medium text-stone-900">
                            <Link
                              href={`/classes/batches/${b.id}`}
                              className="text-emerald-700 hover:underline"
                            >
                              {b.name}
                            </Link>
                            <div className="text-xs text-stone-400">
                              {b.sessionCount || 0} scheduled sessions
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600">{b.classTypeName}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-stone-800">{b.branchName}</div>
                            <div className="text-xs text-stone-500">
                              {b.roomName} (Max: {b.roomMaxCapacity})
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-stone-700">
                            {b.instructorName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-stone-800">
                              {b.daysOfWeek.map((d) => DAYS_OF_WEEK[d]?.label).join(', ')}
                            </div>
                            <div className="text-xs text-stone-500">
                              {b.startTime} - {b.endTime}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-stone-800">{b.capacity}</span>
                            <span className="text-xs text-stone-400"> / {b.roomMaxCapacity}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                b.status === 'ACTIVE'
                                  ? 'success'
                                  : b.status === 'PAUSED'
                                  ? 'warning'
                                  : 'outline'
                              }
                            >
                              {b.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/classes/batches/${b.id}`}>
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CREATE CLASS TYPE MODAL */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-stone-900">Create New Class Type</h2>
            <form onSubmit={handleCreateClassType} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Class Name *</label>
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g. Traditional Hatha Yoga"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">Description</label>
                <textarea
                  rows={2}
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="Overview of asanas, pranayama, and session flow"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Category *</label>
                  <input
                    type="text"
                    required
                    value={newTypeCategory}
                    onChange={(e) => setNewTypeCategory(e.target.value)}
                    placeholder="e.g. Hatha, Vinyasa, Yin"
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Level *</label>
                  <select
                    value={newTypeLevel}
                    onChange={(e) => setNewTypeLevel(e.target.value as ClassLevelType)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ALL_LEVELS">All Levels</option>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    required
                    value={newTypeDuration}
                    onChange={(e) => setNewTypeDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Default Capacity (Mats) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newTypeCapacity}
                    onChange={(e) => setNewTypeCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTypeModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Class Type</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-stone-900">Create New Class Batch</h2>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Batch Name *</label>
                <input
                  type="text"
                  required
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. Morning Sunrise Vinyasa - Batch A"
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Class Type *</label>
                  <select
                    required
                    value={newBatchClassTypeId}
                    onChange={(e) => setNewBatchClassTypeId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Class Type</option>
                    {classTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Branch *</label>
                  <select
                    required
                    value={newBatchBranchId}
                    onChange={(e) => setNewBatchBranchId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Room *</label>
                  <select
                    required
                    value={newBatchRoomId}
                    onChange={(e) => setNewBatchRoomId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Max: {r.maxMatCapacity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Instructor *</label>
                  <select
                    required
                    value={newBatchInstructorId}
                    onChange={(e) => setNewBatchInstructorId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Instructor</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.fullName} ({i.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule Days */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Recurring Days of Week *
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = newBatchDays.includes(d.val);
                    return (
                      <button
                        type="button"
                        key={d.val}
                        onClick={() => toggleDay(d.val)}
                        className={`flex-1 rounded py-1.5 text-xs font-semibold border transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={newBatchStartTime}
                    onChange={(e) => setNewBatchStartTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">End Time *</label>
                  <input
                    type="time"
                    required
                    value={newBatchEndTime}
                    onChange={(e) => setNewBatchEndTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dates & Capacity */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatchStartDate}
                    onChange={(e) => setNewBatchStartDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newBatchEndDate}
                    onChange={(e) => setNewBatchEndDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Batch Capacity *
                    {selectedRoom && (
                      <span className="text-stone-400"> (Max {selectedRoom.maxMatCapacity})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedRoom?.maxMatCapacity || 100}
                    required
                    value={newBatchCapacity}
                    onChange={(e) => setNewBatchCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBatchModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Batch & Schedule</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
