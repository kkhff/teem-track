"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Printer, Layers, CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Location {
  id: string;
  name: string;
  type: string;
}

interface GeneratedItem {
  serial_number: string;
  level: "karton" | "bal" | "slop";
  parent_serial?: string;
}

export default function PackageGeneratorPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedSet, setGeneratedSet] = useState<GeneratedItem[]>([]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, type")
        .eq("is_active", true);

      if (error) {
        toast.error("Gagal memuat data lokasi");
      } else {
        setLocations(data || []);
        if (data && data.length > 0) setSelectedLocation(data[0].id);
      }
    };
    fetchLocations();
  }, [supabase]);

  // Fungsi Generate Paket Satu Set (1 Karton -> 4 Bal -> 80 Slop)
  const handleGenerateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) {
      toast.error("Pilih lokasi asal pabrik terlebih dahulu!");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi pengguna tidak valid. Silakan login ulang.");

      const timestamp = Date.now().toString().slice(-6);
      const randomBase = Math.floor(100 + Math.random() * 900);

      // 1. Buat 1 Karton
      const kartonSerial = `CRT-${timestamp}-${randomBase}`;
      
      // Simpan Karton ke DB dulu untuk dapatkan UUID-nya
      const { data: kartonData, error: kartonErr } = await supabase
        .from("packages")
        .insert({
          serial_number: kartonSerial,
          level: "karton",
          current_location_id: selectedLocation,
          status: "created",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (kartonErr) throw kartonErr;
      const kartonId = kartonData.id;

      const itemsToDisplay: GeneratedItem[] = [{ serial_number: kartonSerial, level: "karton" }];

      // 2. Buat 4 Bal di bawah Karton ini
      for (let b = 1; b <= 4; b++) {
        const balSerial = `BAL-${timestamp}-${randomBase}-${b}`;
        
        // Kita insert manual satu-satu atau kumpulkan untuk batch insert
        const { data: balData, error: balErr } = await supabase
          .from("packages")
          .insert({
            serial_number: balSerial,
            level: "bal",
            parent_id: kartonId, // Relasi ke Karton
            current_location_id: selectedLocation,
            status: "created",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (balErr) throw balErr;
        const balId = balData.id;

        itemsToDisplay.push({ serial_number: balSerial, level: "bal", parent_serial: kartonSerial });

        // 3. Buat 20 Slop di bawah masing-masing Bal (Total 4 x 20 = 80 Slop)
        const slopInserts = [];
        for (let s = 1; s <= 20; s++) {
          const slopSerial = `SLP-${timestamp}-${randomBase}-${b}-${s}`;
          slopInserts.push({
            serial_number: slopSerial,
            level: "slop",
            parent_id: balId, // Relasi ke Bal
            current_location_id: selectedLocation,
            status: "created",
            created_by: user.id,
          });
          itemsToDisplay.push({ serial_number: slopSerial, level: "slop", parent_serial: balSerial });
        }

        // Batch insert untuk 20 slop per bal
        const { error: slopErr } = await supabase.from("packages").insert(slopInserts);
        if (slopErr) throw slopErr;
      }

      setGeneratedSet(itemsToDisplay);
      toast.success("Berhasil Generate 1 Set (1 Karton, 4 Bal, 80 Slop)!");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan paket.";
      console.error("Gagal generate set:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-8 relative z-10 space-y-8">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            Generator Paket Pabrik
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sekali klik: 1 Karton, 4 Bal, dan 80 Slop.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Panel Kontrol (1 Kolom) */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl h-fit">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-red-600" />
                Konfigurasi Batch Set
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <form onSubmit={handleGenerateSet} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Lokasi Pabrik Asal</Label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-3 h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-800">Struktur Paket yang Dihasilkan:</p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 font-medium">
                    <li><strong className="text-slate-900">1 Unit</strong> Karton (Level Utama)</li>
                    <li><strong className="text-slate-900">4 Unit</strong> Bal (Masuk ke Karton)</li>
                    <li><strong className="text-slate-900">80 Unit</strong> Slop (20 per Bal)</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membuat 85 Paket & Relasi...
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      Generate 1 Set Lengkap
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Area Preview Hasil QR (2 Kolom) */}
          <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 pt-6 pb-4">
              <div>
                <CardTitle className="text-base font-black text-slate-900">Daftar Nomor Seri & QR Tergenerate</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Paket otomatis tersimpan dan siap dicetak</p>
              </div>
              {generatedSet.length > 0 && (
                <Button 
                  onClick={handlePrint}
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-2 text-xs font-bold"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Cetak Semua ({generatedSet.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 flex-1">
              {generatedSet.length === 0 ? (
                <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Belum ada batch set yang digenerate</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Pilih lokasi pabrik lalu klik tombol &quot;Generate 1 Set Lengkap&quot; di samping.
                  </p>
                </div>
              ) : (
                <div className="max-h-[550px] overflow-y-auto pr-2 space-y-3">
                  {generatedSet.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3.5 border rounded-2xl shadow-sm flex items-center justify-between gap-4 transition-all ${
                        item.level === 'karton' ? 'bg-red-50/40 border-red-200' :
                        item.level === 'bal' ? 'bg-amber-50/30 border-amber-200' :
                        'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 shadow-inner">
                          <QRCodeSVG value={item.serial_number} size={56} level="M" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              item.level === 'karton' ? 'bg-red-600 text-white' :
                              item.level === 'bal' ? 'bg-amber-500 text-white' :
                              'bg-slate-700 text-white'
                            }`}>
                              {item.level}
                            </span>
                            <span className="text-xs font-black text-slate-900 truncate">{item.serial_number}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 truncate">
                            {item.parent_serial ? `Bagian dari: ${item.parent_serial}` : 'Kemasan Utama (Karton)'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 shrink-0 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}