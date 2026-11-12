"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  Search,
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

export default function QuickScanPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

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

        router.push(`/tracking/${data.id}`);
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
    const scanner = new Html5Qrcode("quick-scan-reader", {
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
  }, [resolveCode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void resolveCode(input);
  };

  const handleRetry = () => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    isProcessingRef.current = false;
    setFeedback(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      <main className="max-w-lg mx-auto relative z-10 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl border-slate-200 bg-white"
              aria-label="Kembali ke beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Track Paket
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Scan QR / Barcode satu paket, langsung ke detailnya.
            </p>
          </div>
        </div>

        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Camera className="w-4 h-4 text-red-600" /> Kamera Scanner
          </div>

          <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
            <div id="quick-scan-reader" className="w-full h-full" />
          </div>

          {feedback ? (
            <div
              className={`rounded-2xl border p-3 flex items-start gap-2.5 text-xs font-semibold ${
                feedback.status === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : feedback.status === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
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
          ) : (
            <p className="text-center text-[11px] text-slate-500 font-medium">
              Posisikan QR / Barcode di dalam kotak. Hasil scan langsung membuka
              detail paket.
            </p>
          )}

          {feedback?.status === "error" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              className="w-full h-10 rounded-xl border-slate-200 font-bold text-xs gap-2"
            >
              <ScanLine className="w-4 h-4" /> Coba Scan Lagi
            </Button>
          )}
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Search className="w-4 h-4 text-slate-500" /> Atau ketik nomor seri
            manual
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="cth: SLP-936677-5775"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-bold focus-visible:ring-red-500"
            />
            <Button
              type="submit"
              disabled={!input.trim() || feedback?.status === "processing"}
              className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 disabled:opacity-50"
            >
              Cari <Search className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
