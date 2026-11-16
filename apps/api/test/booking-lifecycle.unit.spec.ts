import { describe, it, expect } from 'vitest';
import { BookingStatusEnum, WaitlistStatusEnum } from '@yogaos/contracts';

/**
 * Pure domain state machine validator for booking lifecycle transitions.
 */
function isValidBookingTransition(from: string, to: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    BOOKED: ['ATTENDED', 'NO_SHOW', 'LATE_CANCEL', 'CANCELLED'],
    ATTENDED: ['BOOKED', 'NO_SHOW', 'LATE_CANCEL'], // Correction paths
    NO_SHOW: ['ATTENDED', 'BOOKED'], // Late arrival correction
    LATE_CANCEL: ['ATTENDED', 'BOOKED'],
    CANCELLED: ['BOOKED'], // Re-activation only
  };

  return allowedTransitions[from]?.includes(to) ?? false;
}

/**
 * Deterministic FIFO queue priority selector
 */
interface QueueItem {
  id: string;
  studentId: string;
  priorityRank: number;
  status: 'WAITING' | 'PROMOTED' | 'CANCELLED';
}

function getNextWaitlistPromotion(queue: QueueItem[]): QueueItem | null {
  const waiting = queue
    .filter((q) => q.status === 'WAITING')
    .sort((a, b) => a.priorityRank - b.priorityRank);
  return waiting[0] || null;
}

describe('Booking Lifecycle & Waitlist Queue Unit Tests', () => {
  describe('Booking Lifecycle State Transitions', () => {
    it('should validate all supported booking status enum values', () => {
      const statuses = ['BOOKED', 'ATTENDED', 'LATE_CANCEL', 'NO_SHOW', 'CANCELLED'];
      statuses.forEach((s) => {
        expect(BookingStatusEnum.safeParse(s).success).toBe(true);
      });
      expect(BookingStatusEnum.safeParse('UNKNOWN_STATUS').success).toBe(false);
    });

    it('should permit standard booking transitions (BOOKED -> ATTENDED/NO_SHOW/LATE_CANCEL/CANCELLED)', () => {
      expect(isValidBookingTransition('BOOKED', 'ATTENDED')).toBe(true);
      expect(isValidBookingTransition('BOOKED', 'NO_SHOW')).toBe(true);
      expect(isValidBookingTransition('BOOKED', 'LATE_CANCEL')).toBe(true);
      expect(isValidBookingTransition('BOOKED', 'CANCELLED')).toBe(true);
    });

    it('should permit staff corrections (ATTENDED -> BOOKED, NO_SHOW -> ATTENDED)', () => {
      expect(isValidBookingTransition('ATTENDED', 'BOOKED')).toBe(true);
      expect(isValidBookingTransition('NO_SHOW', 'ATTENDED')).toBe(true);
      expect(isValidBookingTransition('LATE_CANCEL', 'BOOKED')).toBe(true);
    });

    it('should reject invalid or nonsensical state transitions', () => {
      expect(isValidBookingTransition('CANCELLED', 'ATTENDED')).toBe(false);
      expect(isValidBookingTransition('CANCELLED', 'NO_SHOW')).toBe(false);
      expect(isValidBookingTransition('UNKNOWN', 'ATTENDED')).toBe(false);
    });
  });

  describe('Waitlist Queue Ordering & Promotion Logic', () => {
    it('should validate all supported waitlist status enum values', () => {
      const statuses = ['WAITING', 'PROMOTED', 'EXPIRED', 'CANCELLED'];
      statuses.forEach((s) => {
        expect(WaitlistStatusEnum.safeParse(s).success).toBe(true);
      });
    });

    it('should deterministically select the lowest priority rank for promotion', () => {
      const queue: QueueItem[] = [
        { id: 'w3', studentId: 's3', priorityRank: 3, status: 'WAITING' },
        { id: 'w1', studentId: 's1', priorityRank: 1, status: 'WAITING' },
        { id: 'w2', studentId: 's2', priorityRank: 2, status: 'WAITING' },
      ];

      const next = getNextWaitlistPromotion(queue);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('w1');
      expect(next?.priorityRank).toBe(1);
    });

    it('should ignore already PROMOTED or CANCELLED entries when selecting next in queue', () => {
      const queue: QueueItem[] = [
        { id: 'w1', studentId: 's1', priorityRank: 1, status: 'PROMOTED' },
        { id: 'w2', studentId: 's2', priorityRank: 2, status: 'CANCELLED' },
        { id: 'w3', studentId: 's3', priorityRank: 3, status: 'WAITING' },
        { id: 'w4', studentId: 's4', priorityRank: 4, status: 'WAITING' },
      ];

      const next = getNextWaitlistPromotion(queue);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('w3');
      expect(next?.studentId).toBe('s3');
      expect(next?.priorityRank).toBe(3);
    });

    it('should return null when no waiting candidates exist', () => {
      const queue: QueueItem[] = [
        { id: 'w1', studentId: 's1', priorityRank: 1, status: 'PROMOTED' },
        { id: 'w2', studentId: 's2', priorityRank: 2, status: 'CANCELLED' },
      ];

      const next = getNextWaitlistPromotion(queue);
      expect(next).toBeNull();
    });
  });
});
