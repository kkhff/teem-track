"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Menu } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { StaffSidebar } from "@/components/staff-sidebar";

const AUTH_PATHS = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const resolveUser = async (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);

      if (!nextUserId) {
        setRole(null);
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", nextUserId)
        .maybeSingle();

      if (!active) return;
      setRole((data?.role as string | null) ?? null);
      setReady(true);
    };

    supabase.auth.getUser().then(({ data }) => {
      void resolveUser(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setReady(false);
      setSidebarOpen(false);
      void resolveUser(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Halaman login/register tidak memakai shell navigasi.
  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  // Tunggu status auth sebelum menentukan tampilan supaya staf tidak
  // sempat melihat navbar guest.
  if (!ready) {
    return (
      <>
        <header className="sticky top-0 z-40 h-[65px] border-b border-slate-300 bg-white" />
        <div className="flex-1 flex flex-col">{children}</div>
      </>
    );
  }

  const isStaff = role === "staff" || role === "admin";

  if (isStaff) {
    return (
      <>
        <StaffSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          role={role}
        />

        {/* Top bar mobile; di desktop navigasi sepenuhnya di sidebar. */}
        <header className="sticky top-0 z-30 flex h-[65px] items-center gap-3 border-b border-slate-300 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 text-white">
              <Box className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-slate-900">
                Teem.id Tracking
              </p>
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                Staff Panel
              </p>
            </div>
          </Link>
        </header>

        <div className="flex-1 flex flex-col lg:pl-64">{children}</div>
      </>
    );
  }

  return (
    <>
      <Navbar userId={userId} />
      <div className="flex-1 flex flex-col">{children}</div>
    </>
  );
}
