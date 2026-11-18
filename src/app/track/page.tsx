import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuickTrackCard } from "@/components/quick-track-card";

export default function QuickScanPage() {
  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 border border-slate-300 bg-white p-4">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              aria-label="Kembali ke beranda"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
              Portal Pelacakan
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Track Paket
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Scan QR / barcode atau ketik nomor seri.
            </p>
          </div>
        </div>

        <QuickTrackCard />
      </main>
    </div>
  );
}
