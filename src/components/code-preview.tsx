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
  red: { active: "bg-red-600 text-white border-red-600" },
  amber: { active: "bg-amber-500 text-white border-amber-500" },
  slate: { active: "bg-slate-800 text-white border-slate-800" },
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
          className="group relative bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-center w-24 h-24 cursor-zoom-in hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-white/90 p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
          className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-0.5"
        >
          <button
            type="button"
            onClick={() => handleCodeTypeChange("qr")}
            disabled={saving}
            aria-pressed={codeType === "qr"}
            title="Tampilkan sebagai QR Code"
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              codeType === "qr"
                ? theme.active
                : "border-transparent text-slate-500 hover:text-slate-800"
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
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              codeType === "barcode"
                ? theme.active
                : "border-transparent text-slate-500 hover:text-slate-800"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Kode Paket
                </p>
                <p className="text-sm font-black text-slate-900 break-all mt-0.5">
                  {value}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
              {codeType === "qr" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
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
      )}
    </>
  );
}
