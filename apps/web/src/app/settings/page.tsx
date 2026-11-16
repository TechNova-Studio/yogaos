'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { BranchDetails, RoomDetails } from '@yogaos/contracts';

export default function StudioSettingsPage() {
  const { user, activeTenantId, activeRole, token } = useAuth();
  const [studio, setStudio] = useState<any>(null);
  const [branches, setBranches] = useState<BranchDetails[]>([]);
  const [rooms, setRooms] = useState<RoomDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Studio Settings form state
  const [name, setName] = useState('');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');

  // New Branch modal state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [stateCode, setStateCode] = useState('29'); // Karnataka default
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // New Room modal state
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomBranchId, setRoomBranchId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('25');

  const client = getApiClient();
  if (token) client.setAuthToken(token);
  if (activeTenantId) client.setTenantId(activeTenantId);

  const loadData = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      const [studioData, branchList, roomList] = await Promise.all([
        client.getOrganizationSettings(),
        client.getBranches(),
        client.getRooms(),
      ]);

      setStudio(studioData);
      setName(studioData.name || '');
      setLegalEntityName(studioData.legalEntityName || '');
      setGstin(studioData.gstin || '');
      setPanNumber(studioData.panNumber || '');
      setTimezone(studioData.timezone || 'Asia/Kolkata');
      setCurrency(studioData.currency || 'INR');

      setBranches(branchList);
      setRooms(roomList);
      if (branchList.length > 0 && !roomBranchId) {
        setRoomBranchId(branchList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load studio details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenantId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      setError(null);
      await client.updateOrganizationSettings({
        name,
        legalEntityName,
        gstin,
        panNumber,
        timezone,
        currency,
      });
      setMessage('Studio profile and settings successfully updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update studio settings');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await client.createBranch({
        name: branchName,
        slug: branchSlug.toLowerCase(),
        streetAddress,
        city,
        state,
        stateCode,
        postalCode,
        phone,
        email,
      });
      setShowBranchModal(false);
      // Reset form
      setBranchName('');
      setBranchSlug('');
      setStreetAddress('');
      setCity('');
      setState('');
      setPostalCode('');
      setPhone('');
      setEmail('');
      setMessage('New branch successfully created');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const cap = parseInt(roomCapacity, 10);
      if (isNaN(cap) || cap < 1) {
        setError('Room capacity must be at least 1');
        return;
      }
      await client.createRoom({
        branchId: roomBranchId,
        name: roomName,
        description: roomDescription || null,
        maxMatCapacity: cap,
      });
      setShowRoomModal(false);
      setRoomName('');
      setRoomDescription('');
      setRoomCapacity('25');
      setMessage('New room successfully added');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    }
  };

  if (activeRole !== 'OWNER' && activeRole !== 'MANAGER') {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-stone-900">Access Restricted</h1>
        <p className="mt-2 text-stone-600">Only studio Owners and Managers can access Studio Settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Studio & Infrastructure Settings</h1>
        <p className="text-sm text-stone-500">Configure studio legal profile, physical branches, and practice rooms.</p>
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Organization Profile */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Studio Profile</CardTitle>
              <CardDescription>Legal entity, taxation and locale configuration.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Studio Brand Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">Legal Entity Name</label>
                  <input
                    type="text"
                    value={legalEntityName}
                    onChange={(e) => setLegalEntityName(e.target.value)}
                    placeholder="e.g. Shanti Yoga Private Limited"
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="29AAAAA0000A1Z5"
                      maxLength={15}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700">PAN Number</label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" variant="primary" size="sm" className="w-full">
                  Save Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Branches & Rooms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Branch Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Physical Branches</CardTitle>
                <CardDescription>Studio locations and contact information.</CardDescription>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowBranchModal(true)}>
                + New Branch
              </Button>
            </CardHeader>
            <CardContent>
              {branches.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  No branches found. Create your studio's first branch location.
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {branches.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{b.name}</span>
                          <span className="text-xs text-stone-500 font-mono">/{b.slug}</span>
                          <Badge variant={b.isActive ? 'success' : 'default'}>
                            {b.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-stone-600 mt-1">
                          {b.streetAddress}, {b.city}, {b.state} - {b.postalCode} (State Code: {b.stateCode})
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          📞 {b.phone} | ✉️ {b.email} | 🏛️ {b.roomCount || 0} Rooms
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Practice Rooms & Shalas</CardTitle>
                <CardDescription>Practice halls with mat capacities linked to branches.</CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowRoomModal(true)}
                disabled={branches.length === 0}
              >
                + Add Room
              </Button>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  No rooms created yet. Add a room to schedule yoga batches.
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {rooms.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-900">{r.name}</span>
                          <span className="text-xs rounded bg-stone-100 px-2 py-0.5 text-stone-700">
                            Branch: {r.branchName}
                          </span>
                          <Badge variant="default">Max {r.maxMatCapacity} Mats</Badge>
                        </div>
                        {r.description && (
                          <p className="text-xs text-stone-500 mt-1">{r.description}</p>
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

      {/* New Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Create New Studio Branch</h2>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => {
                    setBranchName(e.target.value);
                    if (!branchSlug) {
                      setBranchSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="e.g. Indiranagar Main"
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700">URL Slug</label>
                <input
                  type="text"
                  value={branchSlug}
                  onChange={(e) => setBranchSlug(e.target.value)}
                  placeholder="indiranagar-main"
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700">Street Address</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="100 Feet Rd, Defence Colony"
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">GST State Code (2-digit)</label>
                  <input
                    type="text"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    maxLength={2}
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="560038"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@studio.in"
                    required
                    className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowBranchModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Create Branch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Add Practice Room / Shala</h2>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700">Branch Location</label>
                <select
                  value={roomBranchId}
                  onChange={(e) => setRoomBranchId(e.target.value)}
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
              <div>
                <label className="block text-xs font-medium text-stone-700">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Surya Shala (Main Studio)"
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700">Mat Capacity (Minimum 1)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(e.target.value)}
                  required
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700">Description (Optional)</label>
                <textarea
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  placeholder="Teakwood flooring, temperature controlled, prop racks available"
                  rows={2}
                  className="mt-1 block w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowRoomModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Add Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
