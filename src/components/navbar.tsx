"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  Home,
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

// Modul tracking yang butuh login (non-staf).
const AUTHED_NAV = [
  { href: "/package", label: "Packages", icon: PackageSearch },
];

// Scanner hanya untuk pengguna yang sudah login.
const SCAN_NAV = [{ href: "/track", label: "Track", icon: ScanLine }];

interface NavbarProps {
  userId: string | null;
}

export function Navbar({ userId }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loadingLogout, setLoadingLogout] = useState(false);

  // Guest hanya melihat Beranda; tracking cepat tersedia di halaman Beranda.
  const navItems = userId
    ? [...HOME_NAV, ...AUTHED_NAV, ...SCAN_NAV]
    : HOME_NAV;

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
    <header className="sticky top-0 z-40 border-b border-slate-300 bg-white">
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-6",
          pathname === "/" && "mx-auto max-w-7xl"
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-slate-900 bg-slate-900 text-white">
            <Box className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold tracking-tight text-slate-900">
              Teem.id Tracking
            </p>
            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
              Internal Supply Chain
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5 border border-slate-300 bg-slate-50 p-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
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
            className="shrink-0 gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {loadingLogout ? "Keluar..." : "Keluar"}
            </span>
          </Button>
        ) : (
          <Link href="/login" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
