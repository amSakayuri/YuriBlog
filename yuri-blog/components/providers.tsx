'use client';
import { PublicMotion } from '@/components/public/motion';
import { ThemeProvider } from 'next-themes';
export function Providers({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
    >
      <PublicMotion />
      {children}
    </ThemeProvider>
  );
}
