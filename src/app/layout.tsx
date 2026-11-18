import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Teem.id Tracking",
  description: "Internal Supply Chain & Package Tracking System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-slate-100 font-sans text-slate-900 antialiased">
        <Suspense
          fallback={
            <>
              <header className="sticky top-0 z-40 h-[65px] border-b border-slate-300 bg-white" />
              <div className="flex-1 flex flex-col">{children}</div>
            </>
          }
        >
          <AppShell>{children}</AppShell>
        </Suspense>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
