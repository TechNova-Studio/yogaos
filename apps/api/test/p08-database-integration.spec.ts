import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, UserRole, MemberStatus } from '@yogaos/database';
import { OrganizationsService } from '../src/modules/organizations/organizations.service.js';
import { BranchesService } from '../src/modules/branches/branches.service.js';
import { RoomsService } from '../src/modules/rooms/rooms.service.js';
import { StudentsService } from '../src/modules/students/students.service.js';
import { LeadsService } from '../src/modules/leads/leads.service.js';
import { CryptoService } from '../src/common/services/crypto.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('P08 Real Database Integration Tests (Studio, Branch, Room, Student & Leads)', () => {
  let cryptoService: CryptoService;
  let auditService: AuditService;
  let orgsService: OrganizationsService;
  let branchesService: BranchesService;
  let roomsService: RoomsService;
  let studentsService: StudentsService;
  let leadsService: LeadsService;

  // Track created IDs for test cleanup
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  // Reusable tenant and branch IDs
  let tenantA: string;
  let tenantB: string;
  let userA: string; // Owner in Tenant A
  let userReceptionist: string; // Receptionist in Tenant A
  let branchA1: string;
  let branchB1: string;

  beforeAll(async () => {
    cryptoService = new CryptoService();
    auditService = new AuditService();
    orgsService = new OrganizationsService(auditService);
    branchesService = new BranchesService(auditService);
    roomsService = new RoomsService(auditService);
    studentsService = new StudentsService(cryptoService, auditService);
    leadsService = new LeadsService(auditService);

    // 1. Create Tenant A (Ananda Shala)
    const orgA = await prisma.organization.create({
      data: {
        name: `Ananda Shala ${Date.now()}`,
        slug: `ananda-shala-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B (Moksha Yoga)
    const orgB = await prisma.organization.create({
      data: {
        name: `Moksha Yoga ${Date.now()}`,
        slug: `moksha-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Users
    const uOwner = await prisma.user.create({
      data: {
        email: `owner.p08.${Date.now()}@yogaos-test.in`,
        fullName: 'Devi Sharma',
      },
    });
    userA = uOwner.id;
    createdUserIds.push(userA);

    const uRecep = await prisma.user.create({
      data: {
        email: `recep.p08.${Date.now()}@yogaos-test.in`,
        fullName: 'Pooja Frontdesk',
      },
    });
    userReceptionist = uRecep.id;
    createdUserIds.push(userReceptionist);

    // Assign memberships in Tenant A
    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        role: 'OWNER' as UserRole,
        status: 'ACTIVE' as MemberStatus,
      },
    });

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userReceptionist,
        role: 'RECEPTIONIST' as UserRole,
        status: 'ACTIVE' as MemberStatus,
      },
    });

    // 4. Create Initial Branches
    const bA = await branchesService.createBranch(
      tenantA,
      {
        name: 'Indiranagar Central',
        slug: `indiranagar-${Date.now()}`,
        streetAddress: '100 Feet Rd',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+91 98765 00001',
        email: 'indiranagar@ananda.in',
      },
      userA
    );
    branchA1 = bA.id;

    const bB = await branchesService.createBranch(
      tenantB,
      {
        name: 'Bandra West Shala',
        slug: `bandra-west-${Date.now()}`,
        streetAddress: 'Hill Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '400050',
        phone: '+91 98765 00002',
        email: 'bandra@moksha.in',
      },
      userA
    );
    branchB1 = bB.id;
  });

  afterAll(async () => {
    // Cascade cleanup
    if (createdOrgIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.studentActivity.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.studentConsent.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.studentHealthDisclaimer.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.lead.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.student.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.room.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.branch.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.organizationMember.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.userCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  describe('1. Studio Settings & Branch Management', () => {
    it('should update organization settings and legal profile in PostgreSQL', async () => {
      const updated = await orgsService.updateOrganizationSettings(
        tenantA,
        {
          legalEntityName: 'Ananda Wellness Private Limited',
          gstin: '29AAAAA1111A1Z1',
          panNumber: 'AAAAA1111A',
          timezone: 'Asia/Kolkata',
          settings: { cancellationWindowHours: 4, lateCancelFee: 200 },
        },
        userA
      );

      expect(updated.legalEntityName).toBe('Ananda Wellness Private Limited');
      expect(updated.gstin).toBe('29AAAAA1111A1Z1');
      expect(updated.panNumber).toBe('AAAAA1111A');
      expect(updated.settings?.cancellationWindowHours).toBe(4);
    });

    it('should list tenant-scoped branches and prevent cross-tenant branch access', async () => {
      // List branches for Tenant A
      const branchesA = await branchesService.getBranches(tenantA);
      expect(branchesA.some((b) => b.id === branchA1)).toBe(true);
      expect(branchesA.some((b) => b.id === branchB1)).toBe(false);

      // Attempt to retrieve Tenant B's branch using Tenant A context -> throws NotFoundException
      await expect(branchesService.getBranch(tenantA, branchB1)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('2. Room Management & Capacity Invariants', () => {
    it('should create room with valid capacity linked to a branch', async () => {
      const room = await roomsService.createRoom(
        tenantA,
        {
          branchId: branchA1,
          name: 'Surya Shala (Main Studio)',
          description: 'Spacious hall with prop wall',
          maxMatCapacity: 30,
        },
        userA
      );

      expect(room.id).toBeDefined();
      expect(room.name).toBe('Surya Shala (Main Studio)');
      expect(room.maxMatCapacity).toBe(30);
      expect(room.tenantId).toBe(tenantA);

      // Verify in PostgreSQL
      const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
      expect(dbRoom?.maxMatCapacity).toBe(30);
    });

    it('should reject room creation with capacity less than 1 (Capacity Validation)', async () => {
      await expect(
        roomsService.createRoom(
          tenantA,
          {
            branchId: branchA1,
            name: 'Zero Room',
            maxMatCapacity: 0,
          },
          userA
        )
      ).rejects.toThrow(BadRequestException);

      await expect(
        roomsService.createRoom(
          tenantA,
          {
            branchId: branchA1,
            name: 'Negative Room',
            maxMatCapacity: -5,
          },
          userA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should BLOCK creating a room referencing a branch belonging to another tenant (Cross-Tenant Association Prevention)', async () => {
      // Tenant A attempts to create a room inside Tenant B's branch branchB1
      await expect(
        roomsService.createRoom(
          tenantA,
          {
            branchId: branchB1, // Belongs to Tenant B!
            name: 'Infiltrated Room',
            maxMatCapacity: 20,
          },
          userA
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Student Registration, Identity & Duplicate Prevention', () => {
    const studentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const studentEmail = `student.${Date.now()}@yogaos-test.in`;
    let registeredStudentId: string;

    it('should register a student with immutable UUID, mutable identifiers, emergency contacts and consent', async () => {
      const student = await studentsService.createStudent(
        tenantA,
        {
          homeBranchId: branchA1,
          fullName: 'Meera Nambiar',
          mobilePhone: studentPhone,
          email: studentEmail,
          emergencyContactName: 'Karthik Nambiar',
          emergencyContactPhone: '+91 98765 99999',
          emergencyContactRelation: 'Spouse',
          status: 'ACTIVE',
          initialConsent: {
            consentType: 'LIABILITY_WAIVER',
            version: '1.0',
            isAgreed: true,
          },
          healthDisclaimer: {
            injurySummary: 'L4-L5 Disc Herniation',
            healthNotes: 'Avoid extreme backward bends and unsupported headstands.',
            hasPregnancyAlert: false,
          },
        },
        userA
      );

      registeredStudentId = student.id;
      expect(student.id).toBeDefined();
      expect(student.fullName).toBe('Meera Nambiar');
      expect(student.mobilePhone).toBe(studentPhone);
      expect(student.hasHealthAlert).toBe(true);

      // Verify StudentConsent record created in PostgreSQL
      const consents = await prisma.studentConsent.findMany({
        where: { studentId: registeredStudentId },
      });
      expect(consents).toHaveLength(1);
      expect(consents[0].consentType).toBe('LIABILITY_WAIVER');
      expect(consents[0].isAgreed).toBe(true);

      // Verify StudentActivity timeline record
      const timeline = await studentsService.getStudentTimeline(tenantA, registeredStudentId);
      expect(timeline.length).toBeGreaterThanOrEqual(1);
      expect(timeline[0].activityType).toBe('REGISTERED');
    });

    it('should enforce duplicate phone/email prevention within the same tenant', async () => {
      // Attempting to register another student with identical phone in Tenant A must fail
      await expect(
        studentsService.createStudent(
          tenantA,
          {
            homeBranchId: branchA1,
            fullName: 'Duplicate Meera',
            mobilePhone: studentPhone, // Duplicate phone!
            emergencyContactName: 'Parent',
            emergencyContactPhone: '9876500000',
            emergencyContactRelation: 'Parent',
          },
          userA
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should allow mutable contact updates (phone, email, emergency contact) without changing UUID identity', async () => {
      const newPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
      const newEmail = `meera.updated.${Date.now()}@yogaos-test.in`;

      const updated = await studentsService.updateStudent(
        tenantA,
        registeredStudentId,
        {
          mobilePhone: newPhone,
          email: newEmail,
          emergencyContactPhone: '+91 99999 88888',
        },
        userA
      );

      expect(updated.id).toBe(registeredStudentId); // Immutable primary identity
      expect(updated.mobilePhone).toBe(newPhone);
      expect(updated.email).toBe(newEmail);
      expect(updated.emergencyContactPhone).toBe('+91 99999 88888');

      // Verify in PostgreSQL
      const dbStudent = await prisma.student.findUnique({
        where: { id: registeredStudentId },
      });
      expect(dbStudent?.mobilePhone).toBe(newPhone);
    });
  });

  describe('4. Student Health Privacy, AES-256-GCM Encryption & Front-Desk Redaction', () => {
    let studentWithHealthId: string;
    const sensitiveNarrative =
      'Patient had laparoscopic abdominal surgery 3 months ago. Experiences sharp pain during deep twist asanas.';
    const injuryTitle = 'Post-surgical Abdominal Strain';

    it('should store health narrative encrypted with AES-256-GCM at rest in PostgreSQL', async () => {
      const student = await studentsService.createStudent(
        tenantA,
        {
          homeBranchId: branchA1,
          fullName: 'Arjun Sen',
          mobilePhone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
          emergencyContactName: 'Dr. Sen',
          emergencyContactPhone: '9876543210',
          emergencyContactRelation: 'Father',
          healthDisclaimer: {
            injurySummary: injuryTitle,
            healthNotes: sensitiveNarrative,
            hasPregnancyAlert: false,
          },
        },
        userA
      );
      studentWithHealthId = student.id;

      // Inspect raw database row in PostgreSQL directly
      const rawDisclaimer = await prisma.studentHealthDisclaimer.findUnique({
        where: { studentId: studentWithHealthId },
      });

      expect(rawDisclaimer).not.toBeNull();
      // Ensure plaintext does NOT exist in ciphertext
      expect(rawDisclaimer?.healthNotesCiphertext).not.toContain('laparoscopic');
      expect(rawDisclaimer?.healthNotesCiphertext).not.toContain('abdominal');
      expect(rawDisclaimer?.healthNotesIv).toBeDefined();
      expect(rawDisclaimer?.healthNotesIv.length).toBe(24); // 12 bytes = 24 hex chars
      expect(rawDisclaimer?.healthNotesTag).toBeDefined();
      expect(rawDisclaimer?.healthNotesTag.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should enforce Front-Desk Privacy: RECEPTIONIST receives non-clinical caution badge only with clinical narrative completely stripped', async () => {
      const receptionistView = await studentsService.getStudent(
        tenantA,
        studentWithHealthId,
        'RECEPTIONIST',
        userReceptionist
      );

      // Front desk sees non-clinical caution indicator
      expect(receptionistView.hasHealthAlert).toBe(true);
      expect(receptionistView.cautionBadge).toBe('Physical Restriction Flagged');

      // Raw clinical narrative is strictly null / stripped
      expect(receptionistView.healthDisclaimer).toBeNull();
    });

    it('should provide decrypted clinical narrative to authorized roles (INSTRUCTOR, OWNER, MANAGER) and audit access', async () => {
      const authorizedView = await studentsService.getStudent(
        tenantA,
        studentWithHealthId,
        'INSTRUCTOR',
        userA
      );

      expect(authorizedView.hasHealthAlert).toBe(true);
      expect(authorizedView.healthDisclaimer).not.toBeNull();
      expect(authorizedView.healthDisclaimer?.injurySummary).toBe(injuryTitle);
      // Decrypted correctly
      expect(authorizedView.healthDisclaimer?.healthNotes).toBe(sensitiveNarrative);

      // Verify audit log recorded access without logging the sensitive text itself
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          tenantId: tenantA,
          action: 'STUDENT_HEALTH_ACCESSED',
          resourceId: authorizedView.healthDisclaimer?.id,
        },
      });

      expect(auditLog).not.toBeNull();
      // Ensure sensitive clinical text is NOT stored in the audit log JSON
      const auditDetailsStr = JSON.stringify(auditLog?.details || {});
      expect(auditDetailsStr).not.toContain('laparoscopic');
      expect(auditDetailsStr).not.toContain('abdominal');
    });
  });

  describe('5. Leads Management & Conversion Pipeline', () => {
    let leadId: string;
    const leadPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;

    it('should create lead enquiry and update pipeline stage', async () => {
      const lead = await leadsService.createLead(
        tenantA,
        {
          branchId: branchA1,
          fullName: 'Kavita Das',
          phone: leadPhone,
          email: 'kavita@enquiry.in',
          source: 'INSTAGRAM',
          interestedProgram: 'Vinyasa Flow Morning Batch',
          notes: 'Enquired about 3-month membership',
        },
        userA
      );

      leadId = lead.id;
      expect(lead.id).toBeDefined();
      expect(lead.status).toBe('NEW');
      expect(lead.source).toBe('INSTAGRAM');

      // Update stage to CONTACTED
      const updated = await leadsService.updateLead(
        tenantA,
        leadId,
        { status: 'CONTACTED', notes: 'Spoke on phone, invited for trial class' },
        userA
      );
      expect(updated.status).toBe('CONTACTED');
    });

    it('should convert lead to student transactionally and link to student profile without creating duplicates', async () => {
      const conversion = await leadsService.convertLead(
        tenantA,
        leadId,
        {
          homeBranchId: branchA1,
          emergencyContactName: 'Sunil Das',
          emergencyContactPhone: '9876512345',
          emergencyContactRelation: 'Brother',
        },
        userA
      );

      expect(conversion.studentId).toBeDefined();

      // Verify Lead status in DB is now CONVERTED and convertedStudentId is set
      const dbLead = await prisma.lead.findUnique({ where: { id: leadId } });
      expect(dbLead?.status).toBe('CONVERTED');
      expect(dbLead?.convertedStudentId).toBe(conversion.studentId);

      // Verify newly created Student record
      const dbStudent = await prisma.student.findUnique({
        where: { id: conversion.studentId },
      });
      expect(dbStudent?.fullName).toBe('Kavita Das');
      expect(dbStudent?.mobilePhone).toBe(leadPhone);
      expect(dbStudent?.status).toBe('ACTIVE');

      // Attempting to convert the same lead again must throw ConflictException
      await expect(
        leadsService.convertLead(
          tenantA,
          leadId,
          {
            homeBranchId: branchA1,
            emergencyContactName: 'Sunil Das',
            emergencyContactPhone: '9876512345',
            emergencyContactRelation: 'Brother',
          },
          userA
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('6. Cross-Tenant Read & Write Denial', () => {
    it('should strictly deny reading or modifying students, rooms or leads across tenant boundaries', async () => {
      // Create student in Tenant B
      const studentB = await studentsService.createStudent(
        tenantB,
        {
          homeBranchId: branchB1,
          fullName: 'Tenant B Student',
          mobilePhone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
          emergencyContactName: 'B Contact',
          emergencyContactPhone: '9876500000',
          emergencyContactRelation: 'Friend',
        },
        userA
      );

      // Tenant A attempts to read Tenant B's student -> throws NotFoundException
      await expect(
        studentsService.getStudent(tenantA, studentB.id, 'OWNER', userA)
      ).rejects.toThrow(NotFoundException);

      // Tenant A attempts to update Tenant B's student -> throws NotFoundException
      await expect(
        studentsService.updateStudent(
          tenantA,
          studentB.id,
          { fullName: 'Hacked Name' },
          userA
        )
      ).rejects.toThrow(NotFoundException);

      // Tenant A attempts to list students -> must NOT contain studentB
      const listA = await studentsService.getStudents(tenantA);
      expect(listA.students.some((s) => s.id === studentB.id)).toBe(false);
    });
  });
});
