export const UserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  INSTRUCTOR: 'INSTRUCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const Permissions = {
  // Organization & Branches
  ORG_MANAGE: 'org:manage',
  BRANCH_MANAGE: 'branch:manage',

  // Staff & Roles
  STAFF_INVITE: 'staff:invite',
  STAFF_VIEW: 'staff:view',

  // Students & CRM
  STUDENT_CREATE: 'student:create',
  STUDENT_EDIT_PROFILE: 'student:edit_profile',
  STUDENT_HEALTH_VIEW: 'student:health_view',

  // Classes & Scheduling
  CLASSES_MANAGE_TYPES: 'classes:manage_types',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_SUBSTITUTE: 'schedule:substitute',

  // Bookings & Attendance
  BOOKING_CREATE: 'booking:create',
  ATTENDANCE_CHECK_IN: 'attendance:check_in',

  // Memberships & Passes
  MEMBERSHIP_CREATE_PLAN: 'membership:create_plan',
  MEMBERSHIP_ASSIGN: 'membership:assign',
  MEMBERSHIP_FREEZE: 'membership:freeze',

  // Billing & Invoicing
  BILLING_RECORD_PAYMENT: 'billing:record_payment',
  BILLING_VIEW_FINANCIALS: 'billing:view_financials',
  BILLING_ISSUE_REFUND: 'billing:issue_refund',

  // Asanas & Sequences
  ASANA_MANAGE: 'asana:manage',
  SEQUENCE_CREATE_EDIT: 'sequence:create_edit',

  // Conductor
  CONDUCTOR_LAUNCH: 'conductor:launch',
  CONDUCTOR_SYNC_OFFLINE: 'conductor:sync_offline',
} as const;

export type PermissionType = (typeof Permissions)[keyof typeof Permissions];

const RolePermissionsMap: Record<UserRoleType, readonly PermissionType[]> = {
  OWNER: Object.values(Permissions),
  MANAGER: [
    Permissions.BRANCH_MANAGE,
    Permissions.STAFF_VIEW,
    Permissions.STUDENT_CREATE,
    Permissions.STUDENT_EDIT_PROFILE,
    Permissions.STUDENT_HEALTH_VIEW,
    Permissions.CLASSES_MANAGE_TYPES,
    Permissions.SCHEDULE_CREATE,
    Permissions.SCHEDULE_SUBSTITUTE,
    Permissions.BOOKING_CREATE,
    Permissions.ATTENDANCE_CHECK_IN,
    Permissions.MEMBERSHIP_ASSIGN,
    Permissions.MEMBERSHIP_FREEZE,
    Permissions.BILLING_RECORD_PAYMENT,
    Permissions.BILLING_VIEW_FINANCIALS,
    Permissions.BILLING_ISSUE_REFUND,
    Permissions.ASANA_MANAGE,
    Permissions.SEQUENCE_CREATE_EDIT,
    Permissions.CONDUCTOR_LAUNCH,
    Permissions.CONDUCTOR_SYNC_OFFLINE,
  ],
  INSTRUCTOR: [
    Permissions.STAFF_VIEW,
    Permissions.STUDENT_HEALTH_VIEW,
    Permissions.SCHEDULE_SUBSTITUTE,
    Permissions.ATTENDANCE_CHECK_IN,
    Permissions.ASANA_MANAGE,
    Permissions.SEQUENCE_CREATE_EDIT,
    Permissions.CONDUCTOR_LAUNCH,
    Permissions.CONDUCTOR_SYNC_OFFLINE,
  ],
  RECEPTIONIST: [
    Permissions.STAFF_VIEW,
    Permissions.STUDENT_CREATE,
    Permissions.STUDENT_EDIT_PROFILE,
    Permissions.BOOKING_CREATE,
    Permissions.ATTENDANCE_CHECK_IN,
    Permissions.MEMBERSHIP_ASSIGN,
    Permissions.BILLING_RECORD_PAYMENT,
  ],
};

export function hasPermission(role: UserRoleType, permission: PermissionType): boolean {
  const allowed = RolePermissionsMap[role];
  return allowed ? allowed.includes(permission) : false;
}
