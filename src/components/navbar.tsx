"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, LayoutDashboard, QrCode, ScanLine, LogOut, PackageSearch } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generator", label: "Generator", icon: QrCode },
  { href: "/tracking", label: "Tracking", icon: PackageSearch },
  { href: "/scanner", label: "Scan", icon: ScanLine },
];

const AUTH_PATHS = ["/login", "/register"];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);

  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    try {
      setLoadingLogout(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Berhasil keluar dari sistem");
      router.push("/login");
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
        <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
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
      </div>
    </header>
  );
}
