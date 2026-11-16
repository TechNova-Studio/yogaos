import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { MembershipsModule } from './modules/memberships/memberships.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    OrganizationsModule,
    MembershipsModule,
    BranchesModule,
    RoomsModule,
    StudentsModule,
    LeadsModule,
    ClassesModule,
  ],
})
export class AppModule {}
