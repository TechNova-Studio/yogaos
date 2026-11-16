import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, StudentStatus, UserRole } from '@yogaos/database';
import {
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentListQuery,
  StudentSummary,
  StudentDetails,
  StudentHealthDisclaimerInput,
  StudentConsentInput,
  StudentActivityDetails,
  CreateStudentNoteRequest,
} from '@yogaos/contracts';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class StudentsService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async getStudents(
    tenantId: string,
    query: StudentListQuery = { page: 1, limit: 20 }
  ): Promise<{ students: StudentSummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.branchId) {
      where.homeBranchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status as StudentStatus;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobilePhone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          homeBranch: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped: StudentSummary[] = students.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      homeBranchId: s.homeBranchId,
      homeBranchName: s.homeBranch.name,
      fullName: s.fullName,
      mobilePhone: s.mobilePhone,
      email: s.email,
      status: s.status as any,
      hasHealthAlert: s.hasHealthAlert,
      cautionBadge: s.hasHealthAlert ? 'Physical Restriction Flagged' : undefined,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      students: mapped,
      total,
      page,
      limit,
    };
  }

  async getStudent(
    tenantId: string,
    studentId: string,
    callerRole: string,
    callerUserId: string
  ): Promise<StudentDetails> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        homeBranch: {
          select: { name: true },
        },
        healthDisclaimer: true,
        consents: {
          orderBy: { agreedAt: 'desc' },
        },
      },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    // Role-based privacy redaction
    const isFrontDesk = callerRole === 'RECEPTIONIST';
    let healthDisclaimerDetails: any = null;

    if (student.healthDisclaimer) {
      if (isFrontDesk) {
        // Front desk sees only non-clinical caution badge. Detailed text is completely stripped.
        healthDisclaimerDetails = null;
      } else {
        // Authorized roles: OWNER, MANAGER, INSTRUCTOR
        // Decrypt sensitive narrative
        try {
          const decryptedNotes = this.crypto.decryptAesGcm(
            student.healthDisclaimer.healthNotesCiphertext,
            student.healthDisclaimer.healthNotesIv,
            student.healthDisclaimer.healthNotesTag,
            student.tenantId // AAD
          );

          healthDisclaimerDetails = {
            id: student.healthDisclaimer.id,
            injurySummary: student.healthDisclaimer.injurySummary,
            healthNotes: decryptedNotes,
            hasPregnancyAlert: student.healthDisclaimer.hasPregnancyAlert,
            consentSigned: student.healthDisclaimer.consentSigned,
            consentTimestamp: student.healthDisclaimer.consentTimestamp.toISOString(),
            updatedAt: student.healthDisclaimer.updatedAt.toISOString(),
          };

          // Audit log sensitive health data access without recording sensitive text in logs
          await this.audit.log({
            tenantId,
            userId: callerUserId,
            action: 'STUDENT_HEALTH_ACCESSED',
            resourceType: 'StudentHealthDisclaimer',
            resourceId: student.healthDisclaimer.id,
            details: { studentId: student.id, authorizedRole: callerRole },
          });
        } catch (err) {
          healthDisclaimerDetails = {
            id: student.healthDisclaimer.id,
            injurySummary: student.healthDisclaimer.injurySummary,
            healthNotes: '[Encrypted note unreadable or key mismatch]',
            hasPregnancyAlert: student.healthDisclaimer.hasPregnancyAlert,
            consentSigned: student.healthDisclaimer.consentSigned,
            consentTimestamp: student.healthDisclaimer.consentTimestamp.toISOString(),
            updatedAt: student.healthDisclaimer.updatedAt.toISOString(),
          };
        }
      }
    }

    return {
      id: student.id,
      tenantId: student.tenantId,
      homeBranchId: student.homeBranchId,
      homeBranchName: student.homeBranch.name,
      fullName: student.fullName,
      mobilePhone: student.mobilePhone,
      email: student.email,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
      gender: student.gender,
      emergencyContactName: student.emergencyContactName,
      emergencyContactPhone: student.emergencyContactPhone,
      emergencyContactRelation: student.emergencyContactRelation,
      status: student.status as any,
      billingAddress: student.billingAddress as any,
      billingStateCode: student.billingStateCode,
      hasHealthAlert: student.hasHealthAlert,
      cautionBadge: student.hasHealthAlert ? 'Physical Restriction Flagged' : undefined,
      healthDisclaimer: healthDisclaimerDetails,
      consents: student.consents.map((c) => ({
        id: c.id,
        consentType: c.consentType,
        version: c.version,
        isAgreed: c.isAgreed,
        agreedAt: c.agreedAt.toISOString(),
        ipAddress: c.ipAddress,
      })),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }

  async createStudent(
    tenantId: string,
    data: CreateStudentRequest,
    callerUserId: string,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<StudentDetails> {
    // 1. Validate branch exists in this tenant
    const branch = await prisma.branch.findUnique({
      where: { id: data.homeBranchId },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new ForbiddenException('Invalid branch: Home branch does not belong to active organization');
    }

    // 2. Check for duplicate phone or email within this organization
    const existing = await prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { mobilePhone: data.mobilePhone.trim() },
          data.email ? { email: data.email.trim().toLowerCase() } : { id: 'no-match' },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.mobilePhone === data.mobilePhone.trim()
          ? `A student with phone number "${data.mobilePhone}" already exists in this studio`
          : `A student with email "${data.email}" already exists in this studio`
      );
    }

    const hasHealth = !!data.healthDisclaimer;

    const student = await prisma.$transaction(async (tx) => {
      const newStudent = await tx.student.create({
        data: {
          tenantId,
          homeBranchId: data.homeBranchId,
          fullName: data.fullName,
          mobilePhone: data.mobilePhone.trim(),
          email: data.email ? data.email.trim().toLowerCase() : null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender ?? null,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          emergencyContactRelation: data.emergencyContactRelation,
          status: (data.status as StudentStatus) || 'ACTIVE',
          billingAddress: data.billingAddress ?? undefined,
          billingStateCode: data.billingStateCode ?? null,
          hasHealthAlert: hasHealth,
        },
        include: {
          homeBranch: { select: { name: true } },
        },
      });

      // Encrypt and store health disclaimer if provided
      if (data.healthDisclaimer) {
        const encrypted = this.crypto.encryptAesGcm(
          data.healthDisclaimer.healthNotes,
          tenantId
        );

        await tx.studentHealthDisclaimer.create({
          data: {
            tenantId,
            studentId: newStudent.id,
            injurySummary: data.healthDisclaimer.injurySummary ?? null,
            healthNotesCiphertext: encrypted.ciphertext,
            healthNotesIv: encrypted.iv,
            healthNotesTag: encrypted.tag,
            hasPregnancyAlert: data.healthDisclaimer.hasPregnancyAlert ?? false,
            consentSigned: data.healthDisclaimer.consentSigned ?? true,
            consentTimestamp: new Date(),
            consentIpAddress: meta.ip || null,
            updatedByUserId: callerUserId,
          },
        });
      }

      // Record initial liability waiver / terms consent
      if (data.initialConsent) {
        await tx.studentConsent.create({
          data: {
            tenantId,
            studentId: newStudent.id,
            consentType: data.initialConsent.consentType,
            version: data.initialConsent.version || '1.0',
            isAgreed: data.initialConsent.isAgreed ?? true,
            agreedAt: new Date(),
            ipAddress: meta.ip || null,
            userAgent: meta.userAgent || null,
          },
        });
      }

      // Record activity timeline
      await tx.studentActivity.create({
        data: {
          tenantId,
          studentId: newStudent.id,
          activityType: 'REGISTERED',
          title: 'Student Registered',
          description: `Registered at ${branch.name}`,
          performedByUserId: callerUserId,
        },
      });

      return newStudent;
    });

    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'STUDENT_REGISTER',
      resourceType: 'Student',
      resourceId: student.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { fullName: student.fullName, homeBranchId: student.homeBranchId },
    });

    return this.getStudent(tenantId, student.id, 'OWNER', callerUserId);
  }

  async updateStudent(
    tenantId: string,
    studentId: string,
    data: UpdateStudentRequest,
    callerUserId: string
  ): Promise<StudentDetails> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    if (data.homeBranchId && data.homeBranchId !== student.homeBranchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: data.homeBranchId },
      });
      if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
        throw new ForbiddenException('Invalid home branch ID');
      }
    }

    // Check duplicate phone or email if changed
    if (data.mobilePhone && data.mobilePhone.trim() !== student.mobilePhone) {
      const existing = await prisma.student.findFirst({
        where: {
          tenantId,
          mobilePhone: data.mobilePhone.trim(),
          deletedAt: null,
          id: { not: studentId },
        },
      });
      if (existing) {
        throw new ConflictException(`Phone number "${data.mobilePhone}" is already used by another student`);
      }
    }

    if (data.email && data.email.trim().toLowerCase() !== student.email) {
      const existing = await prisma.student.findFirst({
        where: {
          tenantId,
          email: data.email.trim().toLowerCase(),
          deletedAt: null,
          id: { not: studentId },
        },
      });
      if (existing) {
        throw new ConflictException(`Email "${data.email}" is already used by another student`);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.student.update({
        where: { id: studentId },
        data: {
          homeBranchId: data.homeBranchId ?? undefined,
          fullName: data.fullName ?? undefined,
          mobilePhone: data.mobilePhone ? data.mobilePhone.trim() : undefined,
          email: data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : undefined,
          dateOfBirth: data.dateOfBirth !== undefined ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null) : undefined,
          gender: data.gender !== undefined ? data.gender : undefined,
          emergencyContactName: data.emergencyContactName ?? undefined,
          emergencyContactPhone: data.emergencyContactPhone ?? undefined,
          emergencyContactRelation: data.emergencyContactRelation ?? undefined,
          status: data.status ? (data.status as StudentStatus) : undefined,
          billingAddress: data.billingAddress !== undefined ? (data.billingAddress as any) : undefined,
          billingStateCode: data.billingStateCode !== undefined ? data.billingStateCode : undefined,
        },
      });

      await tx.studentActivity.create({
        data: {
          tenantId,
          studentId,
          activityType: 'PROFILE_UPDATED',
          title: 'Profile Updated',
          description: 'Contact or personal information was updated',
          performedByUserId: callerUserId,
        },
      });

      return res;
    });

    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'STUDENT_UPDATE',
      resourceType: 'Student',
      resourceId: studentId,
      details: data,
    });

    return this.getStudent(tenantId, studentId, 'OWNER', callerUserId);
  }

  async updateStudentHealth(
    tenantId: string,
    studentId: string,
    data: StudentHealthDisclaimerInput,
    callerUserId: string,
    meta: { ip?: string } = {}
  ): Promise<void> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    const encrypted = this.crypto.encryptAesGcm(data.healthNotes, tenantId);

    await prisma.$transaction(async (tx) => {
      await tx.studentHealthDisclaimer.upsert({
        where: { studentId },
        create: {
          tenantId,
          studentId,
          injurySummary: data.injurySummary ?? null,
          healthNotesCiphertext: encrypted.ciphertext,
          healthNotesIv: encrypted.iv,
          healthNotesTag: encrypted.tag,
          hasPregnancyAlert: data.hasPregnancyAlert ?? false,
          consentSigned: data.consentSigned ?? true,
          consentTimestamp: new Date(),
          consentIpAddress: meta.ip || null,
          updatedByUserId: callerUserId,
        },
        update: {
          injurySummary: data.injurySummary ?? null,
          healthNotesCiphertext: encrypted.ciphertext,
          healthNotesIv: encrypted.iv,
          healthNotesTag: encrypted.tag,
          hasPregnancyAlert: data.hasPregnancyAlert ?? false,
          consentSigned: data.consentSigned ?? true,
          consentTimestamp: new Date(),
          consentIpAddress: meta.ip || null,
          updatedByUserId: callerUserId,
        },
      });

      await tx.student.update({
        where: { id: studentId },
        data: { hasHealthAlert: true },
      });

      await tx.studentActivity.create({
        data: {
          tenantId,
          studentId,
          activityType: 'HEALTH_DISCLAIMER_UPDATED',
          title: 'Health Disclaimer Updated',
          description: data.injurySummary ? `Noted: ${data.injurySummary}` : 'Health restrictions updated',
          performedByUserId: callerUserId,
        },
      });
    });

    // Audit without logging sensitive health text
    await this.audit.log({
      tenantId,
      userId: callerUserId,
      action: 'STUDENT_HEALTH_UPDATED',
      resourceType: 'StudentHealthDisclaimer',
      resourceId: studentId,
      details: { injurySummary: data.injurySummary, hasPregnancyAlert: data.hasPregnancyAlert },
    });
  }

  async recordStudentConsent(
    tenantId: string,
    studentId: string,
    data: StudentConsentInput,
    callerUserId?: string,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentConsent.create({
        data: {
          tenantId,
          studentId,
          consentType: data.consentType,
          version: data.version || '1.0',
          isAgreed: data.isAgreed ?? true,
          agreedAt: new Date(),
          ipAddress: meta.ip || null,
          userAgent: meta.userAgent || null,
        },
      });

      await tx.studentActivity.create({
        data: {
          tenantId,
          studentId,
          activityType: 'CONSENT_SIGNED',
          title: `Consent Agreed: ${data.consentType}`,
          description: `Version ${data.version || '1.0'} accepted`,
          performedByUserId: callerUserId || null,
        },
      });
    });
  }

  async getStudentTimeline(
    tenantId: string,
    studentId: string
  ): Promise<StudentActivityDetails[]> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    const activities = await prisma.studentActivity.findMany({
      where: { tenantId, studentId },
      include: {
        performedByUser: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities.map((a) => ({
      id: a.id,
      activityType: a.activityType,
      title: a.title,
      description: a.description,
      performedByName: a.performedByUser?.fullName || null,
      metadata: a.metadata as any,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async addStudentNote(
    tenantId: string,
    studentId: string,
    data: CreateStudentNoteRequest,
    callerUserId: string
  ): Promise<StudentActivityDetails> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.tenantId !== tenantId || student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    const activity = await prisma.studentActivity.create({
      data: {
        tenantId,
        studentId,
        activityType: 'STAFF_NOTE',
        title: data.title,
        description: data.description,
        performedByUserId: callerUserId,
      },
      include: {
        performedByUser: {
          select: { fullName: true },
        },
      },
    });

    return {
      id: activity.id,
      activityType: activity.activityType,
      title: activity.title,
      description: activity.description,
      performedByName: activity.performedByUser?.fullName || null,
      metadata: null,
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
