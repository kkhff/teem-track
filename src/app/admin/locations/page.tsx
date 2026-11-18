"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Factory,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";

type LocationType = "factory" | "warehouse";

interface Location {
  id: string;
  name: string;
  type: string;
  address: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const TYPE_LABEL: Record<string, string> = {
  factory: "Pabrik",
  warehouse: "Gudang",
};

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type;
}

function LocationIcon({ type, className }: { type: string; className?: string }) {
  return type === "factory" ? (
    <Factory className={className} />
  ) : (
    <Warehouse className={className} />
  );
}

interface LocationFormModalProps {
  location: Location | null;
  onClose: () => void;
  onSaved: (location: Location) => void;
}

function LocationFormModal({
  location,
  onClose,
  onSaved,
}: LocationFormModalProps) {
  const [name, setName] = useState((location?.name ?? "").trim());
  const [type, setType] = useState<LocationType>(
    location?.type === "warehouse" ? "warehouse" : "factory"
  );
  const [address, setAddress] = useState((location?.address ?? "").trim());
  const [isActive, setIsActive] = useState(location?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Nama lokasi wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: trimmedName,
        type,
        address: address.trim(),
        is_active: isActive,
      };

      const res = await fetch(
        location ? `/api/admin/locations/${location.id}` : "/api/admin/locations",
        {
          method: location ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as {
        location?: Location;
        error?: string;
      };

      if (!res.ok || !data.location) {
        throw new Error(data.error || "Gagal menyimpan lokasi.");
      }

      toast.success(location ? "Lokasi diperbarui." : "Lokasi ditambahkan.");
      onSaved(data.location);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan lokasi.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto border border-slate-300 bg-white sm:max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                {location ? "Edit Lokasi" : "Tambah Lokasi"}
              </h2>
              <p className="text-[10px] text-slate-500">
                {location
                  ? "Ubah nama, tipe, alamat, atau status."
                  : "Isi data pabrik atau gudang baru."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="location-name">Nama Lokasi</Label>
            <Input
              id="location-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: PT Indokretek / Gudang A"
              disabled={saving}
              autoFocus
              className="h-10 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location-type">Tipe</Label>
            <select
              id="location-type"
              value={type}
              onChange={(event) => setType(event.target.value as LocationType)}
              disabled={saving}
              className="h-10 w-full appearance-none rounded-none border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="factory">Pabrik (Factory)</option>
              <option value="warehouse">Gudang (Warehouse)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location-address">
              Alamat{" "}
              <span className="font-medium text-slate-400 normal-case">
                (opsional)
              </span>
            </Label>
            <Input
              id="location-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Alamat lokasi"
              disabled={saving}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsActive(true)}
                className={`h-10 border text-[11px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60 ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsActive(false)}
                className={`h-10 border text-[11px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60 ${
                  !isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Nonaktif
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Lokasi nonaktif tidak muncul di pilihan tujuan In/Out.
            </p>
          </div>

          <div className="flex gap-2 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLocationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(
    "checking"
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LocationType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Pastikan hanya admin yang bisa membuka halaman ini.
  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (data?.role !== "admin") {
        setAccess("denied");
        toast.error("Akses ditolak. Halaman ini khusus admin.");
        router.replace("/dashboard");
        return;
      }

      setAccess("allowed");
    };

    void checkAccess();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const fetchLocations = useCallback(async (): Promise<Location[]> => {
    const res = await fetch("/api/admin/locations");
    const data = (await res.json()) as {
      locations?: Location[];
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || "Gagal memuat lokasi.");
    }

    return data.locations ?? [];
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;

    let active = true;

    const load = async () => {
      try {
        const items = await fetchLocations();
        if (active) setLocations(items);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Gagal memuat lokasi.";
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [access, fetchLocations]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      setLocations(await fetchLocations());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat lokasi.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      if (typeFilter !== "all" && location.type !== typeFilter) return false;
      if (!query) return true;

      return (
        location.name.toLowerCase().includes(query) ||
        (location.address ?? "").toLowerCase().includes(query)
      );
    });
  }, [locations, search, typeFilter]);

  const handleSaved = (location: Location) => {
    setLocations((current) => {
      const exists = current.some((item) => item.id === location.id);
      const next = exists
        ? current.map((item) => (item.id === location.id ? location : item))
        : [...current, location];

      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setFormOpen(false);
    setEditing(null);
  };

  const handleToggleActive = async (location: Location) => {
    try {
      setTogglingId(location.id);
      const res = await fetch(`/api/admin/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !location.is_active }),
      });
      const data = (await res.json()) as {
        location?: Location;
        error?: string;
      };

      if (!res.ok || !data.location) {
        throw new Error(data.error || "Gagal mengubah status lokasi.");
      }

      const updated = data.location;

      setLocations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success(
        updated.is_active ? "Lokasi diaktifkan." : "Lokasi dinonaktifkan."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengubah status lokasi.";
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;

    try {
      setDeletingBusy(true);
      const res = await fetch(`/api/admin/locations/${deleting.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus lokasi.");
      }

      setLocations((current) =>
        current.filter((item) => item.id !== deleting.id)
      );
      toast.success("Lokasi dihapus.");
      setDeleting(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus lokasi.";
      toast.error(message);
    } finally {
      setDeletingBusy(false);
    }
  };

  if (access !== "allowed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 font-sans text-slate-900">
        <Card className="w-full max-w-sm space-y-3 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-50 text-slate-500">
            {access === "denied" ? (
              <AlertCircle className="h-6 w-6" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <p className="text-sm font-bold text-slate-900">
            {access === "denied" ? "Akses ditolak" : "Memeriksa akses..."}
          </p>
          <p className="text-xs text-slate-500">
            {access === "denied"
              ? "Halaman ini hanya untuk admin."
              : "Sebentar, kami memverifikasi akun kamu."}
          </p>
          {access === "denied" && (
            <Link href="/dashboard" className="inline-block">
              <Button>Kembali ke Dashboard</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Administrasi"
          title="Locations"
          description="Kelola pabrik dan gudang."
          actions={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Tambah Lokasi
            </Button>
          }
        />

        {/* Pencarian & filter */}
        <Card className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau alamat..."
                className="h-10 pl-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={loading}
              aria-label="Muat ulang"
              title="Muat ulang"
              className="h-10 w-10 shrink-0 px-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="flex gap-1.5 border-t border-slate-200 pt-3">
            {(
              [
                { value: "all", label: "Semua" },
                { value: "factory", label: "Pabrik" },
                { value: "warehouse", label: "Gudang" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTypeFilter(option.value)}
                className={`h-9 flex-1 border text-[10px] font-bold tracking-wide uppercase transition-colors ${
                  typeFilter === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Daftar lokasi */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 border border-slate-300 bg-white py-16 text-xs font-bold tracking-wide text-slate-500 uppercase">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat lokasi...
          </div>
        ) : filteredLocations.length === 0 ? (
          <Card className="space-y-3 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-50 text-slate-400">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              {search.trim() || typeFilter !== "all"
                ? "Lokasi tidak ditemukan"
                : "Belum ada lokasi"}
            </p>
            <p className="text-xs text-slate-500">
              {search.trim() || typeFilter !== "all"
                ? "Coba ubah kata kunci atau filter."
                : "Tambahkan pabrik atau gudang pertama."}
            </p>
            {!search.trim() && typeFilter === "all" && (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Tambah Lokasi
              </Button>
            )}
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-2">
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                Daftar Lokasi
              </p>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                {filteredLocations.length} lokasi
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredLocations.map((location) => {
                const isFactory = location.type === "factory";
                const toggling = togglingId === location.id;

                return (
                  <Card
                    key={location.id}
                    className="space-y-3 p-4 transition-colors hover:border-slate-900"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
                          isFactory
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-sky-300 bg-sky-50 text-sky-700"
                        }`}
                      >
                        <LocationIcon type={location.type} className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {location.name.trim()}
                        </p>
                        <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-500">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2 break-words">
                            {location.address?.trim() || "Alamat belum diisi"}
                          </span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(location);
                            setFormOpen(true);
                          }}
                          aria-label={`Edit ${location.name}`}
                          title="Edit"
                          className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(location)}
                          aria-label={`Hapus ${location.name}`}
                          title="Hapus"
                          className="flex h-9 w-9 items-center justify-center border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`border px-2 py-1 text-[9px] font-bold tracking-wide uppercase ${
                            isFactory
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-sky-300 bg-sky-50 text-sky-800"
                          }`}
                        >
                          {typeLabel(location.type)}
                        </span>
                        <span
                          className={`border px-2 py-1 text-[9px] font-bold tracking-wide uppercase ${
                            location.is_active
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-slate-300 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {location.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleToggleActive(location)}
                        disabled={toggling}
                        className={`flex h-8 items-center gap-1.5 border px-2.5 text-[9px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60 ${
                          location.is_active
                            ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                            : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {toggling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        {location.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      {formOpen && (
        <LocationFormModal
          key={editing?.id ?? "new"}
          location={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4"
          onClick={() => {
            if (!deletingBusy) setDeleting(null);
          }}
        >
          <div
            className="w-full border border-slate-300 bg-white sm:max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2.5">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                Hapus Lokasi
              </h2>
            </div>

            <div className="space-y-4 p-4">
              <p className="text-xs break-words text-slate-600">
                <span className="font-mono font-bold text-slate-900">
                  {deleting.name.trim()}
                </span>{" "}
                akan dihapus permanen. Kalau masih dipakai, nonaktifkan saja.
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletingBusy}
                  onClick={() => setDeleting(null)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingBusy}
                  onClick={() => void handleDelete()}
                  className="flex-1"
                >
                  {deletingBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Menghapus...
                    </>
                  ) : (
                    "Hapus"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
