import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/navbar";

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
      <body className="min-h-full flex flex-col bg-slate-50 font-sans text-slate-900 antialiased selection:bg-red-500 selection:text-white">
        <Suspense
          fallback={
            <header className="sticky top-0 z-40 h-[65px] border-b border-slate-200 bg-white/80 backdrop-blur-md" />
          }
        >
          <Navbar />
        </Suspense>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
