"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Box,
  Home,
  Layers,
  LayoutDashboard,
  QrCode,
  LogOut,
  LogIn,
  PackageSearch,
  ScanLine,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HOME_NAV = [{ href: "/", label: "Beranda", icon: Home }];

// Modul khusus staf yang sudah login.
const STAFF_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generator", label: "Generator", icon: QrCode },
];

// Modul tracking yang butuh login.
const AUTHED_NAV = [
  { href: "/tracking", label: "Packages", icon: PackageSearch },
];

// Scanner publik: scan / input serial lalu langsung ke detail produk.
const PUBLIC_SCAN_NAV = [{ href: "/scan", label: "Track", icon: ScanLine }];

// Modul operasional (binding & in/out) khusus staf.
const STAFF_SCAN_NAV = [
  { href: "/scanner", label: "Binding", icon: Layers },
  { href: "/in-out", label: "In/Out", icon: ArrowLeftRight },
];

const AUTH_PATHS = ["/login", "/register"];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loadingLogout, setLoadingLogout] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setRole(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (active) setRole((data?.role as string | null) ?? null);
      });

    return () => {
      active = false;
    };
  }, [userId, supabase]);

  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return null;
  }

  const isStaff = role === "staff" || role === "admin";
  const navItems = [
    ...HOME_NAV,
    ...(isStaff ? STAFF_NAV : []),
    ...(userId ? AUTHED_NAV : []),
    ...PUBLIC_SCAN_NAV,
    ...(isStaff ? STAFF_SCAN_NAV : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    try {
      setLoadingLogout(true);
      await supabase.auth.signOut();
      toast.success("Berhasil keluar dari sistem");
      router.push("/");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan.";
      toast.error("Gagal keluar", { description: message });
    } finally {
      setLoadingLogout(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm">
            <Box className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-black tracking-tight text-slate-900">
              Teem.id Tracking
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Internal Supply Chain
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 bg-slate-100/70 border border-slate-200 rounded-2xl p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  active
                    ? "bg-white text-red-600 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {userId ? (
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            disabled={loadingLogout}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-2 font-semibold text-xs shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">
              {loadingLogout ? "Keluar..." : "Keluar"}
            </span>
          </Button>
        ) : (
          <Link href="/login" className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-2 font-semibold text-xs"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
