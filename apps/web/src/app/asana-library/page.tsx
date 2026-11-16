'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@yogaos/ui';
import type { AsanaCategory, AsanaDifficulty } from '@yogaos/contracts';

const CATEGORIES: { label: string; value: AsanaCategory | '' }[] = [
  { label: 'All Categories', value: '' },
  { label: 'Standing', value: 'STANDING' },
  { label: 'Seated', value: 'SEATED' },
  { label: 'Prone', value: 'PRONE' },
  { label: 'Supine', value: 'SUPINE' },
  { label: 'Inversion', value: 'INVERSION' },
  { label: 'Backbend', value: 'BACKBEND' },
  { label: 'Forward Bend', value: 'FORWARD_BEND' },
  { label: 'Twist', value: 'TWIST' },
  { label: 'Arm Balance', value: 'ARM_BALANCE' },
  { label: 'Restorative', value: 'RESTORATIVE' },
  { label: 'Pranayama', value: 'PRANAYAMA' },
  { label: 'Meditation', value: 'MEDITATION' },
];

const DIFFICULTIES: { label: string; value: AsanaDifficulty | '' }[] = [
  { label: 'All Levels', value: '' },
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Intermediate', value: 'INTERMEDIATE' },
  { label: 'Advanced', value: 'ADVANCED' },
];

export default function AsanaLibraryPage() {
  const { activeTenantId, activeRole, token } = useAuth();
  const [asanas, setAsanas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AsanaCategory | ''>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<AsanaDifficulty | ''>('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'custom' | 'shared'>('all');

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Asana Form
  const [sanskritName, setSanskritName] = useState('');
  const [sanskritNameIast, setSanskritNameIast] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [commonName, setCommonName] = useState('');
  const [category, setCategory] = useState<AsanaCategory>('STANDING');
  const [difficulty, setDifficulty] = useState<AsanaDifficulty>('BEGINNER');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [alignmentCues, setAlignmentCues] = useState('');
  const [anatomicalFocus, setAnatomicalFocus] = useState('');
  const [benefits, setBenefits] = useState('');
  const [contraindications, setContraindications] = useState('');
  const [cautions, setCautions] = useState('');
  const [tags, setTags] = useState('');

  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INSTRUCTOR';

  const fetchAsanas = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      const res = await client.getAsanas({
        search: search || undefined,
        category: selectedCategory || undefined,
        difficulty: selectedDifficulty || undefined,
        onlyCustom: scopeFilter === 'custom' ? true : undefined,
        includeShared: scopeFilter !== 'custom',
        limit: 100,
      });

      if (res && res.data && Array.isArray(res.data.items)) {
        setAsanas(res.data.items);
      } else if (res && Array.isArray(res.items)) {
        setAsanas(res.items);
      } else {
        setAsanas([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load asana library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsanas();
  }, [token, activeTenantId, search, selectedCategory, selectedDifficulty, scopeFilter]);

  const handleSeed = async () => {
    if (!token) return;
    setError(null);
    setActionSuccess(null);
    try {
      const client = getApiClient();
      client.setAuthToken(token);
      if (activeTenantId) client.setTenantId(activeTenantId);
      await client.seedClassicalAsanas();
      setActionSuccess('Classical reference postures loaded successfully!');
      fetchAsanas();
    } catch (err: any) {
      setError(err?.message || 'Failed to seed classical poses');
    }
  };

  const handleCreateAsana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) {
      setError('Active studio context required to create custom postures.');
      return;
    }
    setCreating(true);
    setError(null);
    setActionSuccess(null);

    try {
      const client = getApiClient();
      client.setAuthToken(token);
      client.setTenantId(activeTenantId);
      await client.createAsana({
        sanskritName,
        sanskritNameIast: sanskritNameIast || undefined,
        englishName,
        commonName: commonName || undefined,
        category,
        difficulty,
        description: description || undefined,
        instructions: instructions || undefined,
        alignmentCues: alignmentCues || undefined,
        anatomicalFocus: anatomicalFocus ? anatomicalFocus.split(',').map((s) => s.trim()).filter(Boolean) : [],
        benefits: benefits ? benefits.split(',').map((s) => s.trim()).filter(Boolean) : [],
        contraindications: contraindications ? contraindications.split(',').map((s) => s.trim()).filter(Boolean) : [],
        cautions: cautions || undefined,
        tags: tags ? tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });

      setActionSuccess(`Custom posture "${englishName}" created successfully!`);
      setShowCreateModal(false);
      // Reset form
      setSanskritName('');
      setSanskritNameIast('');
      setEnglishName('');
      setCommonName('');
      setDescription('');
      setInstructions('');
      setAlignmentCues('');
      setAnatomicalFocus('');
      setBenefits('');
      setContraindications('');
      setCautions('');
      setTags('');
      fetchAsanas();
    } catch (err: any) {
      setError(err?.message || 'Failed to create posture');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Asana Library</h1>
          <p className="mt-1 text-sm text-stone-500">
            Structured yoga posture repository with classical Sanskrit terminology, alignment cues, anatomical focus, and media demonstrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <>
              <Button variant="outline" onClick={handleSeed}>
                Load Classical Poses
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                Add Custom Asana
              </Button>
            </>
          )}
        </div>
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
            placeholder="Search posture (Sanskrit, IAST, English, tags)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as AsanaCategory | '')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.label} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value as AsanaDifficulty | '')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.label} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as 'all' | 'custom' | 'shared')}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">All Library (Shared + Custom)</option>
          <option value="custom">Studio Custom Only</option>
          <option value="shared">YogaOS Reference Catalog Only</option>
        </select>
      </div>

      {/* Postures Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-stone-500">Loading asanas...</div>
        ) : asanas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 py-16 text-center">
            <h3 className="text-base font-semibold text-stone-800">No asanas found</h3>
            <p className="mt-1 text-sm text-stone-500">
              Try adjusting your search filters or click "Load Classical Poses" to initialize the YogaOS reference catalog.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {asanas.map((pose) => (
              <Card key={pose.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {pose.sanskritNameIast || pose.sanskritName}
                      </div>
                      <CardTitle className="text-lg font-bold text-stone-900 mt-0.5">
                        {pose.englishName}
                      </CardTitle>
                      {pose.sanskritName && (
                        <div className="text-xs text-stone-500 font-serif mt-0.5">
                          {pose.sanskritName}
                        </div>
                      )}
                    </div>
                    <Badge variant={pose.isSharedReference ? 'outline' : 'default'}>
                      {pose.isSharedReference ? 'Reference' : 'Studio Custom'}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2 text-xs text-stone-600">
                    {pose.description || 'No posture summary provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <Badge variant="outline" className="text-xs">
                      {pose.category}
                    </Badge>
                    <Badge
                      variant={
                        pose.difficulty === 'ADVANCED'
                          ? 'destructive'
                          : pose.difficulty === 'INTERMEDIATE'
                          ? 'outline'
                          : 'success'
                      }
                      className="text-xs"
                    >
                      {pose.difficulty}
                    </Badge>
                  </div>

                  {pose.anatomicalFocus && pose.anatomicalFocus.length > 0 && (
                    <div className="text-xs text-stone-500 mb-4">
                      <span className="font-medium text-stone-700">Focus:</span> {pose.anatomicalFocus.slice(0, 3).join(', ')}
                    </div>
                  )}

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-xs text-stone-400">
                      {pose.mediaList?.length ? `${pose.mediaList.length} media attached` : 'No media'}
                    </span>
                    <Link href={`/asana-library/${pose.id}`}>
                      <Button variant="outline" size="sm">
                        View Details →
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Custom Asana Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-stone-900">Add Custom Asana</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAsana} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Sanskrit Name (Devanagari/Vernacular) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ताड़ासन"
                    value={sanskritName}
                    onChange={(e) => setSanskritName(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    IAST Transliteration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tāḍāsana"
                    value={sanskritNameIast}
                    onChange={(e) => setSanskritNameIast(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    English Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mountain Pose"
                    value={englishName}
                    onChange={(e) => setEnglishName(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Common / Vernacular Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Samasthiti"
                    value={commonName}
                    onChange={(e) => setCommonName(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AsanaCategory)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c.value !== '').map((c) => (
                      <option key={c.label} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Difficulty Level *
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as AsanaDifficulty)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {DIFFICULTIES.filter((d) => d.value !== '').map((d) => (
                      <option key={d.label} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Description / Essence
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of the posture and intentional foundation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Step-by-Step Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Step-by-step entry and setup..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Key Alignment Cues
                </label>
                <textarea
                  rows={2}
                  placeholder="Essential micro-adjustments and internal cues..."
                  value={alignmentCues}
                  onChange={(e) => setAlignmentCues(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Anatomical Focus (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spine, Pelvis, Ankles"
                    value={anatomicalFocus}
                    onChange={(e) => setAnatomicalFocus(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Benefits (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Improves posture, Strengthens thighs"
                    value={benefits}
                    onChange={(e) => setBenefits(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Contraindications (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vertigo, Acute headache"
                    value={contraindications}
                    onChange={(e) => setContraindications(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Cautions & Disclaimers
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Practice near a wall if balance is unsteady"
                    value={cautions}
                    onChange={(e) => setCautions(e.target.value)}
                    className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. standing, foundational, balance, morning"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full rounded border border-stone-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Saving...' : 'Create Asana'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
