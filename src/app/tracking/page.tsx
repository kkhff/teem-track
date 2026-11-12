"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Box, Loader2, Layers, Package, ScanLine } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BarcodeLabel } from "@/components/barcode-label";

interface PackageItem {
  id: string;
  serial_number: string;
  level: "karton" | "bal" | "slop";
  code_type: "qr" | "barcode";
  status: string;
  current_location_id: string | null;
  parent_id: string | null;
  parent_serial: string | null;
  current_children_count: number;
  max_capacity: number;
}

const isUnassigned = (item: PackageItem) =>
  item.level !== "karton" && !item.parent_id;
const isAssigned = (item: PackageItem) => Boolean(item.parent_id);
const hasSlot = (item: PackageItem) =>
  item.max_capacity > 0 && item.current_children_count < item.max_capacity;
const isFull = (item: PackageItem) =>
  item.max_capacity > 0 && item.current_children_count >= item.max_capacity;

export default function PackageTrackingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageItem[]>([]);

  const loadPackages = useCallback(async (term: string, levelFilter: string, signal?: AbortSignal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (term.trim()) params.append("q", term.trim());
      if (levelFilter !== "all") params.append("level", levelFilter);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/tracking${queryString}`, { signal });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Gagal memuat data paket.");
      }

      setPackages(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;

      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.";
      console.error("Gagal melacak paket:", err);
      toast.error(message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Debounce: pencarian dan filter otomatis merespons
  useEffect(() => {
    const controller = new AbortController();
    const delay = searchQuery.trim() ? 400 : 0;

    const timer = setTimeout(() => {
      loadPackages(searchQuery, selectedLevel, controller.signal);
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedLevel, loadPackages]);

  // Fungsi helper untuk warna badge level
  const getBadgeStyle = (level: string) => {
    switch (level) {
      case "karton": return "bg-red-600 text-white";
      case "bal": return "bg-amber-500 text-white";
      default: return "bg-slate-700 text-white";
    }
  };

  const getCapacityInfo = (item: PackageItem) => {
    if (item.max_capacity <= 0) return null;

    const isFull = item.current_children_count >= item.max_capacity;
    const remaining = Math.max(item.max_capacity - item.current_children_count, 0);

    return {
      isFull,
      label: isFull ? "Full" : `Sisa ${remaining}`,
      detail: `${item.current_children_count}/${item.max_capacity}`,
    };
  };

  const getParentInfo = (item: PackageItem) => {
    if (item.parent_id) {
      return {
        text: `Masuk: ${item.parent_serial ?? "Induk"}`,
        tone: "text-emerald-600",
      };
    }
    if (item.level === "karton") return null;
    return {
      text: item.level === "bal" ? "Belum masuk Karton" : "Belum masuk Bal",
      tone: "text-amber-600",
    };
  };

  const statusFilters = useMemo(
    () => [
      { label: "Semua", value: "all", count: packages.length },
      {
        label: "Belum Masuk",
        value: "unassigned",
        count: packages.filter(isUnassigned).length,
      },
      {
        label: "Masih Ada Slot",
        value: "available",
        count: packages.filter(hasSlot).length,
      },
      {
        label: "Sudah Masuk",
        value: "assigned",
        count: packages.filter(isAssigned).length,
      },
      {
        label: "Sudah Lengkap",
        value: "full",
        count: packages.filter(isFull).length,
      },
    ],
    [packages]
  );

  const visiblePackages = useMemo(() => {
    switch (selectedStatus) {
      case "unassigned":
        return packages.filter(isUnassigned);
      case "available":
        return packages.filter(hasSlot);
      case "assigned":
        return packages.filter(isAssigned);
      case "full":
        return packages.filter(isFull);
      default:
        return packages;
    }
  }, [packages, selectedStatus]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* Header Sederhana Tanpa Navbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Packages</h1>
            <p className="text-xs text-slate-500 font-medium">Lacak seluruh inventaris kode (Karton, Bal, hingga Slop)</p>
          </div>

          <Link href="/scan">
            <Button className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-2 shadow-md shadow-red-600/20">
              <ScanLine className="w-4 h-4" /> Track Kode
            </Button>
          </Link>
        </div>

        {/* Filter Level & Search Bar Card */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-5 space-y-4">
          
          {/* Tombol Filter Level */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Semua", value: "all" },
              { label: "Karton", value: "karton" },
              { label: "Bal", value: "bal" },
              { label: "Slop", value: "slop" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedLevel(tab.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                  selectedLevel === tab.value
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tombol Filter Status */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Filter Status
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {statusFilters.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border ${
                    selectedStatus === tab.value
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari nomor seri (cth: CRT-..., BAL-..., SLP-...)"
              className="pl-10 pr-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:ring-red-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {loading && (
              <Loader2 className="absolute right-3.5 top-3.5 w-4 h-4 animate-spin text-slate-400" />
            )}
          </div>
        </Card>

        {/* Daftar Hasil Paket */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider px-1">
            Daftar Paket / Kode ({visiblePackages.length})
          </h2>

          {loading && packages.length === 0 ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                Memuat data paket...
              </div>
            </Card>
          ) : visiblePackages.length === 0 ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Box className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Tidak ada data paket ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian, filter level, atau filter status.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {visiblePackages.map((item) => {
                const LevelIcon =
                  item.level === "karton" ? Box : item.level === "bal" ? Layers : Package;
                const capacity = getCapacityInfo(item);
                const parentInfo = getParentInfo(item);

                return (
                  <Card
                    key={item.id}
                    onClick={() => {
                      if (item.level === "karton") router.push(`/tracking/${item.id}`);
                      else if (item.level === "bal") router.push(`/tracking/bal/${item.id}`);
                      else router.push(`/tracking/slop/${item.id}`);
                    }}
                    className="aspect-square bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:border-red-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="h-full p-2.5 flex flex-col items-center justify-between gap-1.5">
                      <div className="flex w-full flex-1 min-h-0 items-center justify-center">
                        {item.code_type === "barcode" ? (
                          <BarcodeLabel value={item.serial_number} height={32} />
                        ) : (
                          <div className="aspect-square h-full max-h-20 [&>svg]:h-full [&>svg]:w-full">
                            <QRCodeSVG value={item.serial_number} size={80} level="M" />
                          </div>
                        )}
                      </div>

                      <div className="w-full space-y-1 text-center">
                        <p
                          className="truncate text-[10px] font-black leading-tight text-slate-900"
                          title={item.serial_number}
                        >
                          {item.serial_number}
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${getBadgeStyle(item.level)}`}
                          >
                            <LevelIcon className="w-2.5 h-2.5" />
                            {item.level}
                          </span>

                          {capacity && (
                            <span
                              title={`Kapasitas: ${capacity.detail}`}
                              className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                                capacity.isFull
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {capacity.label}
                            </span>
                          )}
                        </div>

                        {parentInfo && (
                          <p className={`text-[9px] font-bold truncate ${parentInfo.tone}`} title={parentInfo.text}>
                            {parentInfo.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}