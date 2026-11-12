"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data staf...
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-black text-slate-900">
              Halaman Khusus Staf
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {accessError === "login"
                ? "Kamu harus login dengan akun staf untuk mencatat barang masuk dan keluar."
                : accessError === "role"
                  ? "Akun ini tidak memiliki akses ke modul In/Out."
                  : "Profil akun tidak ditemukan. Hubungi admin untuk melengkapi data profil."}
            </p>
          </div>
          {accessError === "login" && (
            <Link href="/login">
              <Button className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-2">
                <LogIn className="w-4 h-4" /> Login Staf
              </Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  const isOut = mode === "out";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-4xl mx-auto px-4 pt-8 relative z-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            Modul In / Out
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catat barang masuk dan keluar, riwayat tracking tersimpan otomatis
          </p>
        </div>

        {/* Tab Mode */}
        <div className="grid grid-cols-2 gap-1 bg-slate-200/80 p-1 rounded-2xl border border-slate-300">
          <button
            type="button"
            onClick={() => handleModeChange("in")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === "in"
                ? "bg-white text-emerald-600 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" /> Mode In (Masuk)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("out")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === "out"
                ? "bg-white text-red-600 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" /> Mode Out (Keluar)
          </button>
        </div>

        {!myLocation && (
          <Card className="bg-amber-50 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-800">
                Lokasi profil belum diatur
              </p>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                Modul In/Out membutuhkan lokasi pada profil akun. Hubungi admin
                untuk mengatur lokasi kamu.
              </p>
            </div>
          </Card>
        )}

        {/* Panel Utama */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-6 space-y-5">
          {/* Info lokasi */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isOut ? "Lokasi Asal" : "Lokasi Diterima"}
                </p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {myLocation?.name ?? "Belum ada lokasi"}
                </p>
              </div>
            </div>

            {isOut && (
              <div className="flex-1 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <ArrowUpFromLine className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Lokasi Tujuan
                  </p>
                  <p className="text-sm font-black text-slate-900 truncate">
                    {destinationOptions.find((loc) => loc.id === destinationId)
                      ?.name ?? "Belum dipilih"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dropdown tujuan (khusus OUT) */}
          {isOut && (
            <div className="space-y-2">
              <Label
                htmlFor="destination"
                className="text-xs font-bold text-slate-800 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-red-600" /> Pilih Lokasi Tujuan
              </Label>
              <select
                id="destination"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                disabled={loading}
                className="w-full px-4 h-11 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
              >
                <option value="">-- Pilih lokasi tujuan --</option>
                {destinationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
              {destinationOptions.length === 0 && (
                <p className="text-[11px] text-slate-400 font-medium">
                  Belum ada lokasi aktif yang bisa dipilih.
                </p>
              )}
            </div>
          )}

          {/* Form Scan / Input Manual */}
          <form
            onSubmit={handleSubmit}
            className="space-y-3 pt-4 border-t border-slate-100"
          >
            <Label
              htmlFor="serial"
              className="text-xs font-bold text-slate-800 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-slate-700" /> Scan atau Input Kode
              Paket
            </Label>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="serial"
                type="text"
                autoComplete="off"
                placeholder="Scan atau ketik serial paket lalu Enter..."
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                disabled={loading || !myLocation}
                className="flex-1 px-4 h-11 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={openCamera}
                disabled={loading || !myLocation}
                className={`h-11 px-4 rounded-xl text-white font-bold gap-2 shadow-md disabled:opacity-50 ${
                  isOut
                    ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                }`}
              >
                <Camera className="w-4 h-4" /> Buka Kamera
              </Button>
              <Button
                type="submit"
                disabled={loading || !myLocation}
                className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isOut ? (
                  <ArrowUpFromLine className="w-4 h-4" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4" />
                )}
                Catat
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              {isOut
                ? "Kode akan tercatat keluar dari lokasi asal menuju lokasi tujuan yang dipilih."
                : "Kode akan tercatat masuk ke lokasi yang terpasang pada profil akun kamu."}
            </p>
          </form>

          {/* Feedback manual */}
          {lastFeedback && (
            <div
              className={`rounded-2xl border p-3 flex items-start gap-2.5 text-xs font-semibold ${
                lastFeedback.status === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : lastFeedback.status === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {lastFeedback.status === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : lastFeedback.status === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              )}
              <p className="flex-1 leading-relaxed">{lastFeedback.message}</p>
            </div>
          )}
        </Card>

        {/* Riwayat Sesi */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-700" /> Riwayat Sesi Ini
            </h2>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-500 uppercase">
              {sessionLogs.length} transaksi
            </span>
          </div>

          {sessionLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              Belum ada barang yang dicatat pada sesi ini.
            </p>
          ) : (
            <div className="space-y-2">
              {sessionLogs.map((log) => {
                const logIsOut = log.mode === "out";
                return (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          logIsOut
                            ? "bg-red-50 border border-red-100 text-red-600"
                            : "bg-emerald-50 border border-emerald-100 text-emerald-600"
                        }`}
                      >
                        {logIsOut ? (
                          <ArrowUpFromLine className="w-4 h-4" />
                        ) : (
                          <ArrowDownToLine className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              logIsOut
                                ? "bg-red-600 text-white"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {log.mode}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {log.serial}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                          {logIsOut ? "Tujuan" : "Lokasi"}: {log.location}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {log.time}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* MODAL KAMERA */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-xl ${
                      isOut
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Auto-Scan Kamera Aktif
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Mode {isOut ? "OUT" : "IN"} &middot;{" "}
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
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                  aria-label="Tutup kamera"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
                <div id="in-out-reader-view" className="w-full h-full" />
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
                  Posisikan QR / Barcode di dalam kotak. Hasil scan akan tampil
                  di sini tanpa menutup kamera.
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
