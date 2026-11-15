'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@yogaos/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In to YogaOS</CardTitle>
          <CardDescription>
            Enter your email and password to access your studio workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@studio.in"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <Button variant="primary" type="submit" className="w-full" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>

            <p className="text-center text-xs text-stone-500 mt-4">
              Don't have an account?{' '}
              <Link href="/register" className="text-emerald-700 font-medium hover:underline">
                Register as Studio Owner or Teacher
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
