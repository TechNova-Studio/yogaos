'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';

export default function AsanaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { activeTenantId, activeRole, token } = useAuth();

  const [asana, setAsana] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Associate Media Modal
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [attaching, setAttaching] = useState(false);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';
  const isCustom = asana && !asana.isSharedReference && asana.tenantId === activeTenantId;

  const fetchAsana = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      const res = await client.getAsana(id);
      const data = res?.data || res;
      setAsana(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load posture details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMedia = async () => {
    if (!token) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      const res = await client.getMediaAssets({ limit: 50 });
      const items = res?.data?.items || res?.items || [];
      setMediaList(items);
      if (items.length > 0 && !selectedMediaId) {
        setSelectedMediaId(items[0].id);
      }
    } catch (err) {
      console.error('Failed to load media assets', err);
    }
  };

  useEffect(() => {
    fetchAsana();
  }, [token, activeTenantId, id]);

  const handleOpenAttachModal = () => {
    fetchAvailableMedia();
    setShowAttachModal(true);
  };

  const handleAttachMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId || !selectedMediaId) return;
    setAttaching(true);
    setError(null);
    setActionSuccess(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);
      await client.associateAsanaMedia(id, {
        mediaAssetId: selectedMediaId,
        caption: mediaCaption || undefined,
        sortOrder,
      });
      setActionSuccess('Media demonstration attached successfully!');
      setShowAttachModal(false);
      setMediaCaption('');
      fetchAsana();
    } catch (err: any) {
      setError(err?.message || 'Failed to attach media');
    } finally {
      setAttaching(false);
    }
  };

  const handleRemoveMedia = async (mediaAssetId: string) => {
    if (!token || !activeTenantId) return;
    if (!confirm('Are you sure you want to remove this media reference?')) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);
      await client.removeAsanaMedia(id, mediaAssetId);
      setActionSuccess('Media removed from posture.');
      fetchAsana();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove media');
    }
  };

  const handleArchive = async () => {
    if (!token || !activeTenantId) return;
    if (!confirm('Are you sure you want to archive this custom posture?')) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);
      await client.archiveAsana(id);
      router.push('/asana-library');
    } catch (err: any) {
      setError(err?.message || 'Failed to archive posture');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center text-sm text-stone-500">
        Loading posture details...
      </div>
    );
  }

  if (error || !asana) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <h2 className="text-lg font-bold">Posture Not Found</h2>
          <p className="mt-1 text-sm">{error || 'The requested posture could not be retrieved.'}</p>
          <Link href="/asana-library" className="mt-4 inline-block">
            <Button variant="outline">← Back to Asana Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Navigation breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/asana-library" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Asana Library
        </Link>
        <div className="flex items-center gap-2">
          {canManage && isCustom && (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              Archive Posture
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={handleOpenAttachModal}>
              Attach Media Demo
            </Button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 rounded-md bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}

      {/* Main Posture Header */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
              {asana.sanskritNameIast || asana.sanskritName}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-stone-900 tracking-tight">
              {asana.englishName}
            </h1>
            {asana.sanskritName && (
              <div className="mt-1 text-lg font-serif text-stone-600">
                {asana.sanskritName}
              </div>
            )}
            {asana.commonName && (
              <div className="mt-1 text-xs text-stone-500">
                Common/Vernacular: <span className="font-medium text-stone-700">{asana.commonName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{asana.category}</Badge>
            <Badge
              variant={
                asana.difficulty === 'ADVANCED'
                  ? 'destructive'
                  : asana.difficulty === 'INTERMEDIATE'
                  ? 'outline'
                  : 'success'
              }
            >
              {asana.difficulty}
            </Badge>
            <Badge variant={asana.isSharedReference ? 'outline' : 'default'}>
              {asana.isSharedReference ? 'YogaOS Classical Catalog' : 'Studio Custom'}
            </Badge>
          </div>
        </div>

        {asana.description && (
          <p className="mt-4 text-base leading-relaxed text-stone-700 border-t border-stone-100 pt-4">
            {asana.description}
          </p>
        )}
      </div>

      {/* Media Demonstrations Player / Gallery */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center justify-between">
          <span>Instructional Media & Demonstrations</span>
          <span className="text-xs font-normal text-stone-500">
            {asana.mediaList?.length || 0} demonstration(s)
          </span>
        </h2>

        {(!asana.mediaList || asana.mediaList.length === 0) ? (
          <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            No media demonstration attached yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {asana.mediaList.map((item: any) => {
              const asset = item.mediaAsset;
              if (!asset) return null;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm flex flex-col justify-between"
                >
                  <div className="bg-stone-950 p-2 flex items-center justify-center min-h-[200px]">
                    {asset.mediaType === 'VIDEO' ? (
                      <video
                        controls
                        preload="metadata"
                        className="max-h-64 w-full rounded"
                        src={asset.url}
                      >
                        Your browser does not support video playback.
                      </video>
                    ) : asset.mediaType === 'AUDIO' ? (
                      <div className="w-full px-4 py-8 text-center">
                        <div className="text-xs text-stone-400 mb-2 uppercase tracking-wide">
                          Audio Guidance
                        </div>
                        <audio
                          controls
                          preload="metadata"
                          className="w-full"
                          src={asset.url}
                        >
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    ) : (
                      <img
                        src={asset.url}
                        alt={item.caption || asset.title}
                        className="max-h-64 w-auto object-contain rounded"
                      />
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                        {asset.mediaType}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(asset.id)}
                          className="text-xs text-rose-600 hover:text-rose-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-stone-900">{asset.title}</h3>
                    {item.caption && (
                      <p className="mt-1 text-xs text-stone-600 italic">“{item.caption}”</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Posture Guidance & Alignment Details */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alignment Cues */}
        {asana.alignmentCues && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6">
            <h3 className="text-base font-bold text-emerald-950 mb-2">Key Alignment Cues</h3>
            <p className="text-sm leading-relaxed text-emerald-900 whitespace-pre-line">
              {asana.alignmentCues}
            </p>
          </div>
        )}

        {/* Step-by-Step Instructions */}
        {asana.instructions && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="text-base font-bold text-stone-900 mb-2">Step-by-Step Instructions</h3>
            <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-line">
              {asana.instructions}
            </p>
          </div>
        )}
      </div>

      {/* Anatomy, Benefits & Contraindications */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Anatomical Focus */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
            Anatomical Focus
          </h4>
          {asana.anatomicalFocus?.length > 0 ? (
            <ul className="space-y-1 text-sm text-stone-800">
              {asana.anatomicalFocus.map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-stone-400">Not specified</span>
          )}
        </div>

        {/* Benefits */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">
            Therapeutic Benefits
          </h4>
          {asana.benefits?.length > 0 ? (
            <ul className="space-y-1 text-sm text-stone-800">
              {asana.benefits.map((b: string, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-stone-400">Not specified</span>
          )}
        </div>

        {/* Contraindications & Safety Disclaimer */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-3">
            Contraindications & Cautions
          </h4>
          {asana.contraindications?.length > 0 ? (
            <ul className="space-y-1 text-sm text-rose-900 mb-3">
              {asana.contraindications.map((c: string, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-stone-400 mb-2">No specific contraindications listed.</div>
          )}
          {asana.cautions && (
            <div className="text-xs text-rose-800 italic border-t border-rose-200/60 pt-2">
              <span className="font-semibold">Caution:</span> {asana.cautions}
            </div>
          )}
        </div>
      </div>

      {/* Attach Media Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-stone-900">Attach Media to Posture</h2>
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachMedia} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Select Media Asset from Studio Library *
                </label>
                {mediaList.length === 0 ? (
                  <div className="rounded border border-stone-200 p-3 text-xs text-stone-500">
                    No media assets available. Upload an image, audio, or video in the Media Library first.
                  </div>
                ) : (
                  <select
                    value={selectedMediaId}
                    onChange={(e) => setSelectedMediaId(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {mediaList.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.mediaType}] {m.title} ({m.fileName})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Caption / Teacher Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master teacher demonstration showing lateral extension"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Display Sort Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAttachModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={attaching || mediaList.length === 0}>
                  {attaching ? 'Attaching...' : 'Attach to Posture'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
