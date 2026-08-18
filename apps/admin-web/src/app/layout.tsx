import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";
import { ThemeControllerProvider, THEME_INIT_SCRIPT } from "@/components/ui/theme-controller";
import { AccentControllerProvider, ACCENT_INIT_SCRIPT } from "@/components/ui/accent-controller";
import { FontControllerProvider, FONT_INIT_SCRIPT } from "@/components/ui/font-controller";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Barangayan Admin",
    template: "%s | Barangayan Admin",
  },
  description: "Admin dashboard for managing barangay services, requests, and residents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
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
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeControllerProvider>
          <AccentControllerProvider>
            <FontControllerProvider>
              <ToastProvider>{children}</ToastProvider>
            </FontControllerProvider>
          </AccentControllerProvider>
        </ThemeControllerProvider>
      </body>
    </html>
  );
}
