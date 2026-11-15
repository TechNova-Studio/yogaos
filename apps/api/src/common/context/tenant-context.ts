import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@yogaos/database';

export interface TenantContext {
  userId?: string;
  tenantId?: string;
  userRole?: UserRole;
  sessionId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

@Injectable()
export class TenantContextService {
  run<R>(context: TenantContext, callback: () => R): R {
    return asyncLocalStorage.run(context, callback);
  }

  get(): TenantContext {
    return asyncLocalStorage.getStore() || {};
  }

  getTenantId(): string | undefined {
    return asyncLocalStorage.getStore()?.tenantId;
  }

  getUserId(): string | undefined {
    return asyncLocalStorage.getStore()?.userId;
  }

  getUserRole(): UserRole | undefined {
    return asyncLocalStorage.getStore()?.userRole;
  }
}

export const tenantContext = new TenantContextService();
