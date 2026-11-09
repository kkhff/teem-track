"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Box, Clock, Loader2, Layers } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PackageDetail {
  id: string;
  serial_number: string;
  level: string;
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
  }, [resolvedParams.id]);

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
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                  Karton Utama (Parent)
                </span>
                <h1 className="text-xl font-black text-slate-900 mt-1">{packageData.serial_number}</h1>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                  Status Terkini: <span className="font-bold text-slate-800 uppercase">{packageData.status}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 self-center">
              <QRCodeSVG value={packageData.serial_number} size={80} level="M" />
            </div>
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

          {/* Rincian Anak (Bal & Slop) */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Rincian Isi (Bal & Slop)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              {balList.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Tidak ada rincian anak terdaftar.</p>
              ) : (
                balList.map((bal) => {
                  const slopList = children.filter((s) => s.level === "slop" && s.parent_id === bal.id);

                  return (
                    <div key={bal.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500 text-white">
                          Bal
                        </span>
                        <span className="text-xs font-black text-slate-800">{bal.serial_number}</span>
                      </div>

                      {slopList.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/60">
                          {slopList.map((slop) => (
                            <div key={slop.id} className="p-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5">
                              <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-slate-700 text-white">
                                Slop
                              </span>
                              <span className="text-[10px] font-bold text-slate-800 truncate">{slop.serial_number}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

        </div>

      </main>
    </div>
  );
}