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
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { StudentPlansModule } from './modules/student-plans/student-plans.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { AsanaModule } from './modules/asana/asana.module.js';
import { SequencesModule } from './modules/sequences/sequences.module.js';
import { ConductorModule } from './modules/conductor/conductor.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';

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
    BookingsModule,
    StudentPlansModule,
    BillingModule,
    MediaModule,
    AsanaModule,
    SequencesModule,
    ConductorModule,
    DashboardModule,
  ],
})
export class AppModule {}
