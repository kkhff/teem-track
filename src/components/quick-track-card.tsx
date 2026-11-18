"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  QrCode,
  ScanLine,
  Search,
  X,
} from "lucide-react";

interface ScanResolveResult {
  id: string;
  serial_number: string;
  level: "karton" | "bal" | "slop";
  status: string;
}

type Feedback = {
  status: "processing" | "success" | "error";
  message: string;
} | null;

/**
 * Kartu pelacakan cepat: input serial + tombol QR (kamera muncul sebagai popup).
 * Dipakai di Beranda dan halaman Track.
 */
export function QuickTrackCard() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanSession, setScanSession] = useState(0);

  const resolveCode = useCallback(
    async (raw: string) => {
      if (isProcessingRef.current) return;

      const code = raw.trim();
      if (!code) return;

      isProcessingRef.current = true;
      setInput(code);
      setFeedback({ status: "processing", message: `Mencari kode ${code}...` });

      try {
        const res = await fetch(
          `/api/tracking/resolve?code=${encodeURIComponent(code)}`
        );
        const data = (await res.json()) as ScanResolveResult & { error?: string };

        if (!res.ok) {
          throw new Error(data?.error || "Kode paket tidak ditemukan.");
        }

        setFeedback({
          status: "success",
          message: `${data.serial_number} ditemukan. Mengarahkan ke detail...`,
        });

        router.push(`/package/${data.id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Kode paket tidak ditemukan.";
        setFeedback({ status: "error", message });
        toast.error(message);

        // Biarkan kamera bisa mencoba lagi setelah jeda singkat.
        cooldownRef.current = setTimeout(() => {
          isProcessingRef.current = false;
          setFeedback(null);
        }, 2200);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!isCameraOpen) return;

    const scanner = new Html5Qrcode("quick-track-reader", {
      verbose: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 12,
          aspectRatio: 1,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(
              Math.min(viewfinderWidth, viewfinderHeight) * 0.7
            );
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          void resolveCode(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        console.error("Gagal membuka kamera:", err);
        if (cancelled) return;
        setFeedback({
          status: "error",
          message:
            "Tidak dapat mengakses kamera. Gunakan input manual di bawah.",
        });
      });

    return () => {
      cancelled = true;
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      scannerRef.current = null;

      try {
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch {
                // abaikan
              }
            })
            .catch(() => {});
        } else {
          scanner.clear();
        }
      } catch {
        // abaikan
      }
    };
  }, [isCameraOpen, resolveCode, scanSession]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void resolveCode(input);
  };

  const handleRetry = () => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    isProcessingRef.current = false;
    setFeedback(null);
    // Mulai ulang scanner hanya kalau kamera sempat gagal.
    if (isCameraOpen && !scannerRef.current?.isScanning) {
      setScanSession((session) => session + 1);
    }
  };

  const openCamera = () => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    isProcessingRef.current = false;
    setFeedback(null);
    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    isProcessingRef.current = false;
    setFeedback(null);
    setIsCameraOpen(false);
  };

  const feedbackBox = feedback ? (
    <div
      className={`flex items-start gap-2.5 border p-3 text-xs font-semibold ${
        feedback.status === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : feedback.status === "error"
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      {feedback.status === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
      ) : feedback.status === "error" ? (
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      ) : (
        <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
      )}
      <p className="flex-1 leading-relaxed">{feedback.message}</p>
    </div>
  ) : null;

  return (
    <>
      <section className="border border-slate-300 bg-white text-left">
        <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
          <QrCode className="h-3.5 w-3.5 text-slate-500" />
          <h2 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
            Track Paket
          </h2>
        </div>

        <div className="space-y-3 p-4">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              type="text"
              enterKeyHint="go"
              placeholder="Scan / ketik nomor seri..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-11 flex-1 font-mono text-sm font-semibold"
            />
            <Button
              type="button"
              onClick={openCamera}
              aria-label="Buka kamera scan"
              title="Scan QR"
              className="h-11 w-11 shrink-0 px-0"
            >
              <QrCode className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              disabled={!input.trim() || feedback?.status === "processing"}
              aria-label="Cari paket"
              title="Cari"
              className="h-11 w-11 shrink-0 px-0"
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>

          {feedbackBox}
        </div>
      </section>

      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto border border-slate-800 bg-slate-900 sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-4 w-4 text-slate-300" />
                <div>
                  <h2 className="text-[11px] font-bold tracking-wider text-white uppercase">
                    Scan Paket
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Arahkan kamera ke kode paket.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                aria-label="Tutup kamera"
                title="Tutup"
                className="flex h-8 w-8 items-center justify-center border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className="relative h-72 w-full overflow-hidden border border-slate-700 bg-black">
                <div
                  key={scanSession}
                  id="quick-track-reader"
                  className="h-full w-full"
                />
              </div>

              {feedback ? (
                <div
                  className={`flex items-start gap-2.5 border px-3 py-2.5 text-xs font-medium ${
                    feedback.status === "success"
                      ? "border-emerald-700 bg-emerald-950/60 text-emerald-200"
                      : feedback.status === "error"
                        ? "border-red-800 bg-red-950/60 text-red-200"
                        : "border-amber-700 bg-amber-950/50 text-amber-200"
                  }`}
                >
                  {feedback.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : feedback.status === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  )}
                  <p className="flex-1 leading-relaxed">{feedback.message}</p>
                </div>
              ) : (
                <p className="text-center text-[11px] text-slate-400">
                  Arahkan QR / barcode ke kotak.
                </p>
              )}

              {feedback?.status === "error" && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex h-9 w-full items-center justify-center gap-2 border border-slate-600 bg-slate-800 text-xs font-bold tracking-wide text-white uppercase hover:bg-slate-700"
                >
                  <ScanLine className="h-4 w-4" /> Scan Lagi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
