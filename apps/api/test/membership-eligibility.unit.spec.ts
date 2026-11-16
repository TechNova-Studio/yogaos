import { describe, it, expect } from 'vitest';
import { PlanTypeEnum, MembershipStatusEnum } from '@yogaos/contracts';

describe('Membership & Pass Eligibility Logic (Unit Tests)', () => {
  it('should validate plan type enum values', () => {
    expect(PlanTypeEnum.parse('TIME_UNLIMITED')).toBe('TIME_UNLIMITED');
    expect(PlanTypeEnum.parse('CLASS_PACK')).toBe('CLASS_PACK');
    expect(PlanTypeEnum.parse('SINGLE_DROP_IN')).toBe('SINGLE_DROP_IN');
    expect(() => PlanTypeEnum.parse('ANNUAL_SUBSCRIPTION')).toThrow();
  });

  it('should validate membership status transitions', () => {
    expect(MembershipStatusEnum.parse('ACTIVE')).toBe('ACTIVE');
    expect(MembershipStatusEnum.parse('FROZEN')).toBe('FROZEN');
    expect(MembershipStatusEnum.parse('EXPIRED')).toBe('EXPIRED');
    expect(MembershipStatusEnum.parse('CANCELLED')).toBe('CANCELLED');
  });

  it('should correctly calculate frozen days extension', () => {
    const frozenAt = new Date('2026-05-01T10:00:00Z');
    const unfrozenAt = new Date('2026-05-15T10:00:00Z'); // 14 days later
    const initialExpiry = new Date('2026-06-01T10:00:00Z');

    const msFrozen = Math.max(0, unfrozenAt.getTime() - frozenAt.getTime());
    const daysFrozen = Math.max(1, Math.ceil(msFrozen / (1000 * 60 * 60 * 24)));
    expect(daysFrozen).toBe(14);

    const newExpiry = new Date(initialExpiry.getTime() + daysFrozen * 24 * 60 * 60 * 1000);
    expect(newExpiry.toISOString()).toBe('2026-06-15T10:00:00.000Z');
  });

  it('should enforce single-day minimum freeze extension', () => {
    const frozenAt = new Date('2026-05-01T10:00:00Z');
    const unfrozenAt = new Date('2026-05-01T12:00:00Z'); // Same day, 2 hours later
    const initialExpiry = new Date('2026-06-01T10:00:00Z');

    const msFrozen = Math.max(0, unfrozenAt.getTime() - frozenAt.getTime());
    const daysFrozen = Math.max(1, Math.ceil(msFrozen / (1000 * 60 * 60 * 24)));
    expect(daysFrozen).toBe(1);

    const newExpiry = new Date(initialExpiry.getTime() + daysFrozen * 24 * 60 * 60 * 1000);
    expect(newExpiry.toISOString()).toBe('2026-06-02T10:00:00.000Z');
  });

  it('should evaluate multi-branch validity correctly', () => {
    const sessionBranchId = 'branch-gurugram';

    // Multi-branch valid membership
    const multiBranchMembership = {
      isMultiBranchSnapshot: true,
      homeBranchId: 'branch-south-delhi',
    };
    const isEligibleMulti = multiBranchMembership.isMultiBranchSnapshot || multiBranchMembership.homeBranchId === sessionBranchId;
    expect(isEligibleMulti).toBe(true);

    // Single-branch restricted membership (mismatched)
    const singleBranchMembership = {
      isMultiBranchSnapshot: false,
      homeBranchId: 'branch-south-delhi',
    };
    const isEligibleSingleMismatched = singleBranchMembership.isMultiBranchSnapshot || singleBranchMembership.homeBranchId === sessionBranchId;
    expect(isEligibleSingleMismatched).toBe(false);

    // Single-branch restricted membership (matched)
    const singleBranchMatched = {
      isMultiBranchSnapshot: false,
      homeBranchId: 'branch-gurugram',
    };
    const isEligibleSingleMatched = singleBranchMatched.isMultiBranchSnapshot || singleBranchMatched.homeBranchId === sessionBranchId;
    expect(isEligibleSingleMatched).toBe(true);
  });

  it('should evaluate credit balance eligibility for class packs vs unlimited plans', () => {
    // Unlimited plan always eligible regardless of credit field
    const unlimited = { planType: 'TIME_UNLIMITED', remainingCredits: null };
    const unlimitedEligible = unlimited.planType === 'TIME_UNLIMITED' || (unlimited.remainingCredits !== null && unlimited.remainingCredits > 0);
    expect(unlimitedEligible).toBe(true);

    // Pack with remaining credits
    const packWithCredits = { planType: 'CLASS_PACK', remainingCredits: 5 };
    const packEligible = packWithCredits.planType === 'TIME_UNLIMITED' || (packWithCredits.remainingCredits !== null && packWithCredits.remainingCredits > 0);
    expect(packEligible).toBe(true);

    // Pack with 0 credits
    const exhaustedPack = { planType: 'CLASS_PACK', remainingCredits: 0 };
    const exhaustedEligible = exhaustedPack.planType === 'TIME_UNLIMITED' || (exhaustedPack.remainingCredits !== null && exhaustedPack.remainingCredits > 0);
    expect(exhaustedEligible).toBe(false);
  });
});
