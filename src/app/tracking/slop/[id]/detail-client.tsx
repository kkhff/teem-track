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
  parent_id: string | null;
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

export default function SlopDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [slopData, setSlopData] = useState<PackageDetail | null>(null);
  const [balParent, setBalParent] = useState<PackageDetail | null>(null);
  const [kartonGrandParent, setKartonGrandParent] = useState<PackageDetail | null>(null);
  const [logs, setLogs] = useState<TrackingLog[]>([]);

  useEffect(() => {
    const fetchSlopDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/tracking/detail?id=${resolvedParams.id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Gagal memuat detail slop.");

        setSlopData(data.package);
        setLogs(data.logs || []);

        // Ambil parent (Bal)
        if (data.package?.parent_id) {
          const balRes = await fetch(`/api/tracking/detail?id=${data.package.parent_id}`);
          const balData = await balRes.json();
          if (balRes.ok) {
            setBalParent(balData.package);

            // Ambil grandparent (Karton) dari parent bal
            if (balData.package?.parent_id) {
              const kartonRes = await fetch(`/api/tracking/detail?id=${balData.package.parent_id}`);
              const kartonData = await kartonRes.json();
              if (kartonRes.ok) setKartonGrandParent(kartonData.package);
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat rincian slop.");
      } finally {
        setLoading(false);
      }
    };

    fetchSlopDetail();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
        Memuat detail slop...
      </div>
    );
  }

  if (!slopData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 p-6">
        <p className="font-bold text-base mb-2">Data Slop tidak ditemukan</p>
        <Button onClick={() => router.back()} className="rounded-xl bg-slate-800 text-white">
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4 relative">
      <main className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* Tombol Kembali */}
        <Button 
          onClick={() => router.back()} 
          variant="outline" 
          size="sm" 
          className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 gap-2 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Button>

        {/* Informasi Parents Berjenjang (Karton & Bal) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kartonGrandParent && (
            <div 
              onClick={() => router.push(`/tracking/${kartonGrandParent.id}`)}
              className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-100/60 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Box className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-[9px] font-bold text-red-600 uppercase">Grandparent (Karton)</p>
                  <p className="text-xs font-black text-slate-900">{kartonGrandParent.serial_number}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-red-600">&rarr;</span>
            </div>
          )}

          {balParent && (
            <div 
              onClick={() => router.push(`/tracking/bal/${balParent.id}`)}
              className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-amber-100/60 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-[9px] font-bold text-amber-600 uppercase">Parent (Bal)</p>
                  <p className="text-xs font-black text-slate-900">{balParent.serial_number}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-600">&rarr;</span>
            </div>
          )}
        </div>

        {/* Info Utama Slop */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 text-slate-700 shrink-0">
                <Box className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 text-white">
                    Slop (Level Dasar)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    slopData.status === 'created' ? 'bg-blue-100 text-blue-700' :
                    slopData.status === 'in_transit' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Status: {slopData.status}
                  </span>
                </div>
                <h1 className="text-xl font-black text-slate-900 mt-1">{slopData.serial_number}</h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Tipe Kode: <span className="uppercase font-bold text-slate-700">{slopData.code_type || 'qr'}</span>
                </p>
              </div>
            </div>

            <CodePreview
              packageId={slopData.id}
              value={slopData.serial_number}
              codeType={slopData.code_type || "qr"}
              accent="slate"
              onCodeTypeChange={(type) =>
                setSlopData((prev) => (prev ? { ...prev, code_type: type } : prev))
              }
            />
          </div>
        </Card>

        {/* Histori Tracking Log Slop */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              Histori Aktivitas Slop
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">Belum ada riwayat log.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-lg">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">
                      Lokasi: <span className="font-bold">{log.locations?.name || "Pusat"}</span> • Oleh: {log.profiles?.full_name || "Staf"}
                    </p>
                    {log.notes && <p className="text-[11px] text-slate-500 italic">Catatan: &quot;{log.notes}&quot;</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
