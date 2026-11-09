"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Box, 
  Truck, 
  CheckCircle2, 
  Users, 
  Building2, 
  Clock
} from "lucide-react";

// Data Dummy untuk Statistik
const statsData = [
  { title: "Total Paket Aktif", value: "1,248", change: "+12% dari bulan lalu", icon: Box, color: "text-blue-600", bg: "bg-blue-50" },
  { title: "Dalam Perjalanan (In Transit)", value: "324", change: "Antar Pabrik & Gudang", icon: Truck, color: "text-amber-600", bg: "bg-amber-50" },
  { title: "Berhasil Diterima", value: "892", change: "Terkonfirmasi di Gudang", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  { title: "Staf Operasional", value: "24", change: "Aktif bertugas", icon: Users, color: "text-red-600", bg: "bg-red-50" },
];

// Data Dummy untuk Histori Scan / Tracking Terbaru
const recentLogs = [
  { id: "1", serial: "CRT-20261109-001", level: "Karton", action: "DISPATCH", location: "Pabrik Utama", staff: "Budi Santoso", time: "10:45 - Baru saja" },
  { id: "2", serial: "BAL-20261109-042", level: "Bal", action: "ARRIVED", location: "Gudang A Surabaya", staff: "Siti Rahma", time: "10:30 - 15 menit lalu" },
  { id: "3", serial: "SLP-20261109-112", level: "Slop", action: "CREATED", location: "Pabrik Utama", staff: "Ahmad Fauzi", time: "09:50 - 1 jam lalu" },
  { id: "4", serial: "CRT-20261108-019", level: "Karton", action: "ARRIVED", location: "Gudang B Malang", staff: "Joko Anwar", time: "09:15 - 2 jam lalu" },
];

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* Pattern Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none fixed" />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8 relative z-10 space-y-8">
        
        {/* Welcome Banner & Shortcut Aksi Cepat */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-900">Halo, Administrator 👋</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pantau arus distribusi paket (Karton &rarr; Bal &rarr; Slop) secara real-time.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statsData.map((stat, idx) => {
            const IconComponent = stat.icon;
            return (
              <Card key={idx} className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      Live
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{stat.title}</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-2">{stat.change}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Tabel Histori Log (2 Kolom) */}
          <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 px-6 pt-6">
              <div>
                <CardTitle className="text-base font-black text-slate-900">Aktivitas Tracking Terakhir</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Log pemindaian barcode karton, bal, dan slop di lapangan</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl">
                Lihat Semua
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        log.action === 'DISPATCH' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        log.action === 'ARRIVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {log.level.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">{log.serial}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold ${
                            log.action === 'DISPATCH' ? 'bg-amber-100 text-amber-700' :
                            log.action === 'ARRIVED' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Lokasi: <span className="font-semibold text-slate-700">{log.location}</span> • Oleh: {log.staff}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {log.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info / Lokasi Pabrik & Gudang (1 Kolom) */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
                <CardTitle className="text-base font-black text-slate-900">Status Node Lokasi</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Konektivitas pabrik & gudang aktif</p>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                      <Building2 className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Pabrik Utama</p>
                      <p className="text-[10px] text-slate-500">Generator & Packing Hub</p>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50" />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Gudang A Surabaya</p>
                      <p className="text-[10px] text-slate-500">Pusat Penerimaan & Distribusi</p>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50" />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                      <Building2 className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Gudang B Malang</p>
                      <p className="text-[10px] text-slate-500">Transit & Storage Regional</p>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50" />
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0">
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-red-900">Butuh cetak QR massal?</p>
                <p className="text-[11px] text-red-700 mt-0.5">Akses menu generator pabrik untuk mencetak karton.</p>
              </div>
            </div>
          </Card>

        </div>

      </main>
    </div>
  );
}