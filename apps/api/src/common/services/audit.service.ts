import { Injectable } from '@nestjs/common';
import { prisma } from '@yogaos/database';
import { getLogger } from '@yogaos/logger';

const logger = getLogger('AuditService');

export interface LogAuditEventParams {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  async log(params: LogAuditEventParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: params.tenantId || null,
          userId: params.userId || null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
        },
      });

      logger.info(
        {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
        },
        `Security Audit: ${params.action}`
      );
    } catch (err) {
      // Never let audit log failure crash the primary business transaction
      logger.error({ err, action: params.action }, 'Failed to record audit log');
    }
  }
}
