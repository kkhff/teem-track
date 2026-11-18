"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Barcode, Loader2, Maximize2, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { BarcodeLabel } from "@/components/barcode-label";

type CodeType = "qr" | "barcode";
type Accent = "red" | "amber" | "slate";

interface CodePreviewProps {
  packageId: string;
  value: string;
  codeType: CodeType;
  accent?: Accent;
  onCodeTypeChange?: (codeType: CodeType) => void;
}

const accentStyles: Record<Accent, { active: string }> = {
  red: { active: "border-slate-900 bg-slate-900 text-white" },
  amber: { active: "border-amber-700 bg-amber-600 text-white" },
  slate: { active: "border-slate-800 bg-slate-800 text-white" },
};

export function CodePreview({
  packageId,
  value,
  codeType,
  accent = "slate",
  onCodeTypeChange,
}: CodePreviewProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingType, setPendingType] = useState<CodeType | null>(null);
  const theme = accentStyles[accent];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleCodeTypeChange = async (nextType: CodeType) => {
    if (nextType === codeType || saving) return;

    const previousType = codeType;

    try {
      setSaving(true);
      setPendingType(nextType);
      // Optimistic: langsung ubah tampilan, lalu simpan ke database
      onCodeTypeChange?.(nextType);

      const res = await fetch("/api/tracking/code-type", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: packageId, code_type: nextType }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Gagal mengubah tipe kode.");
      }

      const affected =
        typeof data?.affected === "number" ? (data.affected as number) : null;
      toast.success(
        `Tipe kode diubah ke ${nextType === "qr" ? "QR Code" : "Barcode"}${
          affected ? ` untuk seluruh ${affected} item dalam satu set` : ""
        }.`
      );
    } catch (err) {
      // Batalkan perubahan tampilan kalau penyimpanan gagal
      onCodeTypeChange?.(previousType);
      const message =
        err instanceof Error ? err.message : "Gagal mengubah tipe kode.";
      console.error(err);
      toast.error(message);
    } finally {
      setSaving(false);
      setPendingType(null);
    }
  };

  const renderToggleIcon = (type: CodeType) =>
    saving && pendingType === type ? (
      <Loader2 className="w-3 h-3 animate-spin" />
    ) : type === "qr" ? (
      <QrCode className="w-3 h-3" />
    ) : (
      <Barcode className="w-3 h-3" />
    );

  return (
    <>
      <div className="flex flex-col items-center gap-2 self-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Klik untuk memperbesar kode"
          aria-label={`Perbesar kode ${value}`}
          className="group relative flex h-24 w-24 cursor-zoom-in items-center justify-center border border-slate-300 bg-white p-3 transition-colors hover:border-slate-900"
        >
          <span className="pointer-events-none absolute top-1.5 right-1.5 bg-white/90 p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="w-3 h-3" />
          </span>

          {codeType === "barcode" ? (
            <BarcodeLabel value={value} />
          ) : (
            <QRCodeSVG value={value} size={72} level="M" />
          )}
        </button>

        <div
          role="group"
          aria-label="Ganti tipe kode"
          className="flex items-center border border-slate-300 bg-slate-100 p-0"
        >
          <button
            type="button"
            onClick={() => handleCodeTypeChange("qr")}
            disabled={saving}
            aria-pressed={codeType === "qr"}
            title="Tampilkan sebagai QR Code"
            className={`flex items-center gap-1 border border-transparent px-2 py-1 text-[9px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              codeType === "qr"
                ? theme.active
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {renderToggleIcon("qr")}
            QR
          </button>
          <button
            type="button"
            onClick={() => handleCodeTypeChange("barcode")}
            disabled={saving}
            aria-pressed={codeType === "barcode"}
            title="Tampilkan sebagai Barcode"
            className={`flex items-center gap-1 border border-transparent px-2 py-1 text-[9px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              codeType === "barcode"
                ? theme.active
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {renderToggleIcon("barcode")}
            Barcode
          </button>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Kode ${value}`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-300 bg-white"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-300 bg-slate-50 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                  Kode Paket
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold break-all text-slate-900">
                  {value}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="shrink-0 border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex min-h-[260px] items-center justify-center border border-slate-300 bg-slate-50 p-6">
                {codeType === "qr" ? (
                  <div className="border border-slate-300 bg-white p-3">
                    <QRCodeSVG value={value} size={220} level="M" />
                  </div>
                ) : (
                  <BarcodeLabel value={value} height={80} />
                )}
              </div>

              <p className="text-center text-[10px] font-medium text-slate-400">
                Klik di luar kartu atau tekan Esc untuk menutup.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
