import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '@yogaos/ui';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">YogaOS Studio Platform</h1>
        <p className="text-stone-600">
          India-first Yoga Studio Management & Automated Class Conductor SaaS.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Studio Operations</CardTitle>
              <Badge variant="success">Phase 1 Foundation</Badge>
            </div>
            <CardDescription>Multi-branch and practice room administration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-stone-600">
              Manage branches, room capacities, staff, and student CRM.
            </p>
            <Button variant="outline" size="sm" className="w-full" disabled>
              Configure Branches (Phase 3)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Class Conductor</CardTitle>
              <Badge variant="warning">Offline-First Engine</Badge>
            </div>
            <CardDescription>Deterministic in-studio guided execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-stone-600">
              Pre-buffered media, wall-clock timers, voice cues, and offline sync.
            </p>
            <Button variant="outline" size="sm" className="w-full" disabled>
              Open Conductor (Phase 7)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>GST Invoicing</CardTitle>
              <Badge variant="default">Statutory India</Badge>
            </div>
            <CardDescription>Configurable GST and multi-mode billing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-stone-600">
              CGST/SGST/IGST splits, SAC 9992, and gapless sequential invoices.
            </p>
            <Button variant="outline" size="sm" className="w-full" disabled>
              View Billing (Phase 5)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">System Architecture Status</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-stone-100 bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500">API Gateway</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-800">NestJS + Fastify (:4000)</p>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500">Web Portal</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-800">Next.js 15 (:3000)</p>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500">Database</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-800">PostgreSQL 16 (Prisma)</p>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500">Worker Queue</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-800">Redis 7 + BullMQ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
