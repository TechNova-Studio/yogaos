import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { MembershipsModule } from './modules/memberships/memberships.module.js';

@Module({
  imports: [HealthModule, AuthModule, OrganizationsModule, MembershipsModule],
})
export class AppModule {}
