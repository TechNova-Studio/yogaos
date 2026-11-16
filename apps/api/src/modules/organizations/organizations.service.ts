import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@yogaos/database';
import {
  CreateOrganizationRequest,
  OrganizationDetails,
  MembershipSummary,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly audit: AuditService) {}

  async createOrganization(
    userId: string,
    data: CreateOrganizationRequest,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<OrganizationDetails & { membership: MembershipSummary }> {
    const existing = await prisma.organization.findUnique({
      where: { slug: data.slug.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`Organization with slug "${data.slug}" already exists`);
    }

    const { organization, member } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug.toLowerCase(),
          legalEntityName: data.legalEntityName || null,
          currency: data.currency,
          timezone: data.timezone,
        },
      });

      const membership = await tx.organizationMember.create({
        data: {
          tenantId: org.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        include: {
          organization: true,
        },
      });

      return { organization: org, member: membership };
    });

    await this.audit.log({
      userId,
      tenantId: organization.id,
      action: 'ORG_CREATE',
      resourceType: 'Organization',
      resourceId: organization.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { name: organization.name, slug: organization.slug },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      legalEntityName: organization.legalEntityName,
      currency: organization.currency,
      timezone: organization.timezone,
      isGstRegistered: organization.isGstRegistered,
      gstin: organization.gstin,
      createdAt: organization.createdAt.toISOString(),
      membership: {
        id: member.id,
        tenantId: member.tenantId,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: member.role as any,
        status: member.status as any,
      },
    };
  }

  async getUserOrganizations(userId: string): Promise<MembershipSummary[]> {
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        organization: {
          deletedAt: null,
        },
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      organizationName: m.organization.name,
      organizationSlug: m.organization.slug,
      role: m.role as any,
      status: m.status as any,
    }));
  }

  async getOrganizationById(tenantId: string): Promise<any> {
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      legalEntityName: org.legalEntityName,
      currency: org.currency,
      timezone: org.timezone,
      isGstRegistered: org.isGstRegistered,
      gstin: org.gstin,
      panNumber: org.panNumber,
      billingAddress: org.billingAddress,
      settings: org.settings,
      createdAt: org.createdAt.toISOString(),
    };
  }

  async updateOrganizationSettings(
    tenantId: string,
    data: any,
    userId: string
  ): Promise<any> {
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await prisma.organization.update({
      where: { id: tenantId },
      data: {
        name: data.name ?? undefined,
        legalEntityName: data.legalEntityName !== undefined ? data.legalEntityName : undefined,
        currency: data.currency ?? undefined,
        timezone: data.timezone ?? undefined,
        isGstRegistered: data.isGstRegistered !== undefined ? data.isGstRegistered : undefined,
        gstin: data.gstin !== undefined ? data.gstin : undefined,
        panNumber: data.panNumber !== undefined ? data.panNumber : undefined,
        billingAddress: data.billingAddress !== undefined ? data.billingAddress : undefined,
        settings: data.settings !== undefined ? data.settings : undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ORG_SETTINGS_UPDATED',
      resourceType: 'Organization',
      resourceId: tenantId,
      details: data,
    });

    return this.getOrganizationById(tenantId);
  }
}
