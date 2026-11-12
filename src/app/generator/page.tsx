"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Printer, Layers, CheckCircle2, Loader2, PackageCheck, Barcode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BarcodeLabel } from "@/components/barcode-label";

interface GeneratedItem {
  serial_number: string;
  level: "karton" | "bal" | "slop";
  code_type: "qr" | "barcode";
}

export default function PackageGeneratorPage() {
  const [level, setLevel] = useState<"karton" | "bal" | "slop">("slop");
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");
  const [quantity, setQuantity] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [generatedList, setGeneratedList] = useState<GeneratedItem[]>([]);

  const supabase = useMemo(() => createClient(), []);

  // Fungsi Generate KODE SATUAN MURNI (Tanpa Hierarchy di awal)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || quantity > 100) {
      toast.error("Jumlah kuantitas harus di antara 1 sampai 100 unit.");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi pengguna tidak valid. Silakan login ulang.");

      const prefix = level === "karton" ? "CRT" : level === "bal" ? "BAL" : "SLP";
      const timestamp = Date.now().toString().slice(-6);
      
      const newItems: GeneratedItem[] = [];
      const dbInserts = [];

      for (let i = 1; i <= quantity; i++) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const serialNumber = `${prefix}-${timestamp}-${randomNum}`;

        newItems.push({
          serial_number: serialNumber,
          level: level,
          code_type: codeType,
        });

        dbInserts.push({
          serial_number: serialNumber,
          level: level,
          code_type: codeType,
          parent_id: null, // Murni tanpa parent saat awal generate
          status: "created",
          created_by: user.id,
        });
      }

      const { error: insertErr } = await supabase.from("packages").insert(dbInserts);
      if (insertErr) throw insertErr;

      setGeneratedList(newItems);
      toast.success(`Berhasil Generate ${quantity} Unit ${level.toUpperCase()} (${codeType.toUpperCase()}) Murni!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan paket.";
      console.error("Gagal generate:", err);
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
            Generator Kode Satuan Pabrik
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Buat kode satuan mandiri (Karton, Bal, atau Slop) untuk kemudian diikat secara dinamis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Panel Kontrol (1 Kolom) */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl h-fit">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-red-600" />
                Konfigurasi Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <form onSubmit={handleGenerate} className="space-y-4">
                
                {/* Pilih Level Kemasan */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Level Kemasan</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["karton", "bal", "slop"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLevel(lvl)}
                        className={`h-10 rounded-xl text-xs font-bold uppercase transition-all border ${
                          level === lvl
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih Tipe Kode */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Tipe Kode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCodeType("qr")}
                      className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
                        codeType === "qr"
                          ? "bg-red-600 text-white border-red-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <QrCode className="w-4 h-4" /> QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeType("barcode")}
                      className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
                        codeType === "barcode"
                          ? "bg-red-600 text-white border-red-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Barcode className="w-4 h-4" /> Barcode
                    </button>
                  </div>
                </div>

                {/* Input Kuantitas (Qty) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Jumlah Cetak (Qty)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membuat Kode Satuan...
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      Generate {quantity} {level.toUpperCase()}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Area Preview Hasil (2 Kolom) */}
          <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 pt-6 pb-4">
              <div>
                <CardTitle className="text-base font-black text-slate-900">
                  Daftar Kode Tergenerate ({generatedList.length} Item)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Siap digunakan untuk pelabelan fisik di pabrik</p>
              </div>
              {generatedList.length > 0 && (
                <Button 
                  onClick={handlePrint}
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-2 text-xs font-bold"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Cetak Semua ({generatedList.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 flex-1">
              {generatedList.length === 0 ? (
                <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Belum ada kode yang digenerate</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Pilih level kemasan, tentukan kuantitas, lalu klik tombol generate di sebelah kiri.
                  </p>
                </div>
              ) : (
                <div className="max-h-[550px] overflow-y-auto pr-2 space-y-3">
                  {generatedList.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between gap-4 bg-white"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 shadow-inner flex items-center justify-center w-16 h-16">
                          {item.code_type === 'qr' ? (
                            <QRCodeSVG value={item.serial_number} size={48} level="M" />
                          ) : (
                            <BarcodeLabel value={item.serial_number} height={32} />
                          )}
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
                          <p className="text-[10px] text-slate-500 mt-1">
                            Format: <span className="uppercase font-bold">{item.code_type}</span> • Status: <span className="font-bold text-emerald-600">Tersimpan di DB</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 shrink-0 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Siap Cetak
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