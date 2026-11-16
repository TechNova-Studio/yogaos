import {
  HealthCheckResponse,
  HealthCheckResponseSchema,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  AuthResponseSchema,
  CreateOrganizationRequest,
  OrganizationDetails,
  MembershipSummary,
  OrganizationMemberDetails,
  CreateBranchRequest,
  UpdateBranchRequest,
  BranchDetails,
  CreateRoomRequest,
  UpdateRoomRequest,
  RoomDetails,
  UpdateOrganizationSettingsRequest,
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentSummary,
  StudentDetails,
  StudentListQuery,
  StudentHealthDisclaimerInput,
  StudentConsentInput,
  StudentActivityDetails,
  CreateStudentNoteRequest,
  CreateLeadRequest,
  UpdateLeadRequest,
  LeadDetails,
  ConvertLeadRequest,
  LeadListQuery,
  CreateClassTypeRequest,
  UpdateClassTypeRequest,
  ClassTypeDetails,
  ClassTypeListQuery,
  CreateBatchRequest,
  UpdateBatchRequest,
  BatchDetails,
  BatchListQuery,
  SessionDetails,
  UpdateSessionInstanceRequest,
  CancelSessionInstanceRequest,
  SessionCalendarQuery,
  InstructorSummary,
  CreateBookingRequest,
  CancelBookingRequest,
  BookingDetails,
  BookingListQuery,
  JoinWaitlistRequest,
  WaitlistEntryDetails,
  MarkAttendanceRequest,
  AttendanceRecordDetails,
  SessionRoster,
  CreateMembershipPlanRequest,
  UpdateMembershipPlanRequest,
  MembershipPlanDetails,
  MembershipPlanListQuery,
  AssignStudentMembershipRequest,
  FreezeMembershipRequest,
  CancelMembershipRequest,
  StudentMembershipDetails,
  StudentMembershipListQuery,
  CreditLedgerEntryDetails,
  ManualCreditAdjustmentRequest,
  CreditLedgerListQuery,
  CheckBookingEligibilityQuery,
  MembershipEligibilityResult,
  OrganizationTaxSettings,
  UpdateOrganizationTaxSettingsRequest,
  CreateInvoiceRequest,
  TaxInvoiceDetails,
  InvoiceListQuery,
  RecordPaymentRequest,
  PaymentTransactionDetails,
  PaymentListQuery,
  ProcessRefundRequest,
  RefundRecordDetails,
  RefundListQuery,
  CreditNoteDetails,
  DailyCollectionSummary,
} from '@yogaos/contracts';

export interface ApiClientOptions {
  baseUrl: string;
  tenantId?: string;
  authToken?: string;
}

export class ApiClient {
  private baseUrl: string;
  private tenantId?: string;
  private authToken?: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.tenantId = options.tenantId;
    this.authToken = options.authToken;
  }

  setTenantId(tenantId?: string) {
    this.tenantId = tenantId;
  }

  setAuthToken(authToken?: string) {
    this.authToken = authToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);

    headers.set('Content-Type', 'application/json');
    if (this.tenantId) {
      headers.set('X-Tenant-ID', this.tenantId);
    }
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error?.message || errorBody?.message || `HTTP error ${response.status}`);
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const data = await this.request<unknown>('/health');
    return HealthCheckResponseSchema.parse(data);
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setAuthToken(res.token);
    return res;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setAuthToken(res.token);
    if (res.activeTenantId) {
      this.setTenantId(res.activeTenantId);
    }
    return res;
  }

  async logout(): Promise<void> {
    await this.request<void>('/auth/logout', { method: 'POST' });
    this.setAuthToken(undefined);
    this.setTenantId(undefined);
  }

  async getMe(): Promise<any> {
    return this.request('/auth/me');
  }

  async switchTenant(tenantId: string): Promise<{ activeTenantId: string; role: string }> {
    const res = await this.request<{ activeTenantId: string; role: string }>('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
    this.setTenantId(res.activeTenantId);
    return res;
  }

  async createOrganization(data: CreateOrganizationRequest): Promise<OrganizationDetails> {
    return this.request<OrganizationDetails>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrganizations(): Promise<MembershipSummary[]> {
    return this.request<MembershipSummary[]>('/organizations');
  }

  async getMembers(): Promise<OrganizationMemberDetails[]> {
    return this.request<OrganizationMemberDetails[]>('/organizations/members');
  }

  // --------------------------------------------------------------------------
  // Studio & Organization Settings
  // --------------------------------------------------------------------------
  async getOrganizationSettings(): Promise<OrganizationDetails & { panNumber?: string; settings?: Record<string, any> }> {
    return this.request('/organizations/current');
  }

  async updateOrganizationSettings(data: UpdateOrganizationSettingsRequest): Promise<void> {
    return this.request('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // --------------------------------------------------------------------------
  // Branches
  // --------------------------------------------------------------------------
  async getBranches(): Promise<BranchDetails[]> {
    return this.request<BranchDetails[]>('/branches');
  }

  async getBranch(id: string): Promise<BranchDetails> {
    return this.request<BranchDetails>(`/branches/${id}`);
  }

  async createBranch(data: CreateBranchRequest): Promise<BranchDetails> {
    return this.request<BranchDetails>('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBranch(id: string, data: UpdateBranchRequest): Promise<BranchDetails> {
    return this.request<BranchDetails>(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBranch(id: string): Promise<void> {
    return this.request<void>(`/branches/${id}`, { method: 'DELETE' });
  }

  // --------------------------------------------------------------------------
  // Rooms
  // --------------------------------------------------------------------------
  async getRooms(branchId?: string): Promise<RoomDetails[]> {
    const query = branchId ? `?branchId=${branchId}` : '';
    return this.request<RoomDetails[]>(`/rooms${query}`);
  }

  async createRoom(data: CreateRoomRequest): Promise<RoomDetails> {
    return this.request<RoomDetails>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoom(id: string, data: UpdateRoomRequest): Promise<RoomDetails> {
    return this.request<RoomDetails>(`/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRoom(id: string): Promise<void> {
    return this.request<void>(`/rooms/${id}`, { method: 'DELETE' });
  }

  // --------------------------------------------------------------------------
  // Students & Privacy
  // --------------------------------------------------------------------------
  async getStudents(query?: StudentListQuery): Promise<{ students: StudentSummary[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.branchId) params.set('branchId', query.branchId);
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/students${qs}`);
  }

  async getStudent(id: string): Promise<StudentDetails> {
    return this.request<StudentDetails>(`/students/${id}`);
  }

  async createStudent(data: CreateStudentRequest): Promise<StudentDetails> {
    return this.request<StudentDetails>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, data: UpdateStudentRequest): Promise<StudentDetails> {
    return this.request<StudentDetails>(`/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateStudentHealth(id: string, data: StudentHealthDisclaimerInput): Promise<void> {
    return this.request<void>(`/students/${id}/health`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordStudentConsent(id: string, data: StudentConsentInput): Promise<void> {
    return this.request<void>(`/students/${id}/consent`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStudentTimeline(id: string): Promise<StudentActivityDetails[]> {
    return this.request<StudentActivityDetails[]>(`/students/${id}/timeline`);
  }

  async addStudentNote(id: string, data: CreateStudentNoteRequest): Promise<StudentActivityDetails> {
    return this.request<StudentActivityDetails>(`/students/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --------------------------------------------------------------------------
  // Leads & Pipeline
  // --------------------------------------------------------------------------
  async getLeads(query?: LeadListQuery): Promise<{ leads: LeadDetails[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.branchId) params.set('branchId', query.branchId);
    if (query?.status) params.set('status', query.status);
    if (query?.source) params.set('source', query.source);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/leads${qs}`);
  }

  async getLead(id: string): Promise<LeadDetails> {
    return this.request<LeadDetails>(`/leads/${id}`);
  }

  async createLead(data: CreateLeadRequest): Promise<LeadDetails> {
    return this.request<LeadDetails>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: UpdateLeadRequest): Promise<LeadDetails> {
    return this.request<LeadDetails>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async convertLead(id: string, data: ConvertLeadRequest): Promise<{ studentId: string; message: string }> {
    return this.request<{ studentId: string; message: string }>(`/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --------------------------------------------------------------------------
  // Class Types / Programs
  // --------------------------------------------------------------------------
  async getClassTypes(query?: ClassTypeListQuery): Promise<{ classTypes: ClassTypeDetails[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.category) params.set('category', query.category);
    if (query?.level) params.set('level', query.level);
    if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/classes/types${qs}`);
  }

  async getClassType(id: string): Promise<ClassTypeDetails> {
    return this.request<ClassTypeDetails>(`/classes/types/${id}`);
  }

  async createClassType(data: CreateClassTypeRequest): Promise<ClassTypeDetails> {
    return this.request<ClassTypeDetails>('/classes/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClassType(id: string, data: UpdateClassTypeRequest): Promise<ClassTypeDetails> {
    return this.request<ClassTypeDetails>(`/classes/types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async archiveClassType(id: string): Promise<void> {
    return this.request<void>(`/classes/types/${id}`, { method: 'DELETE' });
  }

  // --------------------------------------------------------------------------
  // Batches & Class Groups
  // --------------------------------------------------------------------------
  async getBatches(query?: BatchListQuery): Promise<{ batches: BatchDetails[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.branchId) params.set('branchId', query.branchId);
    if (query?.classTypeId) params.set('classTypeId', query.classTypeId);
    if (query?.instructorId) params.set('instructorId', query.instructorId);
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/classes/batches${qs}`);
  }

  async getBatch(id: string): Promise<BatchDetails> {
    return this.request<BatchDetails>(`/classes/batches/${id}`);
  }

  async createBatch(data: CreateBatchRequest): Promise<BatchDetails> {
    return this.request<BatchDetails>('/classes/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBatch(id: string, data: UpdateBatchRequest): Promise<BatchDetails> {
    return this.request<BatchDetails>(`/classes/batches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async archiveBatch(id: string): Promise<void> {
    return this.request<void>(`/classes/batches/${id}`, { method: 'DELETE' });
  }

  async generateBatchSessions(batchId: string, upToDate: string): Promise<{ generatedCount: number; message: string }> {
    return this.request<{ generatedCount: number; message: string }>(`/classes/batches/${batchId}/generate-sessions`, {
      method: 'POST',
      body: JSON.stringify({ upToDate }),
    });
  }

  // --------------------------------------------------------------------------
  // Scheduling & Calendar Sessions
  // --------------------------------------------------------------------------
  async getSessions(query: SessionCalendarQuery): Promise<SessionDetails[]> {
    const params = new URLSearchParams();
    params.set('startDate', query.startDate);
    params.set('endDate', query.endDate);
    if (query.branchId) params.set('branchId', query.branchId);
    if (query.roomId) params.set('roomId', query.roomId);
    if (query.instructorId) params.set('instructorId', query.instructorId);
    if (query.classTypeId) params.set('classTypeId', query.classTypeId);
    if (query.status) params.set('status', query.status);
    return this.request<SessionDetails[]>(`/classes/sessions?${params.toString()}`);
  }

  async getSession(id: string): Promise<SessionDetails> {
    return this.request<SessionDetails>(`/classes/sessions/${id}`);
  }

  async updateSession(id: string, data: UpdateSessionInstanceRequest): Promise<SessionDetails> {
    return this.request<SessionDetails>(`/classes/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async cancelSession(id: string, data: CancelSessionInstanceRequest): Promise<SessionDetails> {
    return this.request<SessionDetails>(`/classes/sessions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --------------------------------------------------------------------------
  // Instructors Lookup
  // --------------------------------------------------------------------------
  async getInstructors(): Promise<InstructorSummary[]> {
    return this.request<InstructorSummary[]>('/classes/sessions/instructors');
  }

  // --------------------------------------------------------------------------
  // P10: Bookings, Waitlists & Attendance
  // --------------------------------------------------------------------------
  async getBookings(query?: BookingListQuery): Promise<{ bookings: BookingDetails[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (query?.sessionInstanceId) params.set('sessionInstanceId', query.sessionInstanceId);
    if (query?.studentId) params.set('studentId', query.studentId);
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/bookings${qs}`);
  }

  async getBooking(id: string): Promise<BookingDetails> {
    return this.request<BookingDetails>(`/bookings/${id}`);
  }

  async createBooking(data: CreateBookingRequest): Promise<BookingDetails> {
    return this.request<BookingDetails>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelBooking(id: string, data?: CancelBookingRequest): Promise<BookingDetails> {
    return this.request<BookingDetails>(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async joinWaitlist(data: JoinWaitlistRequest): Promise<WaitlistEntryDetails> {
    return this.request<WaitlistEntryDetails>('/bookings/waitlist', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelWaitlist(id: string): Promise<void> {
    return this.request<void>(`/bookings/waitlist/${id}/cancel`, {
      method: 'POST',
    });
  }

  async promoteWaitlistEntry(id: string): Promise<BookingDetails> {
    return this.request<BookingDetails>(`/bookings/waitlist/${id}/promote`, {
      method: 'POST',
    });
  }

  async getSessionRoster(sessionId: string): Promise<SessionRoster> {
    return this.request<SessionRoster>(`/bookings/roster/${sessionId}`);
  }

  async markAttendance(bookingId: string, data: MarkAttendanceRequest): Promise<AttendanceRecordDetails> {
    return this.request<AttendanceRecordDetails>(`/bookings/${bookingId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStudentBookings(studentId: string): Promise<BookingDetails[]> {
    return this.request<BookingDetails[]>(`/bookings/student/${studentId}`);
  }

  // Memberships & Plans
  async getMembershipPlans(query?: MembershipPlanListQuery): Promise<MembershipPlanDetails[]> {
    const params = new URLSearchParams();
    if (query?.planType) params.append('planType', query.planType);
    if (query?.isActive !== undefined) params.append('isActive', String(query.isActive));
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<MembershipPlanDetails[]>(`/memberships/plans${qs}`);
  }

  async getMembershipPlan(id: string): Promise<MembershipPlanDetails> {
    return this.request<MembershipPlanDetails>(`/memberships/plans/${id}`);
  }

  async createMembershipPlan(data: CreateMembershipPlanRequest): Promise<MembershipPlanDetails> {
    return this.request<MembershipPlanDetails>('/memberships/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMembershipPlan(id: string, data: UpdateMembershipPlanRequest): Promise<MembershipPlanDetails> {
    return this.request<MembershipPlanDetails>(`/memberships/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async archiveMembershipPlan(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/memberships/plans/${id}`, {
      method: 'DELETE',
    });
  }

  async assignStudentMembership(data: AssignStudentMembershipRequest): Promise<StudentMembershipDetails> {
    return this.request<StudentMembershipDetails>('/memberships/student-memberships', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStudentMemberships(query?: StudentMembershipListQuery): Promise<StudentMembershipDetails[]> {
    const params = new URLSearchParams();
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.status) params.append('status', query.status);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<StudentMembershipDetails[]>(`/memberships/student-memberships${qs}`);
  }

  async getStudentMembership(id: string): Promise<StudentMembershipDetails> {
    return this.request<StudentMembershipDetails>(`/memberships/student-memberships/${id}`);
  }

  async freezeStudentMembership(id: string, data: FreezeMembershipRequest): Promise<StudentMembershipDetails> {
    return this.request<StudentMembershipDetails>(`/memberships/student-memberships/${id}/freeze`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unfreezeStudentMembership(id: string): Promise<StudentMembershipDetails> {
    return this.request<StudentMembershipDetails>(`/memberships/student-memberships/${id}/unfreeze`, {
      method: 'POST',
    });
  }

  async cancelStudentMembership(id: string, data: CancelMembershipRequest): Promise<StudentMembershipDetails> {
    return this.request<StudentMembershipDetails>(`/memberships/student-memberships/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCreditLedger(query?: CreditLedgerListQuery): Promise<CreditLedgerEntryDetails[]> {
    const params = new URLSearchParams();
    if (query?.studentMembershipId) params.append('studentMembershipId', query.studentMembershipId);
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<CreditLedgerEntryDetails[]>(`/memberships/credit-ledger${qs}`);
  }

  async adjustCreditsManually(membershipId: string, data: ManualCreditAdjustmentRequest): Promise<CreditLedgerEntryDetails> {
    return this.request<CreditLedgerEntryDetails>(`/memberships/student-memberships/${membershipId}/adjust-credits`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkStudentEligibility(studentId: string, sessionInstanceId: string): Promise<MembershipEligibilityResult> {
    return this.request<MembershipEligibilityResult>(`/memberships/eligibility?studentId=${studentId}&sessionInstanceId=${sessionInstanceId}`);
  }

  // Billing, Invoicing & GST
  async getTaxSettings(): Promise<OrganizationTaxSettings> {
    return this.request<OrganizationTaxSettings>('/billing/settings/tax');
  }

  async updateTaxSettings(data: UpdateOrganizationTaxSettingsRequest): Promise<OrganizationTaxSettings> {
    return this.request<OrganizationTaxSettings>('/billing/settings/tax', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<TaxInvoiceDetails> {
    return this.request<TaxInvoiceDetails>('/billing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInvoices(query?: InvoiceListQuery): Promise<TaxInvoiceDetails[]> {
    const params = new URLSearchParams();
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.status) params.append('status', query.status);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<TaxInvoiceDetails[]>(`/billing/invoices${qs}`);
  }

  async getInvoice(id: string): Promise<TaxInvoiceDetails> {
    return this.request<TaxInvoiceDetails>(`/billing/invoices/${id}`);
  }

  async voidInvoice(id: string, reason: string): Promise<TaxInvoiceDetails> {
    return this.request<TaxInvoiceDetails>(`/billing/invoices/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async recordPayment(data: RecordPaymentRequest): Promise<PaymentTransactionDetails> {
    return this.request<PaymentTransactionDetails>('/billing/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPayments(query?: PaymentListQuery): Promise<PaymentTransactionDetails[]> {
    const params = new URLSearchParams();
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.invoiceId) params.append('invoiceId', query.invoiceId);
    if (query?.paymentMode) params.append('paymentMode', query.paymentMode);
    if (query?.status) params.append('status', query.status);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<PaymentTransactionDetails[]>(`/billing/payments${qs}`);
  }

  async getPayment(id: string): Promise<PaymentTransactionDetails> {
    return this.request<PaymentTransactionDetails>(`/billing/payments/${id}`);
  }

  async getStudentPayments(studentId: string): Promise<PaymentTransactionDetails[]> {
    return this.request<PaymentTransactionDetails[]>(`/billing/payments/student/${studentId}`);
  }

  async processRefund(data: ProcessRefundRequest): Promise<RefundRecordDetails> {
    return this.request<RefundRecordDetails>('/billing/refunds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRefunds(query?: RefundListQuery): Promise<RefundRecordDetails[]> {
    const params = new URLSearchParams();
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.paymentTransactionId) params.append('paymentTransactionId', query.paymentTransactionId);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<RefundRecordDetails[]>(`/billing/refunds${qs}`);
  }

  async getCreditNotes(invoiceId?: string): Promise<CreditNoteDetails[]> {
    const qs = invoiceId ? `?invoiceId=${invoiceId}` : '';
    return this.request<CreditNoteDetails[]>(`/billing/credit-notes${qs}`);
  }

  async getDailyCollections(date?: string): Promise<DailyCollectionSummary> {
    const qs = date ? `?date=${date}` : '';
    return this.request<DailyCollectionSummary>(`/billing/summary/daily${qs}`);
  }
}

let clientInstance: ApiClient | null = null;

export function getApiClient(baseUrl = 'http://localhost:4000/v1'): ApiClient {
  if (!clientInstance) {
    clientInstance = new ApiClient({ baseUrl });
  }
  return clientInstance;
}
