"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Box,
  ChevronDown,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Package,
  PackageSearch,
  QrCode,
  ScanLine,
  ShieldCheck,
  X,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

// Beranda sengaja tidak dimasukkan: staf langsung masuk ke area kerja.
const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generator", label: "Generator", icon: QrCode },
  { href: "/label", label: "Label", icon: Tag },
  { href: "/track", label: "Track", icon: ScanLine },
  { href: "/binding", label: "Binding", icon: Layers },
  { href: "/in-out", label: "In/Out", icon: ArrowLeftRight },
];

// Produk & satuan dikelompokkan dalam satu menu dropdown.
const ADMIN_GROUPS: NavGroup[] = [
  {
    id: "products",
    label: "Products",
    icon: Package,
    children: [
      { href: "/admin/products", label: "Daftar Produk", icon: PackageSearch },
      { href: "/admin/units", label: "Units", icon: Layers },
    ],
  },
];

// Menu khusus admin.
const ADMIN_NAV: NavItem[] = [
  { href: "/admin/locations", label: "Locations", icon: MapPin },
];

interface StaffSidebarProps {
  open: boolean;
  onClose: () => void;
  role: string | null;
}

export function StaffSidebar({ open, onClose, role }: StaffSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Buka otomatis grup yang memuat halaman aktif, tanpa effect/setState.
  const toggleGroup = (id: string, currentOpen: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !currentOpen }));

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 border px-3 py-2.5 text-[11px] font-bold tracking-wide uppercase transition-colors",
          active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  const handleLogout = async () => {
    try {
      setLoadingLogout(true);
      await supabase.auth.signOut();
      toast.success("Berhasil keluar dari sistem");
      onClose();
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
    <>
      {/* Overlay untuk mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-300 bg-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-[65px] shrink-0 items-center justify-between border-b border-slate-300 px-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 text-white">
              <Box className="h-5 w-5" />
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

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigasi */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pt-1 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
            Menu Staf
          </p>

          {STAFF_NAV.map(renderNavItem)}

          {role === "admin" && (
            <>
              <p className="px-3 pt-4 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                Menu Admin
              </p>

              {ADMIN_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const groupActive = group.children.some((child) =>
                  isActive(child.href)
                );
                // Default terbuka jika grup memuat halaman aktif.
                const isOpen = openGroups[group.id] ?? groupActive;

                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id, isOpen)}
                      aria-expanded={isOpen}
                      className={cn(
                        "flex w-full items-center gap-3 border px-3 py-2.5 text-[11px] font-bold tracking-wide uppercase transition-colors",
                        groupActive
                          ? "border-slate-300 bg-slate-50 text-slate-900"
                          : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="space-y-1 border-l border-slate-300 pl-2">
                        {group.children.map(renderNavItem)}
                      </div>
                    )}
                  </div>
                );
              })}

              {ADMIN_NAV.map(renderNavItem)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 space-y-2 border-t border-slate-300 p-3">
          <div className="flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                Sesi Aktif
              </p>
              <p className="truncate text-[11px] font-bold text-slate-700">
                {role === "admin" ? "Administrator" : "Login sebagai staf"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loadingLogout}
            className="flex h-10 w-full items-center justify-center gap-2 border border-slate-300 text-[11px] font-bold tracking-wide text-slate-700 uppercase transition-colors hover:bg-slate-100 disabled:opacity-60"
          >
            {loadingLogout ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {loadingLogout ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </aside>
    </>
  );
}
