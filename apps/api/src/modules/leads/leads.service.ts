import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, LeadStatus, LeadSource, StudentStatus } from '@yogaos/database';
import {
  CreateLeadRequest,
  UpdateLeadRequest,
  ConvertLeadRequest,
  LeadListQuery,
  LeadDetails,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class LeadsService {
  constructor(private readonly audit: AuditService) {}

  async getLeads(
    tenantId: string,
    query: LeadListQuery = { page: 1, limit: 20 }
  ): Promise<{ leads: LeadDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status as LeadStatus;
    }

    if (query.source) {
      where.source = query.source as LeadSource;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          branch: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped: LeadDetails[] = leads.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      branchId: l.branchId,
      branchName: l.branch?.name || null,
      fullName: l.fullName,
      phone: l.phone,
      email: l.email,
      source: l.source as any,
      interestedProgram: l.interestedProgram,
      status: l.status as any,
      followUpDate: l.followUpDate ? l.followUpDate.toISOString() : null,
      notes: l.notes,
      convertedStudentId: l.convertedStudentId,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));

    return {
      leads: mapped,
      total,
      page,
      limit,
    };
  }

  async getLead(tenantId: string, leadId: string): Promise<LeadDetails> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        branch: { select: { name: true } },
      },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new NotFoundException('Lead not found');
    }

    return {
      id: lead.id,
      tenantId: lead.tenantId,
      branchId: lead.branchId,
      branchName: lead.branch?.name || null,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      source: lead.source as any,
      interestedProgram: lead.interestedProgram,
      status: lead.status as any,
      followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
      notes: lead.notes,
      convertedStudentId: lead.convertedStudentId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }

  async createLead(
    tenantId: string,
    data: CreateLeadRequest,
    callerUserId: string
  ): Promise<LeadDetails> {
    if (data.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: data.branchId },
      });
      if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
        throw new ForbiddenException('Invalid branch: Target branch does not belong to active organization');
      }
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        branchId: data.branchId ?? null,
        fullName: data.fullName,
        phone: data.phone.trim(),
        email: data.email ? data.email.trim().toLowerCase() : null,
        source: (data.source as LeadSource) || 'WALK_IN',
        interestedProgram: data.interestedProgram ?? null,
        status: (data.status as LeadStatus) || 'NEW',
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        notes: data.notes ?? null,
      },
      include: {
        branch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'LEAD_CREATE',
      resourceType: 'Lead',
      resourceId: lead.id,
      details: { fullName: lead.fullName, source: lead.source },
    });

    return {
      id: lead.id,
      tenantId: lead.tenantId,
      branchId: lead.branchId,
      branchName: lead.branch?.name || null,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      source: lead.source as any,
      interestedProgram: lead.interestedProgram,
      status: lead.status as any,
      followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
      notes: lead.notes,
      convertedStudentId: lead.convertedStudentId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }

  async updateLead(
    tenantId: string,
    leadId: string,
    data: UpdateLeadRequest,
    callerUserId: string
  ): Promise<LeadDetails> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new NotFoundException('Lead not found');
    }

    if (data.branchId && data.branchId !== lead.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: data.branchId },
      });
      if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
        throw new ForbiddenException('Invalid branch');
      }
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        branchId: data.branchId !== undefined ? data.branchId : undefined,
        fullName: data.fullName ?? undefined,
        phone: data.phone ? data.phone.trim() : undefined,
        email: data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : undefined,
        source: data.source ? (data.source as LeadSource) : undefined,
        interestedProgram: data.interestedProgram !== undefined ? data.interestedProgram : undefined,
        status: data.status ? (data.status as LeadStatus) : undefined,
        followUpDate: data.followUpDate !== undefined ? (data.followUpDate ? new Date(data.followUpDate) : null) : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
      include: {
        branch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'LEAD_UPDATE',
      resourceType: 'Lead',
      resourceId: leadId,
      details: data,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      branchName: updated.branch?.name || null,
      fullName: updated.fullName,
      phone: updated.phone,
      email: updated.email,
      source: updated.source as any,
      interestedProgram: updated.interestedProgram,
      status: updated.status as any,
      followUpDate: updated.followUpDate ? updated.followUpDate.toISOString() : null,
      notes: updated.notes,
      convertedStudentId: updated.convertedStudentId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async convertLead(
    tenantId: string,
    leadId: string,
    data: ConvertLeadRequest,
    callerUserId: string
  ): Promise<{ studentId: string; message: string }> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.status === 'CONVERTED' && lead.convertedStudentId) {
      throw new ConflictException('This lead has already been converted to a student');
    }

    // Validate home branch exists in this tenant
    const branch = await prisma.branch.findUnique({
      where: { id: data.homeBranchId },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new ForbiddenException('Invalid home branch ID');
    }

    // Check if a student already exists with this phone or email to prevent duplicate student records
    const existingStudent = await prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { mobilePhone: lead.phone.trim() },
          lead.email ? { email: lead.email.trim().toLowerCase() } : { id: 'no-match' },
        ],
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      let studentId: string;

      if (existingStudent) {
        // Link to existing student without creating duplicate
        studentId = existingStudent.id;
        await tx.studentActivity.create({
          data: {
            tenantId,
            studentId,
            activityType: 'LEAD_CONVERTED',
            title: 'Lead Inquiry Linked',
            description: `Linked converted enquiry from ${lead.source} (${lead.interestedProgram || 'General'})`,
            performedByUserId: callerUserId,
          },
        });
      } else {
        // Create new student
        const newStudent = await tx.student.create({
          data: {
            tenantId,
            homeBranchId: data.homeBranchId,
            fullName: lead.fullName,
            mobilePhone: lead.phone.trim(),
            email: lead.email ? lead.email.trim().toLowerCase() : null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            gender: data.gender ?? null,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
            emergencyContactRelation: data.emergencyContactRelation,
            status: 'ACTIVE' as StudentStatus,
            hasHealthAlert: false,
          },
        });
        studentId = newStudent.id;

        await tx.studentActivity.create({
          data: {
            tenantId,
            studentId,
            activityType: 'LEAD_CONVERTED',
            title: 'Converted from Lead',
            description: `Converted from ${lead.source} enquiry (${lead.interestedProgram || 'General'})`,
            performedByUserId: callerUserId,
          },
        });
      }

      // Update lead to CONVERTED
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'CONVERTED' as LeadStatus,
          convertedStudentId: studentId,
        },
      });

      return {
        studentId,
        message: existingStudent
          ? 'Lead linked to existing matching student profile'
          : 'Lead successfully converted to new student profile',
      };
    });

    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'LEAD_CONVERTED',
      resourceType: 'Lead',
      resourceId: leadId,
      details: { studentId: result.studentId, isExistingStudent: !!existingStudent },
    });

    return result;
  }
}
