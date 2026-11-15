import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/auth-context';
import { NavHeader } from '../components/nav-header';

export const metadata: Metadata = {
  title: 'YogaOS — Studio Management & Class Conductor',
  description: 'India-first, globally extensible SaaS platform for yoga studios and instructors',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <NavHeader />
          <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
