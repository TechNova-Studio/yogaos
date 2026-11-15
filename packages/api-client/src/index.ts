import { HealthCheckResponse, HealthCheckResponseSchema } from '@yogaos/contracts';

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

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  setAuthToken(authToken: string) {
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
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.message || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const data = await this.request<unknown>('/health');
    return HealthCheckResponseSchema.parse(data);
  }
}

export function createApiClient(baseUrl = 'http://localhost:4000/v1'): ApiClient {
  return new ApiClient({ baseUrl });
}
