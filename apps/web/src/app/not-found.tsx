import Link from 'next/link';
import { Button } from '@yogaos/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-stone-900">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-stone-700">Page Not Found</h2>
      <p className="mt-2 text-stone-500">The requested studio page or resource could not be found.</p>
      <div className="mt-6">
        <Link href="/">
          <Button variant="primary">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
