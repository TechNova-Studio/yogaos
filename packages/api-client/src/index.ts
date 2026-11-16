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
}

let clientInstance: ApiClient | null = null;

export function getApiClient(baseUrl = 'http://localhost:4000/v1'): ApiClient {
  if (!clientInstance) {
    clientInstance = new ApiClient({ baseUrl });
  }
  return clientInstance;
}
