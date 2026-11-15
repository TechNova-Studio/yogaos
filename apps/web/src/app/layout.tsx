import type { Metadata } from 'next';
import './globals.css';

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
        <header className="sticky top-0 z-50 w-full border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-emerald-600" />
              <span className="font-semibold tracking-tight text-stone-900">YogaOS</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">V1 Baseline</span>
            </div>
            <nav className="flex items-center gap-4 text-sm font-medium text-stone-600">
              <span className="text-xs text-stone-400">Environment: Development</span>
            </nav>
          </div>
        </header>
        <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
