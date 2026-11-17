import {
  ConductorManifestAsset,
  ConductorSessionMediaManifest,
} from '@yogaos/contracts';

export const CACHE_NAME = 'yogaos-conductor-cache-v1';
export const IDB_NAME = 'yogaos-conductor-idb';
export const IDB_STORE = 'asset-metadata';

export interface StorageQuotaInfo {
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  percentUsed: number;
}

export interface AssetDownloadStatus {
  assetId: string;
  status: 'PENDING' | 'DOWNLOADING' | 'VERIFYING' | 'READY' | 'FAILED';
  progressPercent: number;
  error?: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

export interface SessionPreparationProgress {
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  overallPercent: number;
  assetStatuses: Record<string, AssetDownloadStatus>;
  isComplete: boolean;
  isOfflineReady: boolean;
  errors: string[];
}

/**
 * Computes hexadecimal SHA-256 checksum of an ArrayBuffer.
 */
export async function computeSha256Checksum(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  // Fallback for Node.js test environments if crypto.subtle is unavailable
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex').toLowerCase();
  } catch {
    throw new Error('No crypto implementation available for SHA-256 calculation');
  }
}

/**
 * Gets storage quota estimate from the browser.
 */
export async function getStorageQuotaEstimate(): Promise<StorageQuotaInfo> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 1024 * 1024 * 1024; // 1GB default
      const usage = estimate.usage || 0;
      const available = Math.max(0, quota - usage);
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return {
        quotaBytes: quota,
        usageBytes: usage,
        availableBytes: available,
        percentUsed,
      };
    } catch {
      // Fallback
    }
  }

  // Sensible default: 2GB quota, 0 usage
  const defaultQuota = 2 * 1024 * 1024 * 1024;
  return {
    quotaBytes: defaultQuota,
    usageBytes: 0,
    availableBytes: defaultQuota,
    percentUsed: 0,
  };
}

/**
 * Generates cache key for a media asset.
 */
export function getAssetCacheKey(assetId: string): string {
  return `/offline-media/${assetId}`;
}

/**
 * Downloads a media asset, verifies checksum & size, and stores it in the Cache API.
 */
export async function downloadAndVerifyAsset(
  asset: ConductorManifestAsset,
  onProgress?: (progressPercent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    if (onProgress) onProgress(10);

    // Fetch the asset
    const response = await fetch(asset.url);
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status} failed to download asset '${asset.title}'`,
      };
    }

    if (onProgress) onProgress(50);
    const buffer = await response.arrayBuffer();

    // 1. Verify size
    if (asset.fileSize > 0 && buffer.byteLength !== asset.fileSize) {
      return {
        success: false,
        error: `Size mismatch for '${asset.title}': expected ${asset.fileSize} bytes, received ${buffer.byteLength} bytes`,
      };
    }

    if (onProgress) onProgress(75);

    // 2. Verify SHA-256 Checksum
    const calculatedHash = await computeSha256Checksum(buffer);
    if (calculatedHash.toLowerCase() !== asset.sha256Hash.toLowerCase()) {
      return {
        success: false,
        error: `Checksum mismatch for '${asset.title}': expected ${asset.sha256Hash.slice(0, 12)}..., received ${calculatedHash.slice(0, 12)}...`,
      };
    }

    // 3. Store in Cache API
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = getAssetCacheKey(asset.assetId);
      const cachedResponse = new Response(buffer, {
        headers: {
          'Content-Type': asset.mimeType,
          'Content-Length': String(buffer.byteLength),
          'X-YogaOS-Asset-Id': asset.assetId,
          'X-YogaOS-Checksum': calculatedHash,
        },
      });
      await cache.put(cacheKey, cachedResponse);
    }

    if (onProgress) onProgress(100);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || `Unexpected error downloading asset '${asset.title}'`,
    };
  }
}

/**
 * Verifies if an asset is already in local cache and passes integrity check.
 */
export async function verifyAssetInCache(asset: ConductorManifestAsset): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getAssetCacheKey(asset.assetId);
    const matched = await cache.match(cacheKey);
    if (!matched) return false;

    const buffer = await matched.arrayBuffer();
    if (asset.fileSize > 0 && buffer.byteLength !== asset.fileSize) {
      return false;
    }

    const calculatedHash = await computeSha256Checksum(buffer);
    return calculatedHash.toLowerCase() === asset.sha256Hash.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Retrieves a local Blob URL for a cached asset.
 * Guarantees zero remote network requests during offline playback.
 */
export async function getLocalMediaBlobUrl(assetId: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getAssetCacheKey(assetId);
    const response = await cache.match(cacheKey);
    if (!response) return null;

    const blob = await response.blob();
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Downloads and prepares all assets in a media manifest.
 */
export async function prepareSessionMediaOffline(
  manifest: ConductorSessionMediaManifest,
  onProgressUpdate?: (progress: SessionPreparationProgress) => void
): Promise<{ success: boolean; errors: string[] }> {
  const assetStatuses: Record<string, AssetDownloadStatus> = {};
  const errors: string[] = [];

  manifest.assets.forEach((a) => {
    assetStatuses[a.assetId] = {
      assetId: a.assetId,
      status: 'PENDING',
      progressPercent: 0,
      totalBytes: a.fileSize,
    };
  });

  const notify = () => {
    const completed = Object.values(assetStatuses).filter((s) => s.status === 'READY').length;
    const failed = Object.values(assetStatuses).filter((s) => s.status === 'FAILED').length;
    const overall = manifest.assets.length > 0 ? Math.round((completed / manifest.assets.length) * 100) : 100;
    const isComplete = completed + failed === manifest.assets.length;
    const isOfflineReady = completed === manifest.assets.length;

    if (onProgressUpdate) {
      onProgressUpdate({
        totalAssets: manifest.assets.length,
        completedAssets: completed,
        failedAssets: failed,
        overallPercent: overall,
        assetStatuses: { ...assetStatuses },
        isComplete,
        isOfflineReady,
        errors,
      });
    }
  };

  notify();

  // If manifest has 0 assets, it is immediately offline ready!
  if (manifest.assets.length === 0) {
    notify();
    return { success: true, errors: [] };
  }

  // Process assets in parallel or sequential chunks (up to 3 concurrent)
  for (const asset of manifest.assets) {
    assetStatuses[asset.assetId].status = 'DOWNLOADING';
    notify();

    // Check if already cached and verified
    const alreadyValid = await verifyAssetInCache(asset);
    if (alreadyValid) {
      assetStatuses[asset.assetId].status = 'READY';
      assetStatuses[asset.assetId].progressPercent = 100;
      notify();
      continue;
    }

    const result = await downloadAndVerifyAsset(asset, (pct) => {
      assetStatuses[asset.assetId].progressPercent = pct;
      notify();
    });

    if (result.success) {
      assetStatuses[asset.assetId].status = 'READY';
      assetStatuses[asset.assetId].progressPercent = 100;
    } else {
      assetStatuses[asset.assetId].status = 'FAILED';
      assetStatuses[asset.assetId].error = result.error;
      errors.push(result.error || `Failed asset ${asset.assetId}`);
    }
    notify();
  }

  const allSuccess = Object.values(assetStatuses).every((s) => s.status === 'READY');
  return {
    success: allSuccess,
    errors,
  };
}

/**
 * Re-validates that all required manifest assets are currently available in the local cache.
 */
export async function revalidateSessionReadiness(
  manifest: ConductorSessionMediaManifest
): Promise<{ isReady: boolean; missingAssetIds: string[] }> {
  if (manifest.assets.length === 0) {
    return { isReady: true, missingAssetIds: [] };
  }

  const missingAssetIds: string[] = [];
  for (const asset of manifest.assets) {
    const valid = await verifyAssetInCache(asset);
    if (!valid) {
      missingAssetIds.push(asset.assetId);
    }
  }

  return {
    isReady: missingAssetIds.length === 0,
    missingAssetIds,
  };
}

/**
 * Safely cleans up cached assets not referenced by active or upcoming sessions.
 * Never deletes assets belonging to `activeAssetIds`.
 */
export async function cleanupUnreferencedMedia(activeAssetIds: string[]): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let deletedCount = 0;

    const keepKeys = new Set(activeAssetIds.map((id) => getAssetCacheKey(id)));

    for (const request of keys) {
      const url = new URL(request.url);
      const pathname = url.pathname;
      if (pathname.startsWith('/offline-media/')) {
        if (!keepKeys.has(pathname)) {
          await cache.delete(request);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch {
    return 0;
  }
}
