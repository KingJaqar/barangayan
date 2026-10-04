import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

import { Toaster } from '@/components/ui/sonner';
import { ThemeControllerProvider, THEME_INIT_SCRIPT } from '@/components/theme/theme-controller';
import { AccentControllerProvider, ACCENT_INIT_SCRIPT } from '@/components/theme/accent-controller';
import { FontControllerProvider, FONT_INIT_SCRIPT } from '@/components/theme/font-controller';

export const metadata: Metadata = {
  title: {
    default: 'Barangayan',
    template: '%s | Barangayan',
  },
  description: 'Request documents, report incidents, and stay connected with your barangay.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="accent-init" strategy="beforeInteractive">
          {ACCENT_INIT_SCRIPT}
        </Script>
        <Script id="font-init" strategy="beforeInteractive">
          {FONT_INIT_SCRIPT}
        </Script>
      </head>
      <body className="flex h-full flex-col overflow-hidden">
        <ThemeControllerProvider>
          <AccentControllerProvider>
            <FontControllerProvider>
              {children}
              <Toaster />
            </FontControllerProvider>
          </AccentControllerProvider>
        </ThemeControllerProvider>
      </body>
    </html>
  );
}
