'use client';

import { useEffect } from 'react';
import { Button } from '@yogaos/ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled web application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-bold text-stone-900">Something went wrong</h2>
      <p className="mt-2 text-stone-600">An unexpected error occurred in the studio portal.</p>
      {error.message && (
        <pre className="mt-4 rounded bg-stone-100 p-3 text-xs text-stone-700 max-w-lg overflow-auto">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex gap-4">
        <Button variant="primary" onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
