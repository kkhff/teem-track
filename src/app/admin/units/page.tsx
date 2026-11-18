"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Layers, Plus, Trash2, Pencil, Loader2, RefreshCw, AlertCircle, QrCode } from "lucide-react";

interface DefaultUnitLevel {
  id: string;
  level_name: string;
  hierarchy_order: number;
  capacity_to_child: number | null;
  serial_template: string | null;
}

export default function AdminDefaultUnitsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [units, setUnits] = useState<DefaultUnitLevel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal Form (Tambah/Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DefaultUnitLevel | null>(null);
  const [levelName, setLevelName] = useState("");
  const [hierarchyOrder, setHierarchyOrder] = useState<number>(1);
  const [capacityToChild, setCapacityToChild] = useState<string>(""); // Menggunakan string agar bisa menerima input "0" atau kosong
  const [serialTemplate, setSerialTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  // State Delete Confirmation
  const [deletingUnit, setDeletingUnit] = useState<DefaultUnitLevel | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Verifikasi Hak Akses Admin
  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
    return () => { active = false; };
  }, [router, supabase]);

  const fetchUnits = useCallback(async () => {
    const { data, error } = await supabase
      .from("default_unit_levels")
      .select("*")
      .order("hierarchy_order", { ascending: true });

    if (error) {
      toast.error("Gagal memuat data satuan default.");
    } else {
      setUnits(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (access !== "allowed") return;

    let active = true;

    const loadUnits = async () => {
      const { data, error } = await supabase
        .from("default_unit_levels")
        .select("*")
        .order("hierarchy_order", { ascending: true });

      if (!active) return;

      if (error) {
        toast.error("Gagal memuat data satuan default.");
      } else {
        setUnits(data ?? []);
      }
      setLoading(false);
    };

    void loadUnits();

    return () => {
      active = false;
    };
  }, [access, supabase]);

  const handleOpenAddModal = () => {
    setEditingUnit(null);
    setLevelName("");
    setHierarchyOrder(units.length + 1);
    setCapacityToChild("0"); // Default 0 untuk level dasar/terbawah
    setSerialTemplate("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (unit: DefaultUnitLevel) => {
    setEditingUnit(unit);
    setLevelName(unit.level_name);
    setHierarchyOrder(unit.hierarchy_order);
    // Jika nilainya 0 atau null, set ke string "0" atau kosong dengan aman
    setCapacityToChild(unit.capacity_to_child !== null && unit.capacity_to_child !== undefined ? unit.capacity_to_child.toString() : "0");
    setSerialTemplate(unit.serial_template ?? "");
    setModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelName.trim()) {
      toast.error("Nama tingkat satuan wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      // Parsing aman: jika kosong atau string kosong, jadikan 0 atau null
      const parsedCapacity = capacityToChild.trim() === "" ? 0 : Number(capacityToChild);

      const payload = {
        level_name: levelName.trim().toUpperCase(),
        hierarchy_order: Number(hierarchyOrder),
        capacity_to_child: parsedCapacity,
        serial_template: serialTemplate.trim() ? serialTemplate.trim().toUpperCase() : null,
      };

      if (editingUnit) {
        const { error } = await supabase
          .from("default_unit_levels")
          .update(payload)
          .eq("id", editingUnit.id);
        if (error) throw error;
        toast.success("Satuan default berhasil diperbarui.");
      } else {
        const { error } = await supabase
          .from("default_unit_levels")
          .insert([payload]);
        if (error) throw error;
        toast.success("Satuan default berhasil ditambahkan.");
      }

      setModalOpen(false);
      setLoading(true);
      void fetchUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan satuan.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return;
    try {
      setDeletingBusy(true);
      const { error } = await supabase
        .from("default_unit_levels")
        .delete()
        .eq("id", deletingUnit.id);

      if (error) throw error;
      toast.success("Satuan default berhasil dihapus.");
      setDeletingUnit(null);
      setLoading(true);
      void fetchUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus satuan.";
      toast.error(msg);
    } finally {
      setDeletingBusy(false);
    }
  };

  if (access !== "allowed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 font-sans text-slate-900">
        <Card className="w-full max-w-sm space-y-3 p-6 text-center border-slate-300">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-50 text-slate-500">
            {access === "denied" ? <AlertCircle className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
          </div>
          <p className="text-sm font-bold text-slate-900">
            {access === "denied" ? "Akses ditolak" : "Memeriksa akses..."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Administrasi Sistem"
          title="Pengaturan Satuan Default"
          description="Atur tingkatan kemasan default beserta template format serial otomatis yang diterapkan pada produk baru."
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setLoading(true); void fetchUnits(); }}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Muat Ulang
              </Button>
              <Button
                type="button"
                onClick={handleOpenAddModal}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Tambah Tingkatan
              </Button>
            </div>
          }
        />

        {/* Tabel Daftar Satuan Default */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 border border-slate-300 bg-white py-16 text-xs font-bold tracking-wide text-slate-500 uppercase">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data satuan...
          </div>
        ) : units.length === 0 ? (
          <Card className="space-y-3 p-10 text-center border-slate-300">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-50 text-slate-400">
              <Layers className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Belum ada tingkat satuan default</p>
            <p className="text-xs text-slate-500">Tambahkan tingkatan kemasan pertama untuk dijadikan template.</p>
            <Button type="button" onClick={handleOpenAddModal} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Tingkatan
            </Button>
          </Card>
        ) : (
          <div className="border border-slate-300 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-700 uppercase">
                Hierarki Kemasan Default & Template Serial
              </p>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                {units.length} Tingkatan Aktif
              </span>
            </div>
            
            <div className="divide-y divide-slate-200">
              {units.map((unit) => (
                <div key={unit.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-slate-100 font-mono text-xs font-bold text-slate-700">
                      #{unit.hierarchy_order}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                          {unit.level_name}
                        </h3>
                        {unit.serial_template && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-slate-100 border border-slate-300 px-2 py-0.5 text-slate-700 font-semibold">
                            <QrCode className="h-3 w-3 text-slate-500" /> {unit.serial_template}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Kapasitas muat ke level bawah:{" "}
                        <span className="font-bold text-slate-800">
                          {unit.capacity_to_child !== null && unit.capacity_to_child !== undefined && unit.capacity_to_child > 0 
                            ? `${unit.capacity_to_child} unit` 
                            : "0 / Level Terbawah (Dasar)"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(unit)}
                      className="h-9 px-3 gap-1.5 text-xs font-semibold"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingUnit(unit)}
                      className="h-9 px-3 gap-1.5 text-xs font-semibold border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL TAMBAH / EDIT SATUAN */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div 
            className="w-full max-w-md border border-slate-300 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {editingUnit ? "Edit Tingkat Satuan" : "Tambah Tingkat Satuan Baru"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="h-7 w-7 p-0"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="level-name">Nama Tingkatan (Level)</Label>
                <Input
                  id="level-name"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  placeholder="Contoh: Karton, Bal, Slop"
                  disabled={saving}
                  required
                  className="h-10 text-sm font-semibold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hierarchy-order">Urutan Hierarki</Label>
                  <Input
                    id="hierarchy-order"
                    type="number"
                    min={1}
                    value={hierarchyOrder}
                    onChange={(e) => setHierarchyOrder(Number(e.target.value))}
                    disabled={saving}
                    required
                    className="h-10 font-mono text-sm"
                  />
                  <p className="text-[10px] text-slate-400">1 = Level Tertinggi</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Kapasitas Isi</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={0}
                    value={capacityToChild}
                    onChange={(e) => setCapacityToChild(e.target.value)}
                    placeholder="0"
                    disabled={saving}
                    className="h-10 font-mono text-sm"
                  />
                  <p className="text-[10px] text-slate-400">Isi 0 untuk level dasar</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="serial-template">Template Format Serial (Opsional)</Label>
                <Input
                  id="serial-template"
                  value={serialTemplate}
                  onChange={(e) => setSerialTemplate(e.target.value)}
                  placeholder="Contoh: SLP-XXXX-YY atau CRT-YY-XXXX"
                  disabled={saving}
                  className="h-10 font-mono text-sm uppercase"
                />
                <p className="text-[10px] text-slate-500">
                  Gunakan <code className="bg-slate-100 px-1 font-bold">XXXX</code> untuk nomor acak/unik dan <code className="bg-slate-100 px-1 font-bold">YY</code> untuk kode konstan.
                </p>
              </div>

              <div className="flex gap-2 border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Satuan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deletingUnit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => !deletingBusy && setDeletingUnit(null)}
        >
          <div 
            className="w-full max-w-sm border border-slate-300 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Hapus Tingkatan Satuan</h2>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-xs text-slate-600">
                Apakah kamu yakin ingin menghapus tingkatan <span className="font-bold text-slate-900 uppercase">{deletingUnit.level_name}</span>?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletingBusy}
                  onClick={() => setDeletingUnit(null)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingBusy}
                  onClick={() => void handleDeleteUnit()}
                  className="flex-1"
                >
                  {deletingBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Menghapus...</> : "Ya, Hapus"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}