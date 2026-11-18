import { QuickTrackCard } from "@/components/quick-track-card";
import {
  PackageSearch,
  ScanLine,
  Search,
  ShieldCheck,
} from "lucide-react";

const steps = [
  {
    icon: ScanLine,
    title: "Scan QR / Barcode",
    description:
      "Arahkan kamera ke QR atau barcode yang ada di kemasan paket.",
  },
  {
    icon: Search,
    title: "Atau Input Manual",
    description:
      "Kalau kamera tidak memungkinkan, ketik nomor seri paket secara manual.",
  },
  {
    icon: PackageSearch,
    title: "Langsung ke Detail",
    description:
      "Sistem menampilkan detail paket, level kemasan, dan riwayat pergerakannya.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Hero */}
        <section className="grid gap-6 border border-slate-300 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:p-8">
          <div>
            <span className="inline-flex items-center gap-2 border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-slate-600 uppercase">
              <ShieldCheck className="h-3.5 w-3.5" /> Portal Pelacakan Paket
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Lacak Paket dari{" "}
              <span className="underline decoration-slate-300 decoration-4 underline-offset-4">
                Kode di Kemasan
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Scan QR / barcode atau masukkan nomor seri untuk melihat detail
              paket, level kemasan, dan riwayat pergerakannya. Tanpa perlu
              login.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-px border border-slate-300 bg-slate-300">
              {[
                { label: "Input", value: "Serial" },
                { label: "Metode", value: "Scan" },
                { label: "Output", value: "Detail" },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <QuickTrackCard />
        </section>

        {/* Cara Kerja */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 border-b border-slate-300 pb-2">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
                Cara Kerja
              </p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">
                Tiga Langkah Cek Paket
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-400">
              01 — 03
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="border border-slate-300 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
                    <h3 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                      {step.title}
                    </h3>
                    <span className="font-mono text-xs font-bold text-slate-400">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="p-4">
                    <Icon className="h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {step.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-slate-300 pt-4 text-center text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
          Teem.id Supply Chain &middot; Portal Pelacakan Paket &amp; Pasokan
        </footer>
      </main>
    </div>
  );
}
