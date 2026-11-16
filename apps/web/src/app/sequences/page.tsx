'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { SequenceLevel, SequenceStatus } from '@yogaos/contracts';

const LEVELS: { label: string; value: SequenceLevel | '' }[] = [
  { label: 'All Levels', value: '' },
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Intermediate', value: 'INTERMEDIATE' },
  { label: 'Advanced', value: 'ADVANCED' },
  { label: 'All Levels Class', value: 'ALL_LEVELS' },
];

const STATUSES: { label: string; value: SequenceStatus | '' }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function SequencesPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<SequenceLevel | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<SequenceStatus | ''>('');

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  const fetchSequences = async () => {
    if (!token || !activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      const res = await client.getSequences({
        search: search || undefined,
        targetLevel: selectedLevel || undefined,
        status: selectedStatus || undefined,
        limit: 100,
      });

      const items = res?.data?.items || res?.items || [];
      setSequences(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, [token, activeTenantId, search, selectedLevel, selectedStatus]);

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !activeTenantId) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      await client.duplicateSequence(id);
      setActionSuccess('Sequence duplicated successfully!');
      fetchSequences();
    } catch (err: any) {
      setError(err?.message || 'Failed to duplicate sequence');
    }
  };

  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0 min';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Class Sequences</h1>
          <p className="mt-1 text-sm text-stone-500">
            Structured yoga flows, posture timings, bilateral holds, audio guidance, and instructional previews.
          </p>
        </div>
        {canManage && (
          <Link href="/sequences/new">
            <Button>
              + Create New Sequence
            </Button>
          </Link>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}
      {actionSuccess && (
        <div className="mt-4 rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-stone-50 p-4 rounded-lg border border-stone-200">
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Search sequence title, objective or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value as SequenceLevel | '')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          {LEVELS.map((lvl) => (
            <option key={lvl.label} value={lvl.value}>
              {lvl.label}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as SequenceStatus | '')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          {STATUSES.map((st) => (
            <option key={st.label} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sequences Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-stone-500">Loading sequences...</div>
        ) : sequences.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 py-16 text-center">
            <h3 className="text-base font-semibold text-stone-800">No class sequences found</h3>
            <p className="mt-1 text-sm text-stone-500">
              Create your first posture flow using the Sequence Builder to begin linking sequences to scheduled classes.
            </p>
            {canManage && (
              <div className="mt-4">
                <Link href="/sequences/new">
                  <Button size="sm">Create Sequence</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sequences.map((seq) => {
              const latestVersion = seq.versions?.[0];
              const stepCount = latestVersion?._count?.steps ?? 0;

              return (
                <Card key={seq.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={seq.status === 'PUBLISHED' ? 'success' : 'outline'}>
                            {seq.status} (v{seq.activeVersion}.0)
                          </Badge>
                          {seq.isStudioTemplate && (
                            <Badge variant="default" className="text-xs">
                              Template
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold text-stone-900">
                          {seq.title}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {seq.targetLevel}
                      </Badge>
                    </div>

                    <CardDescription className="line-clamp-2 mt-2 text-xs text-stone-600">
                      {seq.description || seq.objective || 'No sequence description provided.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-4 bg-stone-50 p-2.5 rounded border border-stone-100">
                      <div>
                        <span className="font-semibold text-stone-800">{stepCount}</span> postures
                      </div>
                      <div>
                        <span className="font-semibold text-stone-800">
                          {formatDuration(seq.estimatedTotalDurationSecs)}
                        </span>{' '}
                        duration
                      </div>
                      <div>
                        Author: <span className="font-medium text-stone-700">{seq.creatorUser?.fullName || 'Teacher'}</span>
                      </div>
                    </div>

                    {seq.tags && seq.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {seq.tags.slice(0, 4).map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(seq.id, e)}
                          className="text-xs font-medium text-stone-500 hover:text-emerald-700"
                        >
                          Duplicate
                        </button>
                      )}
                      <Link href={`/sequences/${seq.id}`}>
                        <Button variant="outline" size="sm">
                          View & Preview →
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
