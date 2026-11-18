"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  LogIn,
  MapPin,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type Mode = "in" | "out";

interface LocationData {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface SessionLog {
  id: string;
  serial: string;
  mode: Mode;
  location: string;
  time: string;
}

interface ScanFeedback {
  status: "processing" | "success" | "error";
  message: string;
}

type AccessError = "login" | "profile" | "role" | null;

export default function InOutPage() {
  const supabase = useMemo(() => createClient(), []);

  // --- STATE MODE & FORM ---
  const [mode, setMode] = useState<Mode>("in");
  const [serialInput, setSerialInput] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [lastFeedback, setLastFeedback] = useState<ScanFeedback | null>(null);

  // --- STATE DATA ---
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileLocationId, setProfileLocationId] = useState<string | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [accessError, setAccessError] = useState<AccessError>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);

  // --- STATE KAMERA ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const scanFeedbackRef = useRef<ScanFeedback | null>(null);
  const modeRef = useRef<Mode>("in");
  const isProcessingRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const myLocation = locations.find((loc) => loc.id === profileLocationId) ?? null;
  const destinationOptions = locations.filter((loc) => loc.is_active);

  // --- LOAD AKSES & PROFIL ---
  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!user) {
          setAccessError("login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, location_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error || !profile) {
          setAccessError("profile");
          return;
        }

        if (profile.role !== "staff" && profile.role !== "admin") {
          setAccessError("role");
          return;
        }

        setUserId(user.id);
        setProfileLocationId(profile.location_id ?? null);
        setAccessError(null);
      } catch (err) {
        console.error("Gagal memuat profil:", err);
        if (active) setAccessError("profile");
      } finally {
        if (active) setLoadingAccess(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [supabase]);

  // --- LOAD DAFTAR LOKASI ---
  useEffect(() => {
    let active = true;

    supabase
      .from("locations")
      .select("id, name, type, is_active")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Gagal memuat lokasi:", error);
          toast.error("Gagal memuat daftar lokasi.");
          return;
        }
        setLocations(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ==========================================
  // PROSES IN / OUT
  // ==========================================
  const processSerial = useCallback(
    async (serial: string, targetMode: Mode): Promise<ScanFeedback> => {
      const cleaned = serial.trim();

      if (!cleaned) {
        return { status: "error", message: "Nomor seri paket masih kosong." };
      }
      if (!userId) {
        return {
          status: "error",
          message: "Sesi login tidak ditemukan. Silakan login ulang.",
        };
      }

      const origin = locations.find((loc) => loc.id === profileLocationId) ?? null;
      if (!origin) {
        return {
          status: "error",
          message:
            "Akun kamu belum memiliki lokasi. Hubungi admin untuk mengatur lokasi profil.",
        };
      }

      if (targetMode === "out" && !destinationId) {
        return {
          status: "error",
          message: "Pilih lokasi tujuan terlebih dahulu.",
        };
      }

      try {
        setLoading(true);

        const { data: pkg, error: findErr } = await supabase
          .from("packages")
          .select("id, serial_number")
          .eq("serial_number", cleaned)
          .maybeSingle();

        if (findErr) throw findErr;
        if (!pkg) {
          throw new Error(`Paket dengan kode ${cleaned} tidak ditemukan.`);
        }

        let feedback: ScanFeedback;
        let logLocation: string;

        if (targetMode === "out") {
          const destination =
            locations.find((loc) => loc.id === destinationId) ?? null;
          if (!destination) throw new Error("Lokasi tujuan tidak valid.");

          const { error: updateErr } = await supabase
            .from("packages")
            .update({
              destination_location_id: destination.id,
              status: "in_transit",
            })
            .eq("id", pkg.id);

          if (updateErr) throw updateErr;

          const { error: logErr } = await supabase
            .from("package_tracking_logs")
            .insert({
              package_id: pkg.id,
              scanned_by: userId,
              location_id: origin.id,
              action: "OUT",
              notes: `Keluar dari ${origin.name} menuju ${destination.name}`,
            });

          if (logErr) throw logErr;

          logLocation = destination.name;
          feedback = {
            status: "success",
            message: `${pkg.serial_number} tercatat OUT menuju ${destination.name}.`,
          };
        } else {
          const { error: updateErr } = await supabase
            .from("packages")
            .update({
              current_location_id: origin.id,
              destination_location_id: null,
              status: "received",
            })
            .eq("id", pkg.id);

          if (updateErr) throw updateErr;

          const { error: logErr } = await supabase
            .from("package_tracking_logs")
            .insert({
              package_id: pkg.id,
              scanned_by: userId,
              location_id: origin.id,
              action: "IN",
              notes: `Diterima di ${origin.name}`,
            });

          if (logErr) throw logErr;

          logLocation = origin.name;
          feedback = {
            status: "success",
            message: `${pkg.serial_number} tercatat IN di ${origin.name}.`,
          };
        }

        const now = new Date();
        setSessionLogs((prev) => [
          {
            id: `${pkg.id}-${now.getTime()}`,
            serial: pkg.serial_number,
            mode: targetMode,
            location: logLocation,
            time: now.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...prev,
        ]);

        setSerialInput("");
        setLastFeedback(feedback);
        toast.success(feedback.message);
        return feedback;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal menyimpan riwayat tracking.";
        const feedback: ScanFeedback = { status: "error", message };
        setLastFeedback(feedback);
        toast.error(message);
        return feedback;
      } finally {
        setLoading(false);
      }
    },
    [destinationId, locations, profileLocationId, supabase, userId]
  );

  // --- INISIALISASI & MATIKAN KAMERA ---
  const handlersRef = useRef({ processSerial });

  useEffect(() => {
    handlersRef.current = { processSerial };
  }, [processSerial]);

  useEffect(() => {
    if (!isCameraOpen) return;

    const scanner = new Html5Qrcode("in-out-reader-view");
    scannerRef.current = scanner;
    let cancelled = false;

    const processScan = async (decodedText: string) => {
      if (isProcessingRef.current) return;

      const currentFeedback = scanFeedbackRef.current;
      if (currentFeedback && currentFeedback.status !== "processing") return;

      isProcessingRef.current = true;

      const cleaned = decodedText.trim();
      const processing: ScanFeedback = {
        status: "processing",
        message: `Memproses ${cleaned}...`,
      };
      scanFeedbackRef.current = processing;
      setScanFeedback(processing);
      setSerialInput(cleaned);

      let feedback: ScanFeedback;
      try {
        feedback = await handlersRef.current.processSerial(
          cleaned,
          modeRef.current
        );
      } catch (err) {
        feedback = {
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Gagal memproses hasil scan.",
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

  const openCamera = () => {
    if (!myLocation) {
      toast.error("Akun kamu belum memiliki lokasi.");
      return;
    }
    if (mode === "out" && !destinationId) {
      toast.error("Pilih lokasi tujuan dulu sebelum scan.");
      return;
    }
    resetScanFeedback();
    setIsCameraOpen(true);
  };

  const closeCameraModal = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setIsCameraOpen(false);
    resetScanFeedback();
  };

  const handleScanAgain = () => {
    resetScanFeedback();
  };

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setSerialInput("");
    setLastFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "out" && !destinationId) {
      toast.error("Pilih lokasi tujuan terlebih dahulu.");
      return;
    }
    void processSerial(serialInput, mode);
  };

  // --- TAMPILAN AKSES ---
  if (loadingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat data staf...
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-red-300 bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-slate-900">
              Halaman Khusus Staf
            </h1>
            <p className="text-xs leading-relaxed text-slate-500">
              {accessError === "login"
                ? "Kamu harus login dengan akun staf untuk mencatat barang masuk dan keluar."
                : accessError === "role"
                  ? "Akun ini tidak memiliki akses ke modul In/Out."
                  : "Profil akun tidak ditemukan. Hubungi admin untuk melengkapi data profil."}
            </p>
          </div>
          {accessError === "login" && (
            <Link href="/login" className="inline-block">
              <Button className="gap-2">
                <LogIn className="h-4 w-4" /> Login Staf
              </Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  const isOut = mode === "out";

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Modul Operasional"
          title="In / Out"
          description="Catat barang masuk dan keluar dari lokasi profil kamu."
        />

        {/* Tab mode */}
        <div className="grid grid-cols-2 border border-slate-300 bg-slate-200">
          <button
            type="button"
            onClick={() => handleModeChange("in")}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold tracking-wide uppercase transition-colors ${
              mode === "in"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" /> In
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("out")}
            className={`flex items-center justify-center gap-2 border-l border-slate-300 px-4 py-2.5 text-[11px] font-bold tracking-wide uppercase transition-colors ${
              mode === "out"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4" /> Out
          </button>
        </div>

        {!myLocation && (
          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Lokasi profil belum diatur
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                Modul In/Out membutuhkan lokasi pada profil akun. Hubungi admin
                untuk mengatur lokasi kamu.
              </p>
            </div>
          </div>
        )}

        {/* Panel utama */}
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              Form Pencatatan
            </h2>
            <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">
              Mode {isOut ? "Out" : "In"}
            </span>
          </div>

          <div className="space-y-4 p-4">
            {/* Info lokasi */}
            <div
              className={`grid gap-px border border-slate-300 bg-slate-300 ${
                isOut ? "sm:grid-cols-2" : ""
              }`}
            >
              <div className="flex items-center gap-3 bg-slate-50 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {isOut ? "Lokasi Asal" : "Lokasi Diterima"}
                  </p>
                  <p className="truncate text-sm font-bold text-slate-900">
                    {myLocation?.name ?? "Belum ada lokasi"}
                  </p>
                </div>
              </div>

              {isOut && (
                <div className="flex items-center gap-3 bg-slate-50 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600">
                    <ArrowUpFromLine className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Lokasi Tujuan
                    </p>
                    <p className="truncate text-sm font-bold text-slate-900">
                      {destinationOptions.find((loc) => loc.id === destinationId)
                        ?.name ?? "Belum dipilih"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dropdown tujuan (khusus OUT) */}
            {isOut && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="destination"
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-3.5 w-3.5 text-slate-500" /> Pilih Lokasi
                  Tujuan
                </Label>
                <select
                  id="destination"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  disabled={loading}
                  className="h-10 w-full rounded-none border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">-- Pilih lokasi tujuan --</option>
                  {destinationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
                {destinationOptions.length === 0 && (
                  <p className="text-[10px] font-bold tracking-wide text-amber-700 uppercase">
                    Belum ada lokasi aktif yang bisa dipilih.
                  </p>
                )}
              </div>
            )}

            {/* Form scan / input manual */}
            <form
              onSubmit={handleSubmit}
              className="space-y-2 border-t border-slate-200 pt-4"
            >
              <Label htmlFor="serial" className="flex items-center gap-2">
                <QrCode className="h-3.5 w-3.5 text-slate-500" /> Kode Paket
              </Label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="serial"
                  type="text"
                  autoComplete="off"
                  placeholder="Scan / ketik serial..."
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  disabled={loading || !myLocation}
                  className="h-11 flex-1 font-mono text-sm font-semibold"
                />
                <Button
                  type="button"
                  onClick={openCamera}
                  disabled={loading || !myLocation}
                  aria-label="Buka kamera scan"
                  title="Scan kamera"
                  variant="outline"
                  className="h-11 w-11 shrink-0 px-0"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !myLocation}
                  className="h-11 gap-2 px-4"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isOut ? (
                    <ArrowUpFromLine className="h-4 w-4" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4" />
                  )}
                  Catat
                </Button>
              </div>

              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                {isOut ? "Keluar → lokasi tujuan." : "Masuk → lokasi profil."}
              </p>
            </form>

            {/* Feedback manual */}
            {lastFeedback && (
              <div
                className={`flex items-start gap-2.5 border p-3 text-xs font-semibold ${
                  lastFeedback.status === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : lastFeedback.status === "error"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {lastFeedback.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : lastFeedback.status === "error" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                )}
                <p className="flex-1 leading-relaxed">{lastFeedback.message}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Riwayat sesi */}
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
            <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              <History className="h-3.5 w-3.5 text-slate-500" /> Riwayat Sesi Ini
            </h2>
            <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">
              {sessionLogs.length} transaksi
            </span>
          </div>

          <div className="p-4">
            {sessionLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Belum ada transaksi.
              </p>
            ) : (
              <div className="space-y-2">
                {sessionLogs.map((log) => {
                  const logIsOut = log.mode === "out";
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 border border-slate-300 bg-white p-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 text-slate-600">
                          {logIsOut ? (
                            <ArrowUpFromLine className="h-4 w-4" />
                          ) : (
                            <ArrowDownToLine className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                                logIsOut
                                  ? "border-slate-800 bg-slate-800 text-white"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {log.mode}
                            </span>
                            <span className="truncate font-mono text-xs font-bold text-slate-900">
                              {log.serial}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                            {logIsOut ? "Tujuan" : "Lokasi"}: {log.location}
                          </p>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold text-slate-500">
                        <Clock className="h-3 w-3" /> {log.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Modal kamera */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <QrCode className="h-4 w-4 text-slate-300" />
                  <div>
                    <h3 className="text-[11px] font-bold tracking-wider text-white uppercase">
                      Scan Mode {isOut ? "OUT" : "IN"}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {isOut
                        ? `Tujuan: ${
                            destinationOptions.find(
                              (loc) => loc.id === destinationId
                            )?.name ?? "-"
                          }`
                        : `Lokasi: ${myLocation?.name ?? "-"}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCameraModal}
                  className="flex h-8 w-8 items-center justify-center border border-slate-600 text-slate-300 hover:bg-slate-800"
                  aria-label="Tutup kamera"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 p-3">
                <div className="relative h-72 w-full overflow-hidden border border-slate-700 bg-black">
                  <div id="in-out-reader-view" className="h-full w-full" />
                </div>

                {scanFeedback ? (
                  <div
                    className={`flex items-start gap-2.5 border px-3 py-2.5 text-xs font-medium ${
                      scanFeedback.status === "success"
                        ? "border-emerald-700 bg-emerald-950/60 text-emerald-200"
                        : scanFeedback.status === "error"
                          ? "border-red-800 bg-red-950/60 text-red-200"
                          : "border-amber-700 bg-amber-950/50 text-amber-200"
                    }`}
                  >
                    {scanFeedback.status === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : scanFeedback.status === "error" ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    )}
                    <p className="flex-1 leading-relaxed">
                      {scanFeedback.message}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-slate-400">
                    Arahkan QR / barcode ke kotak.
                  </p>
                )}

                {scanFeedback && scanFeedback.status !== "processing" && (
                  <button
                    type="button"
                    onClick={handleScanAgain}
                    className="flex h-9 w-full items-center justify-center gap-2 border border-slate-600 bg-slate-800 text-xs font-bold tracking-wide text-white uppercase hover:bg-slate-700"
                  >
                    <RefreshCw className="h-4 w-4" /> Scan Lagi
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
