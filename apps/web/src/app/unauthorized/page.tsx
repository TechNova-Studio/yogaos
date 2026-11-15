import Link from 'next/link';
import { Button } from '@yogaos/ui';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-stone-900">403</h1>
      <h2 className="mt-4 text-xl font-semibold text-stone-700">Access Denied</h2>
      <p className="mt-2 text-stone-500 max-w-md">
        You do not have the required role or permissions within this studio organization to access this resource.
      </p>
      <div className="mt-6 flex gap-4">
        <Link href="/dashboard">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
