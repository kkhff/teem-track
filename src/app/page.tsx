import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative selection:bg-red-500 selection:text-white">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none fixed" />

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-20 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-600 text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Portal Pelacakan Paket
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-[1.15]">
            Lacak Paket Cukup dari{" "}
            <span className="text-red-600">Kode di Kemasan</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
            Scan QR / barcode atau masukkan nomor seri untuk melihat detail
            paket, level kemasan, dan riwayat pergerakannya. Tanpa perlu login.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/scan">
              <Button
                size="lg"
                className="h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 shadow-lg shadow-red-600/25 gap-2"
              >
                <ScanLine className="w-4 h-4" /> Track Paket
              </Button>
            </Link>
          </div>
        </div>

        {/* Cara Kerja */}
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Cara Kerja
            </h2>
            <p className="text-xl font-black text-slate-900">
              Tiga Langkah Cek Paket
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.title}
                  className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-2xl font-black text-slate-200">
                        0{index + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {step.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/scan">
              <Button className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 gap-2">
                Mulai Track Sekarang <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-slate-200 text-center text-[11px] font-semibold text-slate-400">
          Teem.id Supply Chain &middot; Portal pelacakan paket &amp; pasokan
        </footer>
      </main>
    </div>
  );
}
