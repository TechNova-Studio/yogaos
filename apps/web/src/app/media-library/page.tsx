'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { MediaType } from '@yogaos/contracts';

const MEDIA_TYPES: { label: string; value: MediaType | '' }[] = [
  { label: 'All Media Types', value: '' },
  { label: 'Images', value: 'IMAGE' },
  { label: 'Videos', value: 'VIDEO' },
  { label: 'Audio Tracks', value: 'AUDIO' },
  { label: 'Documents / PDFs', value: 'DOCUMENT' },
];

export default function MediaLibraryPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | ''>('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<any | null>(null);

  // Upload Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(1024 * 500); // 500KB default
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | ''>('');
  const [isSharedReference, setIsSharedReference] = useState(false);

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  const fetchMedia = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      const res = await client.getMediaAssets({
        search: search || undefined,
        mediaType: selectedMediaType || undefined,
        limit: 100,
      });
      const items = res?.data?.items || res?.items || [];
      setMediaList(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load media assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [token, activeTenantId, search, selectedMediaType]);

  const handleMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    if (type === 'IMAGE') {
      setMimeType('image/jpeg');
      setFileName('asana-demo.jpg');
      setUrl('https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80');
    } else if (type === 'VIDEO') {
      setMimeType('video/mp4');
      setFileName('vinyasa-flow-demo.mp4');
      setUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    } else if (type === 'AUDIO') {
      setMimeType('audio/mpeg');
      setFileName('pranayama-breath-guide.mp3');
      setUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    } else if (type === 'DOCUMENT') {
      setMimeType('application/pdf');
      setFileName('anatomy-alignment-guide.pdf');
      setUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setUploading(true);
    setError(null);
    setActionSuccess(null);

    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      const storageKey = `studios/${activeTenantId || 'shared'}/${mediaType.toLowerCase()}s/${Date.now()}-${fileName}`;

      await client.createMediaAsset({
        title,
        description: description || undefined,
        mediaType,
        fileName,
        fileSize: Number(fileSize),
        mimeType,
        storageKey,
        url,
        thumbnailUrl: thumbnailUrl || undefined,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        isSharedReference,
      });

      setActionSuccess(`Media asset "${title}" registered successfully!`);
      setShowUploadModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      setUrl('');
      setThumbnailUrl('');
      setDurationSeconds('');
      fetchMedia();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload media asset');
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!confirm('Are you sure you want to archive this media asset?')) return;
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      await client.archiveMediaAsset(id);
      setActionSuccess('Media asset archived.');
      if (previewMedia?.id === id) {
        setPreviewMedia(null);
      }
      fetchMedia();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive media asset');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Media Library</h1>
          <p className="mt-1 text-sm text-stone-500">
            Teacher instructional videos, audio guidance files, alignment graphics, and reference documents.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowUploadModal(true)}>
            Upload Media Asset
          </Button>
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

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-stone-50 p-4 rounded-lg border border-stone-200">
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Search media by title, description or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedMediaType}
          onChange={(e) => setSelectedMediaType(e.target.value as MediaType | '')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          {MEDIA_TYPES.map((t) => (
            <option key={t.label} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Media Assets Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-stone-500">Loading media assets...</div>
        ) : mediaList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 py-16 text-center">
            <h3 className="text-base font-semibold text-stone-800">No media assets found</h3>
            <p className="mt-1 text-sm text-stone-500">
              Upload teacher-recorded videos, audio cues, or posture photographs to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {mediaList.map((item) => (
              <div
                key={item.id}
                onClick={() => setPreviewMedia(item)}
                className="group cursor-pointer overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                {/* Media Preview Box */}
                <div className="relative aspect-video w-full bg-stone-900 flex items-center justify-center overflow-hidden">
                  {item.mediaType === 'IMAGE' ? (
                    <img
                      src={item.url}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : item.mediaType === 'VIDEO' ? (
                    <div className="flex flex-col items-center gap-1 text-stone-400">
                      <span className="text-3xl">▶</span>
                      <span className="text-xs font-medium">Video Player</span>
                    </div>
                  ) : item.mediaType === 'AUDIO' ? (
                    <div className="flex flex-col items-center gap-1 text-stone-400">
                      <span className="text-3xl">🎵</span>
                      <span className="text-xs font-medium">Audio Track</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-stone-400">
                      <span className="text-3xl">📄</span>
                      <span className="text-xs font-medium">Document / PDF</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge variant="outline" className="bg-stone-900/80 text-white text-xs border-none">
                      {item.mediaType}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-stone-900 line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      {item.description || item.fileName}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                    <span>{formatFileSize(item.fileSize)}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => handleArchive(item.id, e)}
                        className="text-stone-400 hover:text-rose-600"
                        title="Archive Asset"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <Badge variant="outline" className="mb-1 text-xs">
                  {previewMedia.mediaType}
                </Badge>
                <h2 className="text-lg font-bold text-stone-900">{previewMedia.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Responsive Player / Viewer with NO Autoplay */}
            <div className="mt-4 overflow-hidden rounded-lg bg-stone-950 p-2 flex items-center justify-center">
              {previewMedia.mediaType === 'VIDEO' ? (
                <video
                  controls
                  preload="metadata"
                  className="max-h-80 w-full rounded"
                  src={previewMedia.url}
                >
                  Your browser does not support video playback.
                </video>
              ) : previewMedia.mediaType === 'AUDIO' ? (
                <div className="w-full px-6 py-8 text-center">
                  <div className="text-xs text-stone-400 mb-3 uppercase tracking-wider">
                    Audio Guidance
                  </div>
                  <audio
                    controls
                    preload="metadata"
                    className="w-full"
                    src={previewMedia.url}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ) : previewMedia.mediaType === 'IMAGE' ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title}
                  className="max-h-96 w-auto object-contain rounded"
                />
              ) : (
                <div className="p-8 text-center text-white">
                  <div className="text-4xl mb-2">📄</div>
                  <a
                    href={previewMedia.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-emerald-400 underline hover:text-emerald-300"
                  >
                    Open Document in New Tab ↗
                  </a>
                </div>
              )}
            </div>

            {/* Metadata breakdown */}
            <div className="mt-4 space-y-2 text-xs text-stone-600 border-t pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold text-stone-800">File Name:</span> {previewMedia.fileName}
                </div>
                <div>
                  <span className="font-semibold text-stone-800">File Size:</span> {formatFileSize(previewMedia.fileSize)}
                </div>
                <div>
                  <span className="font-semibold text-stone-800">MIME Type:</span> {previewMedia.mimeType}
                </div>
                <div>
                  <span className="font-semibold text-stone-800">Created:</span> {new Date(previewMedia.createdAt).toLocaleDateString()}
                </div>
              </div>
              {previewMedia.description && (
                <div className="mt-2 text-stone-700">
                  <span className="font-semibold text-stone-800">Description:</span> {previewMedia.description}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setPreviewMedia(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Media Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-stone-900">Upload Media Asset</h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Media Type *
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] as MediaType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleMediaTypeChange(t)}
                      className={`rounded border p-2 text-xs font-medium ${
                        mediaType === t
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Asset Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Class Virabhadrasana Alignment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description of this demonstration or guidance asset..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    File Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    MIME Type *
                  </label>
                  <input
                    type="text"
                    required
                    value={mimeType}
                    onChange={(e) => setMimeType(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Asset Storage URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://storage.yogaos.app/... or S3 URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    File Size (bytes) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={fileSize}
                    onChange={(e) => setFileSize(Number(e.target.value))}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                {(mediaType === 'VIDEO' || mediaType === 'AUDIO') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 180"
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Save Asset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
