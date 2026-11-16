import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, MembershipStatus } from '@yogaos/database';
import { MembershipEligibilityResult } from '@yogaos/contracts';

@Injectable()
export class EligibilityService {
  async checkEligibility(
    tenantId: string,
    studentId: string,
    sessionInstanceId: string
  ): Promise<MembershipEligibilityResult> {
    const session = await prisma.classSessionInstance.findFirst({
      where: { id: sessionInstanceId, tenantId },
      include: {
        branch: { select: { name: true } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionInstanceId} not found`);
    }

    const now = new Date();
    const activeMemberships = await prisma.studentMembership.findMany({
      where: {
        tenantId,
        studentId,
        status: MembershipStatus.ACTIVE,
        deletedAt: null,
        expiryDate: { gte: now },
      },
      orderBy: { expiryDate: 'asc' },
    });

    if (activeMemberships.length === 0) {
      return {
        eligible: false,
        studentMembershipId: null,
        planType: null,
        planName: null,
        remainingCredits: null,
        expiryDate: null,
        reason: 'Student does not have any active membership or class pass',
      };
    }

    // Filter by branch eligibility
    const branchEligible = activeMemberships.filter((m) => {
      if (m.isMultiBranchSnapshot) return true;
      return m.homeBranchId === session.branchId;
    });

    if (branchEligible.length === 0) {
      return {
        eligible: false,
        studentMembershipId: null,
        planType: null,
        planName: null,
        remainingCredits: null,
        expiryDate: null,
        reason: 'Membership is restricted to a different home branch',
      };
    }

    // Check credits
    const creditEligible = branchEligible.filter((m) => {
      if (m.planTypeSnapshot === 'TIME_UNLIMITED') return true;
      return m.remainingCredits !== null && m.remainingCredits > 0;
    });

    if (creditEligible.length === 0) {
      return {
        eligible: false,
        studentMembershipId: null,
        planType: null,
        planName: null,
        remainingCredits: 0,
        expiryDate: null,
        reason: 'Class pass has 0 remaining credits',
      };
    }

    // Prefer unlimited, then earliest expiring pack
    const unlimited = creditEligible.find((m) => m.planTypeSnapshot === 'TIME_UNLIMITED');
    const selected = unlimited || creditEligible[0];

    return {
      eligible: true,
      studentMembershipId: selected.id,
      planType: selected.planTypeSnapshot,
      planName: selected.planNameSnapshot,
      remainingCredits: selected.remainingCredits,
      expiryDate: selected.expiryDate.toISOString(),
      reason: 'Eligible for session attendance',
    };
  }
}
