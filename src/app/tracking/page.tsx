"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Box, Loader2, ArrowRight } from "lucide-react";

interface PackageItem {
  id: string;
  serial_number: string;
  level: "karton" | "bal" | "slop";
  status: string;
  current_location_id: string | null;
  parent_id: string | null;
}

export default function PackageTrackingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [kartonResults, setKartonResults] = useState<PackageItem[]>([]);

  const loadKartons = useCallback(async (term: string, notify = false) => {
    try {
      setLoading(true);
      const params = term.trim() ? `?q=${encodeURIComponent(term.trim())}` : "";
      const res = await fetch(`/api/tracking${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Gagal memuat data paket.");
      }

      setKartonResults(data);

      if (notify && data.length === 0) {
        toast.info("Tidak ada paket ditemukan dengan nomor seri tersebut.");
      } else if (notify) {
        toast.success(`Ditemukan ${data.length} Karton Utama.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.";
      console.error("Gagal melacak paket:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/tracking")
      .then((res) => res.json())
      .then((data: PackageItem[]) => {
        if (!ignore) setKartonResults(data);
      })
      .catch((err) => {
        console.error("Gagal memuat data paket:", err);
        if (!ignore) toast.error("Gagal memuat data paket.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadKartons(searchQuery, true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* Header Sederhana Tanpa Navbar */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Tracking Paket</h1>
          <p className="text-xs text-slate-500 font-medium">Klik salah satu Karton di bawah untuk melihat rincian histori & hierarki isi</p>
        </div>

        {/* Search Bar Card */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-5">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nomor seri karton (cth: CRT-...)"
                className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:ring-red-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 gap-2 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Cari
            </Button>
          </form>
        </Card>

        {/* Daftar Karton Utama */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider px-1">
            Daftar Karton Utama ({kartonResults.length})
          </h2>

          {loading && kartonResults.length === 0 ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                Memuat data paket...
              </div>
            </Card>
          ) : kartonResults.length === 0 ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Box className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Tidak ada data karton ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">Coba gunakan kata kunci pencarian lain.</p>
            </Card>
          ) : (
            kartonResults.map((karton) => (
              <Card 
                key={karton.id} 
                onClick={() => router.push(`/tracking/${karton.id}`)}
                className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden hover:border-red-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-50 p-2.5 rounded-2xl border border-red-100 text-red-600 shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <Box className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                          Karton Utama
                        </span>
                        <span className="text-sm font-black text-slate-900">{karton.serial_number}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                        Status: <span className="font-bold text-slate-700 uppercase">{karton.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 px-3.5 py-2 rounded-xl border border-red-100 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <span>Lihat Detail</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

      </main>
    </div>
  );
}