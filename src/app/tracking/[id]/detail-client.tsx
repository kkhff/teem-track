"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Box, Clock, Loader2, Layers } from "lucide-react";
import { CodePreview } from "@/components/code-preview";

interface PackageDetail {
  id: string;
  serial_number: string;
  level: string;
  code_type: "qr" | "barcode";
  status: string;
  current_location_id: string | null;
  created_at: string;
}

interface TrackingLog {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  locations: { name: string } | null;
}

interface ChildItem {
  id: string;
  serial_number: string;
  level: "bal" | "slop";
  parent_id: string | null;
}

export default function PackageDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageDetail | null>(null);
  const [logs, setLogs] = useState<TrackingLog[]>([]);
  const [children, setChildren] = useState<ChildItem[]>([]);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/tracking/detail?id=${resolvedParams.id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Gagal memuat detail paket.");

        // Jika id yang dibuka ternyata Bal/Slop, arahkan ke halaman detail levelnya
        if (data.package?.level === "bal") {
          router.replace(`/tracking/bal/${data.package.id}`);
          return;
        }
        if (data.package?.level === "slop") {
          router.replace(`/tracking/slop/${data.package.id}`);
          return;
        }

        setPackageData(data.package);
        setLogs(data.logs || []);
        setChildren(data.children || []);
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat rincian paket.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-red-600" />
        Memuat detail paket...
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 p-6">
        <p className="font-bold text-base mb-2">Paket tidak ditemukan</p>
        <Button onClick={() => router.back()} className="rounded-xl bg-red-600 text-white">
          Kembali
        </Button>
      </div>
    );
  }

  // Hanya ambil level bal untuk halaman karton ini
  const balList = children.filter((c) => c.level === "bal");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* Tombol Kembali */}
        <Button 
          onClick={() => router.back()} 
          variant="outline" 
          size="sm" 
          className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 gap-2 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Tracking
        </Button>

        {/* Info Utama Karton */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-red-600 shrink-0">
                <Box className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                    Karton Utama (Parent)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    packageData.status === 'created' ? 'bg-blue-100 text-blue-700' :
                    packageData.status === 'in_transit' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Status: {packageData.status}
                  </span>
                </div>
                <h1 className="text-xl font-black text-slate-900 mt-1">{packageData.serial_number}</h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Tipe Kode: <span className="uppercase font-bold text-slate-700">{packageData.code_type || 'qr'}</span>
                </p>
              </div>
            </div>

            {/* Render QR atau Barcode (klik untuk memperbesar) */}
            <CodePreview
              packageId={packageData.id}
              value={packageData.serial_number}
              codeType={packageData.code_type || "qr"}
              accent="red"
              onCodeTypeChange={(type) =>
                setPackageData((prev) => (prev ? { ...prev, code_type: type } : prev))
              }
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Histori Tracking Log */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                Histori Aktivitas Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Belum ada riwayat aktivitas log untuk paket ini.</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-100">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(log.created_at).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1">
                        Lokasi: <span className="font-bold">{log.locations?.name || "Pusat"}</span> • Oleh: {log.profiles?.full_name || "Staf"}
                      </p>
                      {log.notes && <p className="text-[11px] text-slate-500 italic">Catatan: &quot;{log.notes}&quot;</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rincian Anak (Hanya Bal Saja, Klik untuk Masuk Detail Bal) */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Daftar Bal di dalam Karton Ini ({balList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {balList.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Tidak ada rincian bal terdaftar.</p>
              ) : (
                balList.map((bal) => (
                  <div 
                    key={bal.id} 
                    onClick={() => router.push(`/tracking/bal/${bal.id}`)}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500 text-white">
                        Bal
                      </span>
                      <span className="text-xs font-black text-slate-900">{bal.serial_number}</span>
                    </div>
                    <span className="text-[11px] text-amber-600 font-bold hover:underline">Lihat Detail Bal &rarr;</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>

      </main>
    </div>
  );
}