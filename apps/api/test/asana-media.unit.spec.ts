import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from '../src/modules/media/media.service.js';
import { CreateAsanaSchema, CreateMediaAssetSchema } from '@yogaos/contracts';
import { MediaType } from '@yogaos/database';

describe('P14 Asana & Media Management Unit Tests', () => {
  const dummyAuditService = { log: () => Promise.resolve() } as any;
  const mediaService = new MediaService(dummyAuditService);

  describe('Media File Validation', () => {
    it('accepts valid IMAGE mime types within size limit', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'image/jpeg', 2 * 1024 * 1024);
      }).not.toThrow();

      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'image/png', 5 * 1024 * 1024);
      }).not.toThrow();

      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'image/webp', 1024 * 1024);
      }).not.toThrow();
    });

    it('rejects disallowed IMAGE mime types', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'image/svg+xml', 1024 * 1024);
      }).toThrow(BadRequestException);

      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'application/octet-stream', 1024 * 1024);
      }).toThrow(BadRequestException);
    });

    it('rejects oversized IMAGE files (> 10MB)', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.IMAGE, 'image/jpeg', 11 * 1024 * 1024);
      }).toThrow(BadRequestException);
    });

    it('accepts valid VIDEO mime types within size limit', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.VIDEO, 'video/mp4', 50 * 1024 * 1024);
      }).not.toThrow();

      expect(() => {
        mediaService.validateMediaFile(MediaType.VIDEO, 'video/webm', 100 * 1024 * 1024);
      }).not.toThrow();
    });

    it('rejects oversized VIDEO files (> 150MB)', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.VIDEO, 'video/mp4', 160 * 1024 * 1024);
      }).toThrow(BadRequestException);
    });

    it('accepts valid AUDIO mime types within size limit', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.AUDIO, 'audio/mpeg', 15 * 1024 * 1024);
      }).not.toThrow();

      expect(() => {
        mediaService.validateMediaFile(MediaType.AUDIO, 'audio/wav', 30 * 1024 * 1024);
      }).not.toThrow();
    });

    it('rejects oversized AUDIO files (> 50MB)', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.AUDIO, 'audio/mpeg', 55 * 1024 * 1024);
      }).toThrow(BadRequestException);
    });

    it('accepts valid DOCUMENT mime types (PDF)', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.DOCUMENT, 'application/pdf', 5 * 1024 * 1024);
      }).not.toThrow();
    });

    it('rejects non-PDF documents', () => {
      expect(() => {
        mediaService.validateMediaFile(MediaType.DOCUMENT, 'text/plain', 1024);
      }).toThrow(BadRequestException);

      expect(() => {
        mediaService.validateMediaFile(MediaType.DOCUMENT, 'application/msword', 1024 * 1024);
      }).toThrow(BadRequestException);
    });
  });

  describe('Contract Schema Validations', () => {
    it('validates a complete, valid Asana creation contract', () => {
      const validPayload = {
        sanskritName: 'ताड़ासन',
        sanskritNameIast: 'Tāḍāsana',
        englishName: 'Mountain Pose',
        commonName: 'Samasthiti',
        description: 'Foundational standing posture',
        instructions: 'Stand tall with big toes touching',
        alignmentCues: 'Root feet down, lift kneecaps, relax shoulders',
        category: 'STANDING',
        difficulty: 'BEGINNER',
        anatomicalFocus: ['Spine', 'Thighs', 'Ankles'],
        benefits: ['Improves posture', 'Strengthens thighs'],
        contraindications: ['Headache', 'Insomnia'],
        tags: ['foundational', 'standing'],
      };

      const parsed = CreateAsanaSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.category).toBe('STANDING');
        expect(parsed.data.difficulty).toBe('BEGINNER');
      }
    });

    it('rejects invalid Asana categories', () => {
      const invalidCategoryPayload = {
        sanskritName: 'ताड़ासन',
        englishName: 'Mountain Pose',
        category: 'AERIAL_DANCE', // Invalid
      };

      const parsed = CreateAsanaSchema.safeParse(invalidCategoryPayload);
      expect(parsed.success).toBe(false);
    });

    it('validates a complete Media Asset creation contract', () => {
      const validMediaPayload = {
        title: 'Masterclass Flow Demo',
        description: 'Vinyasa sequence guidance',
        mediaType: 'VIDEO',
        fileName: 'vinyasa-flow.mp4',
        fileSize: 45000000,
        mimeType: 'video/mp4',
        url: 'https://storage.yogaos.app/videos/flow.mp4',
        storageKey: 'studios/tenant-1/videos/flow.mp4',
        durationSeconds: 900,
      };

      const parsed = CreateMediaAssetSchema.safeParse(validMediaPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.mediaType).toBe('VIDEO');
        expect(parsed.data.durationSeconds).toBe(900);
      }
    });

    it('rejects media asset with empty or invalid URL/storageKey', () => {
      const invalidMediaPayload = {
        title: 'Test',
        mediaType: 'IMAGE',
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        url: '', // Empty
        storageKey: '', // Empty
      };

      const parsed = CreateMediaAssetSchema.safeParse(invalidMediaPayload);
      expect(parsed.success).toBe(false);
    });
  });
});
