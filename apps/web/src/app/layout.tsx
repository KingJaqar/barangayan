import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";
import { ThemeControllerProvider, ThemeInitScript } from "@/components/ui/theme-controller";

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
        <ThemeInitScript />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeControllerProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeControllerProvider>
      </body>
    </html>
  );
}
