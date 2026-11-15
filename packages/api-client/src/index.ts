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
}

let clientInstance: ApiClient | null = null;

export function getApiClient(baseUrl = 'http://localhost:4000/v1'): ApiClient {
  if (!clientInstance) {
    clientInstance = new ApiClient({ baseUrl });
  }
  return clientInstance;
}
