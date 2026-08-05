import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { EnvironmentBanner } from '@studdy/design-system';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: {
    default: 'Studdy — The platform for better tutoring',
    template: '%s · Studdy',
  },
  description:
    'Studdy helps families find trusted tutors and gives tutors, parents and students a clearer view of lessons, homework and learning progress.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const environment = process.env.NEXT_PUBLIC_STUDDY_ENVIRONMENT ?? 'local';
  return (
    <html lang="en-NZ" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <EnvironmentBanner environment={environment} />
        {children}
      </body>
    </html>
  );
}
