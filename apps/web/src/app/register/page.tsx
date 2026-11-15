'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@yogaos/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@yogaos/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const client = getApiClient();
      await client.register({
        fullName,
        email,
        phone: phone || undefined,
        password,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your YogaOS Identity</CardTitle>
          <CardDescription>
            One global account to manage your studios or conduct classes across studios.
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
              <label className="text-xs font-medium text-stone-700">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Acharya Vikram Joshi"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vikram@yoga.in"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">Mobile Phone (+91)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700">Password (8+ chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <Button variant="primary" type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <p className="text-center text-xs text-stone-500 mt-4">
              Already have an account?{' '}
              <Link href="/login" className="text-emerald-700 font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
