"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  ArrowLeftRight,
  ArrowRight,
  Box,
  Building2,
  CheckCircle2,
  Clock,
  QrCode,
  Truck,
  Users,
} from "lucide-react";

// Data dummy untuk statistik.
const statsData = [
  {
    title: "Total Paket Aktif",
    value: "1,248",
    change: "+12% dari bulan lalu",
    icon: Box,
  },
  {
    title: "Dalam Perjalanan",
    value: "324",
    change: "Antar pabrik & gudang",
    icon: Truck,
  },
  {
    title: "Berhasil Diterima",
    value: "892",
    change: "Terkonfirmasi di gudang",
    icon: CheckCircle2,
  },
  {
    title: "Staf Operasional",
    value: "24",
    change: "Aktif bertugas",
    icon: Users,
  },
];

// Data dummy untuk histori scan / tracking terbaru.
const recentLogs = [
  {
    id: "1",
    serial: "CRT-20261109-001",
    level: "Karton",
    action: "DISPATCH",
    location: "Pabrik Utama",
    staff: "Budi Santoso",
    time: "10:45",
  },
  {
    id: "2",
    serial: "BAL-20261109-042",
    level: "Bal",
    action: "ARRIVED",
    location: "Gudang A Surabaya",
    staff: "Siti Rahma",
    time: "10:30",
  },
  {
    id: "3",
    serial: "SLP-20261109-112",
    level: "Slop",
    action: "CREATED",
    location: "Pabrik Utama",
    staff: "Ahmad Fauzi",
    time: "09:50",
  },
  {
    id: "4",
    serial: "CRT-20261108-019",
    level: "Karton",
    action: "ARRIVED",
    location: "Gudang B Malang",
    staff: "Joko Anwar",
    time: "09:15",
  },
];

const nodes = [
  { name: "Pabrik Utama", role: "Generator & Packing Hub" },
  { name: "Gudang A Surabaya", role: "Pusat Penerimaan & Distribusi" },
  { name: "Gudang B Malang", role: "Transit & Storage Regional" },
];

const actionStyles: Record<string, string> = {
  DISPATCH: "border-amber-300 bg-amber-50 text-amber-800",
  ARRIVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  CREATED: "border-slate-300 bg-slate-100 text-slate-700",
};

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Modul Operasional"
          title="Dashboard"
          description="Pantau arus distribusi paket Karton → Bal → Slop secara real-time."
          actions={
            <>
              <Link href="/in-out">
                <Button variant="outline" className="gap-2">
                  <ArrowLeftRight className="h-4 w-4" /> In/Out
                </Button>
              </Link>
              <Link href="/generator">
                <Button className="gap-2">
                  <QrCode className="h-4 w-4" /> Generator
                </Button>
              </Link>
            </>
          }
        />

        {/* Statistik */}
        <div className="grid grid-cols-1 gap-px border border-slate-300 bg-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          {statsData.map((stat) => {
            const Icon = stat.icon;
            return (
              <article key={stat.title} className="bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {stat.title}
                  </p>
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                  {stat.change}
                </p>
              </article>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Aktivitas terakhir */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Aktivitas Tracking Terakhir</CardTitle>
                <CardDescription className="mt-1">
                  Log pemindaian karton, bal, dan slop di lapangan.
                </CardDescription>
              </div>
              <Link href="/package">
                <Button variant="ghost" size="sm" className="gap-1">
                  Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>

            <div className="divide-y divide-slate-200">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 font-mono text-[10px] font-bold text-slate-600">
                      {log.level.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs font-bold text-slate-900">
                          {log.serial}
                        </p>
                        <span
                          className={`border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                            actionStyles[log.action] ??
                            "border-slate-300 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.action}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Lokasi:{" "}
                        <span className="font-semibold text-slate-700">
                          {log.location}
                        </span>{" "}
                        &middot; Oleh: {log.staff}
                      </p>
                    </div>
                  </div>
                  <p className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-500">
                    <Clock className="h-3 w-3" /> {log.time}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Status node */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Status Node Lokasi</CardTitle>
              <CardDescription className="mt-1">
                Konektivitas pabrik & gudang aktif.
              </CardDescription>
            </CardHeader>

            <div className="flex-1 divide-y divide-slate-200">
              {nodes.map((node) => (
                <div
                  key={node.name}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-slate-50">
                      <Building2 className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {node.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {node.role}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-emerald-500" />
                    <span className="text-[9px] font-bold tracking-wide text-emerald-700 uppercase">
                      Online
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-300 bg-slate-50 p-3">
              <Link href="/generator">
                <Button className="w-full gap-2">
                  <QrCode className="h-4 w-4" /> Generator Kode
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
