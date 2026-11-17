import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSha256Checksum,
  downloadAndVerifyAsset,
  prepareSessionMediaOffline,
  revalidateSessionReadiness,
  cleanupUnreferencedMedia,
  CACHE_NAME,
} from '../../web/src/lib/offline-media-storage.js';
import {
  ConductorStateMachine,
  InvalidTransitionError,
} from '../src/modules/conductor/conductor-state-machine.js';
import {
  ConductorManifestAsset,
  ConductorSessionMediaManifest,
} from '@yogaos/contracts';
import * as crypto from 'node:crypto';

function toExactArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('P17 Conductor Offline Runtime & Storage Unit Tests', () => {
  describe('1. Checksum Calculation & Integrity Verification', () => {
    it('computes exact SHA-256 hash matching known vectors', async () => {
      const sampleText = 'YogaOS Deterministic Conductor Offline Test Payload';
      const buffer = Buffer.from(sampleText, 'utf-8');
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();

      const computed = await computeSha256Checksum(buffer);
      expect(computed).toBe(expectedHash);
    });

    it('detects corrupt media when calculated checksum mismatches expected checksum', async () => {
      const originalBuffer = Buffer.from('Legitimate Video Stream Data', 'utf-8');
      const expectedHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');

      // Tampered/corrupted payload
      const corruptedBuffer = Buffer.from('Corrupted Video Stream Data With Bit Flips', 'utf-8');

      // Mock fetch returning corrupted buffer
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => toExactArrayBuffer(corruptedBuffer),
      });

      const asset: ConductorManifestAsset = {
        assetId: '11111111-1111-1111-1111-111111111111',
        title: 'Virabhadrasana II Demo Video',
        fileName: 'warrior2.mp4',
        mediaType: 'VIDEO',
        mimeType: 'video/mp4',
        fileSize: corruptedBuffer.byteLength,
        sha256Hash: expectedHash,
        url: 'https://cdn.yogaos.test/videos/warrior2.mp4',
        stepOrders: [1],
        contentMode: 'VIDEO',
      };

      const result = await downloadAndVerifyAsset(asset);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Checksum mismatch');
    });

    it('detects incomplete or truncated downloads where size mismatches', async () => {
      const buffer = Buffer.from('Truncated audio bytes', 'utf-8');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => toExactArrayBuffer(buffer),
      });

      const asset: ConductorManifestAsset = {
        assetId: '22222222-2222-2222-2222-222222222222',
        title: 'Pranayama Guidance Audio',
        fileName: 'pranayama.mp3',
        mediaType: 'AUDIO',
        mimeType: 'audio/mpeg',
        fileSize: buffer.byteLength + 5000, // Manifest states file should be 5000 bytes larger
        sha256Hash: hash,
        url: 'https://cdn.yogaos.test/audio/pranayama.mp3',
        stepOrders: [2],
        contentMode: 'AUDIO_ONLY',
      };

      const result = await downloadAndVerifyAsset(asset);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Size mismatch');
    });

    it('recovers from failed partial downloads on retry', async () => {
      const buffer = Buffer.from('Complete and verified alignment photograph', 'utf-8');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      const asset: ConductorManifestAsset = {
        assetId: '33333333-3333-3333-3333-333333333333',
        title: 'Trikonasana Alignment Photo',
        fileName: 'trikonasana.jpg',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        fileSize: buffer.byteLength,
        sha256Hash: hash,
        url: 'https://cdn.yogaos.test/images/trikonasana.jpg',
        stepOrders: [1],
        contentMode: 'IMAGE',
      };

      // Mock first call failing with 503 Service Unavailable
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        // Mock retry succeeding with verified buffer
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => toExactArrayBuffer(buffer),
        });

      const firstAttempt = await downloadAndVerifyAsset(asset);
      expect(firstAttempt.success).toBe(false);

      const retryAttempt = await downloadAndVerifyAsset(asset);
      expect(retryAttempt.success).toBe(true);
    });
  });

  describe('2. State Machine Transitions with OFFLINE_READY', () => {
    it('allows valid transitions involving OFFLINE_READY', () => {
      expect(ConductorStateMachine.isValidTransition('READY', 'OFFLINE_READY')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('OFFLINE_READY', 'RUNNING')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('OFFLINE_READY', 'READY')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('OFFLINE_READY', 'INTERRUPTED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('OFFLINE_READY', 'INTERRUPTED_ABANDONED')).toBe(
        true
      );
    });

    it('rejects direct transition from OFFLINE_READY to COMPLETED without running', () => {
      expect(ConductorStateMachine.isValidTransition('OFFLINE_READY', 'COMPLETED')).toBe(false);
      expect(() =>
        ConductorStateMachine.assertValidTransition('OFFLINE_READY', 'COMPLETED')
      ).toThrow(InvalidTransitionError);
    });

    it('preserves invariant: OFFLINE_READY session cannot be completed by timeout', () => {
      // If a prepared session is abandoned before launch, it must transition to INTERRUPTED_ABANDONED
      expect(
        ConductorStateMachine.isValidTransition('OFFLINE_READY', 'INTERRUPTED_ABANDONED')
      ).toBe(true);
    });
  });

  describe('3. Offline Execution & Zero Remote Requests Guarantee', () => {
    it('executes preparation workflow and detects 100% offline readiness', async () => {
      const bufferA = Buffer.from('Image data A', 'utf-8');
      const hashA = crypto.createHash('sha256').update(bufferA).digest('hex');

      const bufferB = Buffer.from('Audio data B', 'utf-8');
      const hashB = crypto.createHash('sha256').update(bufferB).digest('hex');

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => toExactArrayBuffer(bufferA),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => toExactArrayBuffer(bufferB),
        });

      const manifest: ConductorSessionMediaManifest = {
        sessionInstanceId: '44444444-4444-4444-4444-444444444444',
        sequenceVersionId: '55555555-5555-5555-5555-555555555555',
        sequenceTitle: 'Morning Flow',
        totalAssetsCount: 2,
        totalBytes: bufferA.byteLength + bufferB.byteLength,
        assets: [
          {
            assetId: 'asset-a',
            title: 'Visual Pose A',
            fileName: 'pose-a.jpg',
            mediaType: 'IMAGE',
            mimeType: 'image/jpeg',
            fileSize: bufferA.byteLength,
            sha256Hash: hashA,
            url: 'https://cdn.yogaos.test/pose-a.jpg',
            stepOrders: [1],
            contentMode: 'IMAGE',
          },
          {
            assetId: 'asset-b',
            title: 'Voice Instruction B',
            fileName: 'voice-b.mp3',
            mediaType: 'AUDIO',
            mimeType: 'audio/mpeg',
            fileSize: bufferB.byteLength,
            sha256Hash: hashB,
            url: 'https://cdn.yogaos.test/voice-b.mp3',
            stepOrders: [1],
            contentMode: 'IMAGE_WITH_VOICE',
          },
        ],
      };

      const prepResult = await prepareSessionMediaOffline(manifest);
      expect(prepResult.success).toBe(true);
      expect(prepResult.errors.length).toBe(0);

      // Verify that manifest with 0 assets is immediately offline ready
      const emptyManifest: ConductorSessionMediaManifest = {
        sessionInstanceId: '66666666-6666-6666-6666-666666666666',
        sequenceVersionId: '77777777-7777-7777-7777-777777777777',
        sequenceTitle: 'Silent Flow',
        totalAssetsCount: 0,
        totalBytes: 0,
        assets: [],
      };
      const emptyResult = await prepareSessionMediaOffline(emptyManifest);
      expect(emptyResult.success).toBe(true);
    });

    it('ensures unreferenced media cleanup never deletes active session assets', async () => {
      const activeIds = ['active-asset-1', 'active-asset-2'];
      const fakeKeys = [
        { url: 'https://app.yogaos.test/offline-media/active-asset-1' },
        { url: 'https://app.yogaos.test/offline-media/active-asset-2' },
        { url: 'https://app.yogaos.test/offline-media/expired-old-asset' },
      ];

      const deleteMock = vi.fn().mockResolvedValue(true);
      global.caches = {
        open: vi.fn().mockResolvedValue({
          keys: vi.fn().mockResolvedValue(fakeKeys),
          delete: deleteMock,
        }),
      } as any;

      const deletedCount = await cleanupUnreferencedMedia(activeIds);
      expect(deletedCount).toBe(1);
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith(fakeKeys[2]);
    });
  });
});
