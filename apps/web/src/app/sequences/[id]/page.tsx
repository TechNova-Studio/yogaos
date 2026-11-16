'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Button, Badge } from '@yogaos/ui';

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { activeTenantId, activeRole, token } = useAuth();

  const [sequence, setSequence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  const fetchSequence = async () => {
    if (!token || !id || !activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      const res = await client.getSequence(id);
      const data = res?.data || res;
      setSequence(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sequence details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequence();
  }, [token, activeTenantId, id]);

  const handlePublish = async () => {
    if (!token || !activeTenantId) return;
    setPublishing(true);
    setError(null);
    setActionSuccess(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      await client.publishSequence(id);
      setActionSuccess('Sequence successfully published! It is now locked and ready to attach to classes.');
      fetchSequence();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish sequence');
    } finally {
      setPublishing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!token || !activeTenantId) return;
    setDuplicating(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      const res = await client.duplicateSequence(id);
      const dupId = res?.data?.id || res?.id;
      router.push(`/sequences/${dupId}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to duplicate sequence');
      setDuplicating(false);
    }
  };

  const handleArchive = async () => {
    if (!token || !activeTenantId) return;
    if (!confirm('Are you sure you want to archive this sequence?')) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);

      await client.archiveSequence(id);
      router.push('/sequences');
    } catch (err: any) {
      setError(err?.message || 'Failed to archive sequence');
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

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center text-sm text-stone-500">
        Loading sequence preview...
      </div>
    );
  }

  if (error || !sequence) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <h2 className="text-lg font-bold">Sequence Not Found</h2>
          <p className="mt-1 text-sm">{error || 'The requested sequence could not be retrieved.'}</p>
          <Link href="/sequences" className="mt-4 inline-block">
            <Button variant="outline">← Back to Sequences</Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeVersion = sequence.activeVersionDetails;
  const steps = activeVersion?.steps || [];
  const isPublished = sequence.status === 'PUBLISHED';

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Navigation breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/sequences" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Sequences Directory
        </Link>

        <div className="flex items-center gap-2">
          {canManage && !isPublished && (
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publishing...' : 'Publish Sequence'}
            </Button>
          )}

          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
                {duplicating ? 'Duplicating...' : 'Duplicate Flow'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive}>
                Archive
              </Button>
            </>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Sequence Overview Banner */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isPublished ? 'success' : 'outline'}>
                {sequence.status} (v{sequence.activeVersion}.0)
              </Badge>
              {sequence.isStudioTemplate && (
                <Badge variant="default" className="text-xs">
                  Studio Template
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {sequence.targetLevel}
              </Badge>
            </div>

            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {sequence.title}
            </h1>

            {sequence.objective && (
              <div className="mt-2 text-sm text-stone-600 font-medium">
                Objective: <span className="text-stone-900">{sequence.objective}</span>
              </div>
            )}
            {sequence.intendedAudience && (
              <div className="mt-1 text-xs text-stone-500">
                Audience: <span className="text-stone-700">{sequence.intendedAudience}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Total Flow Runtime
            </span>
            <span className="text-2xl font-black text-stone-900">
              {formatDuration(sequence.estimatedTotalDurationSecs)}
            </span>
            <span className="text-xs text-stone-500">
              {steps.length} sequential postures
            </span>
          </div>
        </div>

        {sequence.description && (
          <p className="mt-4 text-sm leading-relaxed text-stone-700 border-t border-stone-100 pt-4">
            {sequence.description}
          </p>
        )}
      </div>

      {/* Ordered Timeline Preview */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">Class Execution Progression</h2>
          <span className="text-xs text-stone-500">
            Ordered Step-by-Step Instruction Timeline
          </span>
        </div>

        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center text-sm text-stone-500">
            No posture steps recorded in this version.
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step: any, idx: number) => {
              const asana = step.asana;

              return (
                <div
                  key={step.id}
                  className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm flex flex-col md:flex-row"
                >
                  {/* Step Order & Timing Column */}
                  <div className="bg-stone-50 p-4 md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-stone-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                          {step.stepOrder}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          Step #{step.stepOrder}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-lg font-black text-stone-900">
                          {step.durationSeconds}s Hold
                        </div>
                        {step.isBilateral ? (
                          <div className="text-xs text-amber-800 font-medium">
                            Bilateral (2x = {step.durationSeconds * 2}s)
                          </div>
                        ) : null}
                        {step.restIntervalSeconds ? (
                          <div className="text-xs text-stone-500 mt-1">
                            +{step.restIntervalSeconds}s Rest Interval
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-stone-200/60">
                      <span className="text-xs uppercase tracking-wide text-stone-400 font-semibold">
                        Mode: {step.executionMode}
                      </span>
                    </div>
                  </div>

                  {/* Posture & Guidance Body */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                            {asana?.sanskritNameIast || step.sanskritNameSnapshot || asana?.sanskritName}
                          </div>
                          <h3 className="text-xl font-bold text-stone-900 mt-0.5">
                            {asana?.englishName || step.asanaNameSnapshot || 'Custom Posture'}
                          </h3>
                        </div>

                        {asana?.category && (
                          <Badge variant="outline" className="text-xs">
                            {asana.category}
                          </Badge>
                        )}
                      </div>

                      {step.cues && (
                        <div className="mt-3 rounded-lg bg-emerald-50/60 p-3 border border-emerald-100">
                          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide block mb-1">
                            Teacher Verbal Cue:
                          </span>
                          <p className="text-sm text-emerald-900 italic">
                            “{step.cues}”
                          </p>
                        </div>
                      )}

                      {step.teacherNotes && (
                        <div className="mt-2 text-xs text-stone-600">
                          <strong className="text-stone-800">Teacher Notes:</strong> {step.teacherNotes}
                        </div>
                      )}

                      {step.transitionNotes && (
                        <div className="mt-1 text-xs text-stone-500">
                          <strong className="text-stone-700">Transition:</strong> {step.transitionNotes}
                        </div>
                      )}
                    </div>

                    {/* Media Attachments Preview (Accessible Players with NO Autoplay) */}
                    {(step.voiceAudioMedia || step.demoVideoMedia || step.referenceImageMedia) && (
                      <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Instructional Media Attachments:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {step.voiceAudioMedia && (
                            <div className="rounded border border-stone-200 p-2 bg-stone-50 text-xs">
                              <span className="font-semibold text-emerald-800 block mb-1">
                                🎵 Voice Cue: {step.voiceAudioMedia.title}
                              </span>
                              <audio
                                controls
                                preload="metadata"
                                className="w-full h-8"
                                src={step.voiceAudioMedia.url}
                              >
                                Audio preview not supported.
                              </audio>
                            </div>
                          )}

                          {step.demoVideoMedia && (
                            <div className="rounded border border-stone-200 p-2 bg-stone-900 text-xs text-white">
                              <span className="font-semibold block mb-1">
                                ▶ Demo Video: {step.demoVideoMedia.title}
                              </span>
                              <video
                                controls
                                preload="metadata"
                                className="w-full max-h-36 rounded"
                                src={step.demoVideoMedia.url}
                              >
                                Video preview not supported.
                              </video>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
