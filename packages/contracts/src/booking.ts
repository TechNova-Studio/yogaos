import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------
export const BookingStatusEnum = z.enum([
  'BOOKED',
  'ATTENDED',
  'LATE_CANCEL',
  'NO_SHOW',
  'CANCELLED',
]);
export type BookingStatusType = z.infer<typeof BookingStatusEnum>;

export const BookingSourceEnum = z.enum([
  'FRONT_DESK',
  'ONLINE',
  'ADMIN_OVERRIDE',
]);
export type BookingSourceType = z.infer<typeof BookingSourceEnum>;

export const WaitlistStatusEnum = z.enum([
  'WAITING',
  'PROMOTED',
  'EXPIRED',
  'CANCELLED',
]);
export type WaitlistStatusType = z.infer<typeof WaitlistStatusEnum>;

export const CheckInMethodEnum = z.enum([
  'FRONT_DESK_ROSTER',
  'KIOSK',
  'MANUAL_OVERRIDE',
]);
export type CheckInMethodType = z.infer<typeof CheckInMethodEnum>;

// ----------------------------------------------------------------------------
// Booking Schemas
// ----------------------------------------------------------------------------
export const CreateBookingSchema = z.object({
  sessionInstanceId: z.string().uuid('Valid session ID is required'),
  studentId: z.string().uuid('Valid student ID is required'),
  source: BookingSourceEnum.default('FRONT_DESK'),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateBookingRequest = z.input<typeof CreateBookingSchema>;

export const CancelBookingSchema = z.object({
  cancellationReason: z.string().max(255).optional().nullable(),
});

export type CancelBookingRequest = z.input<typeof CancelBookingSchema>;

export const BookingDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionInstanceId: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  studentPhone: z.string(),
  studentEmail: z.string().nullable().optional(),
  hasHealthCaution: z.boolean(),
  status: BookingStatusEnum,
  source: BookingSourceEnum,
  bookedAt: z.string(),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  notes: z.string().nullable(),
  checkedInAt: z.string().nullable().optional(),
  checkedInByUserName: z.string().nullable().optional(),
  checkInMethod: CheckInMethodEnum.nullable().optional(),
  className: z.string().optional(),
  sessionDate: z.string().optional(),
  sessionStart: z.string().optional(),
  sessionEnd: z.string().optional(),
  roomName: z.string().optional(),
  instructorName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BookingDetails = z.infer<typeof BookingDetailsSchema>;

export const BookingListQuerySchema = z.object({
  sessionInstanceId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: BookingStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type BookingListQuery = z.input<typeof BookingListQuerySchema>;

// ----------------------------------------------------------------------------
// Waitlist Schemas
// ----------------------------------------------------------------------------
export const JoinWaitlistSchema = z.object({
  sessionInstanceId: z.string().uuid('Valid session ID is required'),
  studentId: z.string().uuid('Valid student ID is required'),
  notes: z.string().max(500).optional().nullable(),
});

export type JoinWaitlistRequest = z.input<typeof JoinWaitlistSchema>;

export const WaitlistEntryDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionInstanceId: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  studentPhone: z.string(),
  priorityRank: z.number().int(),
  status: WaitlistStatusEnum,
  promotedToBookingId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WaitlistEntryDetails = z.infer<typeof WaitlistEntryDetailsSchema>;

// ----------------------------------------------------------------------------
// Attendance Schemas
// ----------------------------------------------------------------------------
export const MarkAttendanceSchema = z.object({
  status: z.enum(['ATTENDED', 'NO_SHOW', 'LATE_CANCEL', 'BOOKED']),
  checkInMethod: CheckInMethodEnum.default('FRONT_DESK_ROSTER'),
  notes: z.string().max(500).optional().nullable(),
});

export type MarkAttendanceRequest = z.input<typeof MarkAttendanceSchema>;

export const AttendanceRecordDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: BookingStatusEnum,
  checkedInAt: z.string(),
  checkedInByUserId: z.string().uuid(),
  checkedInByUserName: z.string(),
  checkInMethod: CheckInMethodEnum,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AttendanceRecordDetails = z.infer<typeof AttendanceRecordDetailsSchema>;

// ----------------------------------------------------------------------------
// Session Roster Schema
// ----------------------------------------------------------------------------
export const SessionRosterSchema = z.object({
  sessionId: z.string().uuid(),
  className: z.string(),
  batchName: z.string().nullable(),
  branchName: z.string(),
  roomName: z.string(),
  instructorName: z.string(),
  sessionDate: z.string(),
  startTimestamp: z.string(),
  endTimestamp: z.string(),
  capacity: z.number().int(),
  bookedCount: z.number().int(),
  availableCapacity: z.number().int(),
  attendedCount: z.number().int(),
  waitlistCount: z.number().int(),
  status: z.string(),
  bookings: z.array(BookingDetailsSchema),
  waitlist: z.array(WaitlistEntryDetailsSchema),
});

export type SessionRoster = z.infer<typeof SessionRosterSchema>;
