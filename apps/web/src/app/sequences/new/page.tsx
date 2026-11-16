'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Button, Badge } from '@yogaos/ui';
import type { SequenceLevel, ExecutionMode, StepSide, SequenceStepInput } from '@yogaos/contracts';

const LEVELS: SequenceLevel[] = ['ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const EXECUTION_MODES: { label: string; value: ExecutionMode }[] = [
  { label: 'Time Hold (Seconds)', value: 'TIME_HOLD' },
  { label: 'Breath Counts', value: 'BREATH_COUNT' },
  { label: 'Dynamic Repetitions', value: 'REPETITION' },
];

export default function NewSequencePage() {
  const router = useRouter();
  const { activeTenantId, token } = useAuth();

  // Sequence Metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetLevel, setTargetLevel] = useState<SequenceLevel>('ALL_LEVELS');
  const [intendedAudience, setIntendedAudience] = useState('');
  const [isStudioTemplate, setIsStudioTemplate] = useState(false);
  const [tags, setTags] = useState('');

  // Steps
  const [steps, setSteps] = useState<SequenceStepInput[]>([]);

  // Catalogs for selection
  const [availableAsanas, setAvailableAsanas] = useState<any[]>([]);
  const [availableMedia, setAvailableMedia] = useState<any[]>([]);

  // Modals & Selectors
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [selectedAsanaId, setSelectedAsanaId] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(30);
  const [newStepMode, setNewStepMode] = useState<ExecutionMode>('TIME_HOLD');
  const [newStepBilateral, setNewStepBilateral] = useState(false);
  const [newStepSide, setNewStepSide] = useState<StepSide>('NONE');
  const [newStepRest, setNewStepRest] = useState(5);
  const [newStepCues, setNewStepCues] = useState('');
  const [newStepNotes, setNewStepNotes] = useState('');
  const [newStepAudioId, setNewStepAudioId] = useState<string>('');
  const [newStepVideoId, setNewStepVideoId] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !activeTenantId) return;

    const loadData = async () => {
      try {
        const client = getApiClient();
        client.setAuthToken(token);
        client.setTenantId(activeTenantId);

        const [asanaRes, mediaRes] = await Promise.all([
          client.getAsanas({ limit: 100 }),
          client.getMediaAssets({ limit: 100 }),
        ]);

        const asanaItems = asanaRes?.data?.items || asanaRes?.items || [];
        setAvailableAsanas(asanaItems);
        if (asanaItems.length > 0) setSelectedAsanaId(asanaItems[0].id);

        const mediaItems = mediaRes?.data?.items || mediaRes?.items || [];
        setAvailableMedia(mediaItems);
      } catch (err) {
        console.error('Error loading posture resources', err);
      }
    };

    loadData();
  }, [token, activeTenantId]);

  // Real-time sequence duration calculation
  const calculateTotalSeconds = (): number => {
    let total = 0;
    for (const step of steps) {
      const baseHold = Math.max(1, step.durationSeconds || 30);
      const holdTime = step.isBilateral ? baseHold * 2 : baseHold;
      const rest = Math.max(0, step.restIntervalSeconds || 0);
      total += holdTime + rest;
    }
    return total;
  };

  const totalSeconds = calculateTotalSeconds();
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder}s`;
  };

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsanaId) return;

    const chosenAsana = availableAsanas.find((a) => a.id === selectedAsanaId);

    const newStep: SequenceStepInput = {
      stepOrder: steps.length + 1,
      asanaId: selectedAsanaId,
      executionMode: newStepMode,
      durationSeconds: Number(newStepDuration),
      isBilateral: newStepBilateral,
      side: newStepSide,
      restIntervalSeconds: Number(newStepRest),
      cues: newStepCues || undefined,
      teacherNotes: newStepNotes || undefined,
      voiceAudioMediaId: newStepAudioId || undefined,
      demoVideoMediaId: newStepVideoId || undefined,
    };

    setSteps([...steps, newStep]);
    setShowAddStepModal(false);

    // Reset step form defaults
    setNewStepDuration(30);
    setNewStepBilateral(false);
    setNewStepSide('NONE');
    setNewStepRest(5);
    setNewStepCues('');
    setNewStepNotes('');
    setNewStepAudioId('');
    setNewStepVideoId('');
  };

  const handleMoveStep = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === steps.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const reordered = [...steps];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Fix step orders
    const normalized = reordered.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    setSteps(normalized);
  };

  const handleRemoveStep = (index: number) => {
    const filtered = steps.filter((_, idx) => idx !== index);
    const normalized = filtered.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    setSteps(normalized);
  };

  const handleSaveSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) {
      setError('Studio context is required');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      const payload = {
        title,
        description: description || undefined,
        objective: objective || undefined,
        targetLevel,
        intendedAudience: intendedAudience || undefined,
        isStudioTemplate,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        steps,
      };

      const res = await client.createSequence(payload);
      const createdId = res?.data?.id || res?.id;
      router.push(`/sequences/${createdId}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create sequence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Breadcrumb Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/sequences" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Sequences Directory
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Flow Runtime: <span className="text-stone-900 font-bold">{formatDuration(totalSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Sequence Builder</h1>
          <p className="mt-1 text-sm text-stone-500">
            Compose posture progressions, configure bilateral symmetry, attach teacher guidance cues, and calculate live class runtime.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSequence} className="mt-6 space-y-8">
        {/* Sequence Metadata */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-stone-900 border-b pb-3">Sequence Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Sequence Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Grounding Earth Flow & Hip Decompression"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Target Difficulty Level *
              </label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value as SequenceLevel)}
                className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Class Objective / Intentional Focus
              </label>
              <input
                type="text"
                placeholder="e.g. Open groin & hamstring flexibility for Hanumanasana"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Intended Practitioner Audience
              </label>
              <input
                type="text"
                placeholder="e.g. Intermediate practitioners, morning vinyasa students"
                value={intendedAudience}
                onChange={(e) => setIntendedAudience(e.target.value)}
                className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
              Description & Flow Notes
            </label>
            <textarea
              rows={2}
              placeholder="Detailed description of pacing, breathwork, warm-up, and cooling phases..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Search Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. vinyasa, hips, morning, peak-pose"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="isStudioTemplate"
                checked={isStudioTemplate}
                onChange={(e) => setIsStudioTemplate(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isStudioTemplate" className="text-sm font-medium text-stone-700">
                Mark as Studio Template (Available to all studio instructors)
              </label>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">Posture Progression & Steps</h2>
              <p className="text-xs text-stone-500">
                {steps.length} posture(s) in sequence | Total Runtime: {formatDuration(totalSeconds)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddStepModal(true)}
            >
              + Add Asana Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center text-sm text-stone-500">
              No postures added to this sequence yet. Click "+ Add Asana Step" to select from the asana catalog.
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, idx) => {
                const asana = availableAsanas.find((a) => a.id === step.asanaId);

                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                        {step.stepOrder}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-stone-900">
                            {asana?.englishName || 'Custom Posture'}
                          </h3>
                          {asana?.sanskritNameIast && (
                            <span className="text-xs text-stone-500 font-serif">
                              ({asana.sanskritNameIast})
                            </span>
                          )}
                          {step.isBilateral && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
                              Bilateral (2x Hold)
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                          <span>
                            Hold: <strong className="text-stone-900">{step.durationSeconds}s</strong>
                            {step.isBilateral ? ' per side' : ''}
                          </span>
                          {step.restIntervalSeconds ? (
                            <span>
                              Rest: <strong className="text-stone-900">{step.restIntervalSeconds}s</strong>
                            </span>
                          ) : null}
                          {step.voiceAudioMediaId && (
                            <span className="text-emerald-700 font-medium">🎵 Audio Guidance</span>
                          )}
                          {step.demoVideoMediaId && (
                            <span className="text-blue-700 font-medium">▶ Demo Video</span>
                          )}
                        </div>

                        {step.cues && (
                          <p className="mt-2 text-xs italic text-stone-600 bg-white p-2 rounded border border-stone-200/60">
                            “{step.cues}”
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, 'UP')}
                        className="rounded border border-stone-300 p-1.5 text-xs text-stone-600 hover:bg-white disabled:opacity-30"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveStep(idx, 'DOWN')}
                        className="rounded border border-stone-300 p-1.5 text-xs text-stone-600 hover:bg-white disabled:opacity-30"
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="rounded border border-stone-300 p-1.5 text-xs text-rose-600 hover:bg-rose-50"
                        title="Remove Step"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save Draft Action */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Link href="/sequences">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving || steps.length === 0}>
            {saving ? 'Saving...' : 'Save Sequence Draft'}
          </Button>
        </div>
      </form>

      {/* Add Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-stone-900">Add Posture to Sequence</h2>
              <button
                type="button"
                onClick={() => setShowAddStepModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStep} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Select Asana Posture *
                </label>
                <select
                  required
                  value={selectedAsanaId}
                  onChange={(e) => setSelectedAsanaId(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {availableAsanas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.englishName} ({a.sanskritNameIast || a.sanskritName}) [{a.category}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Hold Duration (Seconds) *
                  </label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={600}
                    value={newStepDuration}
                    onChange={(e) => setNewStepDuration(Number(e.target.value))}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Rest / Transition Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={newStepRest}
                    onChange={(e) => setNewStepRest(Number(e.target.value))}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bilateral symmetry */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newStepBilateral"
                    checked={newStepBilateral}
                    onChange={(e) => setNewStepBilateral(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="newStepBilateral" className="text-xs font-semibold text-amber-950">
                    Bilateral Posture (Automatically executes symmetrical Right and Left holds)
                  </label>
                </div>
                {newStepBilateral && (
                  <p className="text-xs text-amber-800">
                    Calculated duration will double to {newStepDuration * 2}s total posture hold time.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Verbal Guidance & Alignment Cues
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ground outer heel, extend arms parallel to floor, soften front knee over ankle..."
                  value={newStepCues}
                  onChange={(e) => setNewStepCues(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Teacher Preparation Notes & Modifications
                </label>
                <input
                  type="text"
                  placeholder="e.g. Provide block under front hand for practitioners with tight hamstrings"
                  value={newStepNotes}
                  onChange={(e) => setNewStepNotes(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Media Attachments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Attach Audio Voice Guidance
                  </label>
                  <select
                    value={newStepAudioId}
                    onChange={(e) => setNewStepAudioId(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">None (Teacher live cues)</option>
                    {availableMedia
                      .filter((m) => m.mediaType === 'AUDIO')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Attach Demonstration Video
                  </label>
                  <select
                    value={newStepVideoId}
                    onChange={(e) => setNewStepVideoId(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">None (Static posture reference)</option>
                    {availableMedia
                      .filter((m) => m.mediaType === 'VIDEO')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddStepModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Add Step to Flow
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
