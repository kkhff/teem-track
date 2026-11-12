"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  QrCode, 
  Layers, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Camera,
  X
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface PackageData {
  id: string;
  serial_number: string;
  level: "karton" | "bal" | "slop";
  code_type: string;
  status: string;
  parent_id: string | null;
  current_location_id: string | null;
}

interface ChildData {
  id: string;
  serial_number: string;
  level: string;
}

interface ScanFeedback {
  status: "processing" | "success" | "error";
  message: string;
}

export default function ScanOperationPage() {
  const [loading, setLoading] = useState(false);

  // --- STATE BINDING (STAF) ---
  const [parentInput, setParentInput] = useState("");
  const [parentPackage, setParentPackage] = useState<PackageData | null>(null);
  const [childrenList, setChildrenList] = useState<ChildData[]>([]);
  const [childInput, setChildInput] = useState("");

  // --- STATE KAMERA ASLI ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanTargetField, setScanTargetField] = useState<"parent" | "child" | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const scanFeedbackRef = useRef<ScanFeedback | null>(null);
  const scanTargetRef = useRef<"parent" | "child" | null>(null);
  const isProcessingRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Kapasitas Berjenjang
  const maxCapacity = parentPackage?.level === "karton" ? 4 : parentPackage?.level === "bal" ? 20 : 0;
  const currentCount = childrenList.length;
  const isFull = parentPackage ? currentCount >= maxCapacity : false;
  const remainingSlots = parentPackage ? maxCapacity - currentCount : 0;

  // ==========================================
  // FOKUS UTAMA: AUTO-EXECUTE (SUNG MASUK OTOMATIS)
  // ==========================================

  const handleFetchAndSetParent = useCallback(async (serial: string): Promise<ScanFeedback> => {
    if (!serial.trim()) {
      return { status: "error", message: "Nomor seri induk masih kosong." };
    }

    try {
      setLoading(true);
      const { data: pkg, error } = await supabase
        .from("packages")
        .select("*")
        .eq("serial_number", serial.trim())
        .single();

      if (error || !pkg) throw new Error("Nomor seri paket induk tidak ditemukan di database.");
      if (pkg.level === "slop") throw new Error("Slop adalah level terendah, tidak bisa memiliki anak.");

      setParentPackage(pkg);

      const { data: children, error: childErr } = await supabase
        .from("packages")
        .select("id, serial_number, level")
        .eq("parent_id", pkg.id);

      if (childErr) throw childErr;
      setChildrenList(children || []);
      setParentInput("");
      toast.success(`Induk ${pkg.level.toUpperCase()} (${pkg.serial_number}) otomatis dimuat! (Tit!)`);

      return {
        status: "success",
        message: `Induk ${pkg.level.toUpperCase()} ${pkg.serial_number} berhasil dimuat.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat paket induk.";
      toast.error(msg);
      setParentPackage(null);
      setChildrenList([]);
      return { status: "error", message: msg };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleAutoAddChild = useCallback(async (serial: string): Promise<ScanFeedback> => {
    if (!parentPackage) {
      return { status: "error", message: "Pilih paket induk terlebih dahulu." };
    }
    if (!serial.trim()) {
      return { status: "error", message: "Nomor seri anak masih kosong." };
    }

    if (isFull) {
      const msg = `Gagal! ${parentPackage.level.toUpperCase()} ini sudah PENUH (${maxCapacity}/${maxCapacity}).`;
      toast.error(msg);
      return { status: "error", message: msg };
    }

    try {
      setLoading(true);

      const { data: child, error: childErr } = await supabase
        .from("packages")
        .select("*")
        .eq("serial_number", serial.trim())
        .single();

      if (childErr || !child) throw new Error(`Kode ${serial} tidak ditemukan di database.`);

      if (parentPackage.level === "karton" && child.level !== "bal") {
        throw new Error("Karton hanya boleh diisi item ber-level BAL!");
      }
      if (parentPackage.level === "bal" && child.level !== "slop") {
        throw new Error("Bal hanya boleh diisi item ber-level SLOP!");
      }

      if (child.parent_id) {
        throw new Error(`Item ${child.serial_number} sudah terikat ke induk lain!`);
      }

      const { error: updateErr } = await supabase
        .from("packages")
        .update({ parent_id: parentPackage.id })
        .eq("id", child.id);

      if (updateErr) throw updateErr;

      setChildrenList((prev) => [...prev, { id: child.id, serial_number: child.serial_number, level: child.level }]);
      setChildInput("");
      toast.success(`Berhasil sung ikat ${child.serial_number} ke induk! (Tit!)`);

      return {
        status: "success",
        message: `Berhasil! ${child.serial_number} terikat ke ${parentPackage.serial_number}.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengikat anak.";
      toast.error(msg);
      return { status: "error", message: msg };
    } finally {
      setLoading(false);
    }
  }, [parentPackage, isFull, maxCapacity, supabase]);

  // --- INISIALISASI & MATIKAN KAMERA ---
  const handlersRef = useRef({
    handleFetchAndSetParent,
    handleAutoAddChild,
  });

  useEffect(() => {
    handlersRef.current = {
      handleFetchAndSetParent,
      handleAutoAddChild,
    };
  }, [handleFetchAndSetParent, handleAutoAddChild]);

  useEffect(() => {
    if (!isCameraOpen) return;

    const scanner = new Html5Qrcode("real-reader-view");
    scannerRef.current = scanner;
    let cancelled = false;

    // Proses satu hasil scan, tanpa menutup kamera.
    const processScan = async (decodedText: string) => {
      if (isProcessingRef.current) return;

      // Kalau sedang ada hasil (sukses/gagal) yang tampil, tunggu "Scan Lagi".
      const currentFeedback = scanFeedbackRef.current;
      if (currentFeedback && currentFeedback.status !== "processing") return;

      isProcessingRef.current = true;

      const target = scanTargetRef.current;
      const cleaned = decodedText.trim();
      const processing: ScanFeedback = {
        status: "processing",
        message: `Memproses ${cleaned}...`,
      };
      scanFeedbackRef.current = processing;
      setScanFeedback(processing);

      const handlers = handlersRef.current;
      let feedback: ScanFeedback;

      try {
        if (target === "parent") {
          setParentInput(cleaned);
          feedback = await handlers.handleFetchAndSetParent(cleaned);
        } else if (target === "child") {
          setChildInput(cleaned);
          feedback = await handlers.handleAutoAddChild(cleaned);
        } else {
          feedback = { status: "error", message: "Target scan tidak dikenali." };
        }
      } catch (err) {
        feedback = {
          status: "error",
          message: err instanceof Error ? err.message : "Gagal memproses hasil scan.",
        };
      } finally {
        isProcessingRef.current = false;
      }

      if (cancelled) return;

      scanFeedbackRef.current = feedback;
      setScanFeedback(feedback);
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void processScan(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        console.error("Gagal membuka kamera:", err);
        toast.error("Tidak dapat mengakses kamera perangkat.");
        setIsCameraOpen(false);
      });

    return () => {
      cancelled = true;
      const current = scannerRef.current;
      scannerRef.current = null;

      if (!current) return;

      try {
        if (current.isScanning) {
          current
            .stop()
            .then(() => {
              try {
                current.clear();
              } catch {
                // abaikan: elemen mungkin sudah dilepas React
              }
            })
            .catch(() => {});
        } else {
          current.clear();
        }
      } catch {
        // abaikan: scanner mungkin belum selesai start
      }
    };
  }, [isCameraOpen]);

  const resetScanFeedback = () => {
    scanFeedbackRef.current = null;
    isProcessingRef.current = false;
    setScanFeedback(null);
  };

  const openCamera = (target: "parent" | "child") => {
    scanTargetRef.current = target;
    setScanTargetField(target);
    resetScanFeedback();
    setIsCameraOpen(true);
  };

  const closeCameraModal = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setIsCameraOpen(false);
    setScanTargetField(null);
    scanTargetRef.current = null;
    resetScanFeedback();
  };

  // Kamera tetap menyala, jadi tinggal bersihkan hasil lalu siap scan lagi.
  const handleScanAgain = () => {
    resetScanFeedback();
  };

  // Manual trigger via Enter / Tombol
  const handleManualParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFetchAndSetParent(parentInput);
  };

  const handleManualChildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAutoAddChild(childInput);
  };

  const handleResetBinding = () => {
    setParentPackage(null);
    setChildrenList([]);
    setParentInput("");
    setChildInput("");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-4xl mx-auto px-4 pt-8 relative z-10 space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Modul Scan Binding</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scan kamera untuk memuat induk dan mengikat anak secara otomatis</p>
        </div>

        {/* BINDING PARENT-CHILD */}
        <div className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-6">
              <form onSubmit={handleManualParentSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-amber-500" /> 1. Scan Kode Induk (Parent)
                  </Label>
                  {parentPackage && (
                    <button
                      type="button"
                      onClick={handleResetBinding}
                      className="text-[11px] font-bold text-slate-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Ganti Parent
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan atau ketik serial induk..."
                    value={parentInput}
                    onChange={(e) => setParentInput(e.target.value)}
                    disabled={loading || !!parentPackage}
                    className="flex-1 px-4 h-11 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                  />
                  {!parentPackage && (
                    <>
                      <Button
                        type="button"
                        onClick={() => openCamera("parent")}
                        className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2 shadow-md shadow-amber-500/20"
                      >
                        <Camera className="w-4 h-4" /> Buka Kamera (Auto)
                      </Button>
                    </>
                  )}
                </div>
              </form>

              {parentPackage && (
                <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500 text-white">
                        {parentPackage.level}
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-0.5">{parentPackage.serial_number}</h3>
                    </div>

                    {isFull ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-red-600 text-white flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-4 h-4" /> SUDAH PENUH ({currentCount}/{maxCapacity})
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Terisi {currentCount} / {maxCapacity} (Sisa {remainingSlots})
                      </span>
                    )}
                  </div>

                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isFull ? 'bg-red-600' : 'bg-amber-500'}`}
                      style={{ width: `${(currentCount / maxCapacity) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {parentPackage && (
              <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-6 space-y-4">
                <form onSubmit={handleManualChildSubmit} className="space-y-3">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-700" /> 2. Scan Kode Anak (Langsung Sung Masuk ke Induk)
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={isFull ? "Kapasitas induk sudah PENUH!" : `Scan serial ${parentPackage.level === 'karton' ? 'BAL' : 'SLOP'}...`}
                      value={childInput}
                      onChange={(e) => setChildInput(e.target.value)}
                      disabled={loading || isFull}
                      className="flex-1 px-4 h-11 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
                    />
                    <Button
                      type="button"
                      onClick={() => openCamera("child")}
                      disabled={isFull}
                      className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 disabled:opacity-50 shadow-md"
                    >
                      <Camera className="w-4 h-4" /> Scan Anak (Auto)
                    </Button>
                  </div>
                </form>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                    Daftar Anak Terikat Saat Ini ({childrenList.length})
                  </h4>

                  {childrenList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">Belum ada anak yang terikat.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {childrenList.map((c, idx) => (
                        <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                          <span className="font-bold text-slate-800">{c.serial_number}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-700 text-white">
                            {c.level}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

        {/* MODAL KAMERA FISIK ASLI (AUTO TRIGGER) */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-red-50 p-2 rounded-xl text-red-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Auto-Scan Kamera Aktif</h3>
                    <p className="text-[11px] text-slate-500">
                      {scanTargetField === "parent"
                        ? "Arahkan kamera ke kode induk."
                        : scanTargetField === "child"
                          ? "Arahkan kamera ke kode anak."
                          : "Arahkan kamera ke kode paket."}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={closeCameraModal}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                  aria-label="Tutup kamera"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
                <div id="real-reader-view" className="w-full h-full" />
              </div>

              {scanFeedback ? (
                <div
                  className={`rounded-2xl border p-3 flex items-start gap-2.5 text-xs font-semibold ${
                    scanFeedback.status === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : scanFeedback.status === "error"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}
                >
                  {scanFeedback.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : scanFeedback.status === "error" ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                  )}
                  <p className="flex-1 leading-relaxed">{scanFeedback.message}</p>
                </div>
              ) : (
                <p className="text-center text-[11px] text-slate-500 font-medium">
                  Posisikan QR / Barcode di dalam kotak. Hasil scan akan tampil di sini tanpa menutup kamera.
                </p>
              )}

              {scanFeedback && scanFeedback.status !== "processing" && (
                <Button
                  type="button"
                  onClick={handleScanAgain}
                  className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Scan Lagi
                </Button>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}