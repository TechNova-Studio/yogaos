import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma, MediaType, MediaStatus } from '@yogaos/database';
import {
  CreateMediaAssetInput,
  UpdateMediaAssetInput,
  ReplaceMediaAssetInput,
  MediaListQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  AUDIO: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/webm'],
  DOCUMENT: ['application/pdf'],
};

const MAX_FILE_SIZES: Record<MediaType, number> = {
  IMAGE: 10 * 1024 * 1024,      // 10 MB
  VIDEO: 150 * 1024 * 1024,    // 150 MB
  AUDIO: 50 * 1024 * 1024,      // 50 MB
  DOCUMENT: 20 * 1024 * 1024,   // 20 MB
};

@Injectable()
export class MediaService {
  constructor(private readonly audit: AuditService) {}

  validateMediaFile(mediaType: MediaType, mimeType: string, fileSize: number) {
    const allowedMimes = ALLOWED_MIME_TYPES[mediaType];
    if (!allowedMimes || !allowedMimes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Invalid MIME type '${mimeType}' for media type '${mediaType}'. Allowed: ${allowedMimes?.join(', ')}`
      );
    }

    const maxSize = MAX_FILE_SIZES[mediaType];
    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${(maxSize / (1024 * 1024))}MB for ${mediaType}`
      );
    }
  }

  async listMedia(tenantId: string | null, query: MediaListQuery) {
    const where: any = {
      deletedAt: null,
    };

    if (tenantId) {
      if (query.includeShared !== false) {
        // Include tenant media and shared platform assets (tenantId is null)
        where.OR = [{ tenantId }, { tenantId: null }];
      } else {
        where.tenantId = tenantId;
      }
    } else {
      where.tenantId = null;
    }

    if (!query.includeArchived) {
      where.isArchived = false;
    }

    if (query.mediaType) {
      where.mediaType = query.mediaType as MediaType;
    }

    if (query.mediaStatus) {
      where.mediaStatus = query.mediaStatus as MediaStatus;
    }

    if (query.search) {
      const search = query.search.trim();
      const searchCondition = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];

      if (where.OR) {
        where.AND = [{ OR: searchCondition }];
      } else {
        where.OR = searchCondition;
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedByUser: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMedia(tenantId: string | null, id: string) {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: tenantId ? [{ tenantId }, { tenantId: null }] : [{ tenantId: null }],
      },
      include: {
        uploadedByUser: {
          select: { id: true, fullName: true, email: true },
        },
        primaryAsanas: {
          select: { id: true, englishName: true, sanskritName: true },
        },
      },
    });

    if (!media) {
      throw new NotFoundException(`Media asset with ID ${id} not found`);
    }

    return media;
  }

  async createMedia(
    tenantId: string | null,
    data: CreateMediaAssetInput,
    userId: string
  ) {
    const mediaType = data.mediaType as MediaType;
    this.validateMediaFile(mediaType, data.mimeType, data.fileSize);

    const assetTenantId = data.isSharedReference ? null : tenantId;

    const media = await prisma.mediaAsset.create({
      data: {
        tenantId: assetTenantId,
        uploadedByUserId: userId,
        title: data.title,
        description: data.description,
        mediaType,
        mediaStatus: MediaStatus.READY,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType.toLowerCase(),
        storageKey: data.storageKey,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        durationSeconds: data.durationSeconds,
        sha256Hash: data.sha256Hash,
        metadata: data.metadata ?? {},
      },
      include: {
        uploadedByUser: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      tenantId: assetTenantId,
      userId,
      action: 'MEDIA_ASSET_UPLOADED',
      resourceType: 'MEDIA_ASSET',
      resourceId: media.id,
      details: {
        title: media.title,
        mediaType: media.mediaType,
        fileName: media.fileName,
        fileSize: media.fileSize,
      },
    });

    return media;
  }

  async updateMedia(
    tenantId: string | null,
    id: string,
    data: UpdateMediaAssetInput,
    userId: string
  ) {
    const existing = await this.getMedia(tenantId, id);

    // If tenant-scoped, ensure caller belongs to the owning tenant
    if (existing.tenantId && existing.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot update media from another organization');
    }

    const updated = await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        title: data.title ?? existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        isArchived: data.isArchived !== undefined ? data.isArchived : existing.isArchived,
        mediaStatus: data.isArchived ? MediaStatus.ARCHIVED : existing.mediaStatus,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEDIA_ASSET_UPDATED',
      resourceType: 'MEDIA_ASSET',
      resourceId: updated.id,
      details: {
        title: updated.title,
        isArchived: updated.isArchived,
      },
    });

    return updated;
  }

  async replaceMedia(
    tenantId: string | null,
    id: string,
    data: ReplaceMediaAssetInput,
    userId: string
  ) {
    const existing = await this.getMedia(tenantId, id);

    if (existing.tenantId && existing.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot replace media from another organization');
    }

    this.validateMediaFile(existing.mediaType, data.mimeType, data.fileSize);

    const updated = await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType.toLowerCase(),
        storageKey: data.storageKey,
        url: data.url,
        sha256Hash: data.sha256Hash ?? existing.sha256Hash,
        durationSeconds: data.durationSeconds !== undefined ? data.durationSeconds : existing.durationSeconds,
        mediaStatus: MediaStatus.READY,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEDIA_ASSET_REPLACED',
      resourceType: 'MEDIA_ASSET',
      resourceId: updated.id,
      details: {
        previousStorageKey: existing.storageKey,
        newStorageKey: updated.storageKey,
        newFileSize: updated.fileSize,
      },
    });

    return updated;
  }

  async archiveMedia(tenantId: string | null, id: string, userId: string) {
    const existing = await this.getMedia(tenantId, id);

    if (existing.tenantId && existing.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot archive media from another organization');
    }

    const archived = await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        isArchived: true,
        mediaStatus: MediaStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEDIA_ASSET_ARCHIVED',
      resourceType: 'MEDIA_ASSET',
      resourceId: archived.id,
      details: {
        title: archived.title,
        fileName: archived.fileName,
      },
    });

    return { success: true, archived: true };
  }
}
