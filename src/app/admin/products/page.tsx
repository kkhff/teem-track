"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ImageIcon,
  Layers,
  Loader2,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  created_at?: string;
}

interface UnitLevelItem {
  id?: string;
  level_name: string;
  hierarchy_order: number;
  capacity_to_child: string | number | null; // Mendukung string/angka agar fleksibel
  serial_template: string | null;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function ProductThumb({ product }: { product: Product }) {
  if (product.image_url) {
    return (
      <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-slate-300 bg-white">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          unoptimized
          sizes="64px"
          className="object-contain p-1.5"
        />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 text-slate-400">
      <ImageIcon className="h-6 w-6" />
    </div>
  );
}

interface ProductFormModalProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [name, setName] = useState((product?.name ?? "").trim());
  const [sku, setSku] = useState((product?.sku ?? "").trim());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    product?.image_url ?? null
  );
  const [removeImage, setRemoveImage] = useState(false);

  // State satuan yang menyatu di modal produk
  const [units, setUnits] = useState<UnitLevelItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Muat satuan: jika Edit ambil dari product_unit_levels, jika Tambah ambil dari default_unit_levels
  useEffect(() => {
    let active = true;

    const loadUnits = async () => {
      setLoadingUnits(true);
      if (product) {
        const { data, error } = await supabase
          .from("product_unit_levels")
          .select("id, level_name, hierarchy_order, capacity_to_child, serial_template")
          .eq("product_id", product.id)
          .order("hierarchy_order", { ascending: true });

        if (!active) return;
        if (error) {
          toast.error("Gagal memuat satuan produk.");
        } else {
          setUnits(
            (data ?? []).map((u) => ({
              ...u,
              capacity_to_child: u.capacity_to_child !== null && u.capacity_to_child !== undefined ? u.capacity_to_child.toString() : "0",
            }))
          );
        }
      } else {
        const { data, error } = await supabase
          .from("default_unit_levels")
          .select("level_name, hierarchy_order, capacity_to_child, serial_template")
          .order("hierarchy_order", { ascending: true });

        if (!active) return;
        if (error) {
          toast.error("Gagal memuat satuan default.");
        } else {
          setUnits(
            (data ?? []).map((u) => ({
              ...u,
              capacity_to_child: u.capacity_to_child !== null && u.capacity_to_child !== undefined ? u.capacity_to_child.toString() : "0",
            }))
          );
        }
      }
      setLoadingUnits(false);
    };

    void loadUnits();
    return () => {
      active = false;
    };
  }, [product, supabase]);

  const handlePickFile = (nextFile: File | null) => {
    if (!nextFile) return;

    if (!nextFile.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }

    if (nextFile.size > MAX_IMAGE_SIZE) {
      toast.error("Ukuran gambar maksimal 5 MB.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    const url = URL.createObjectURL(nextFile);
    objectUrlRef.current = url;
    setFile(nextFile);
    setPreviewUrl(url);
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handler modifikasi list satuan di dalam modal
  const handleAddUnitRow = () => {
    setUnits((prev) => [
      ...prev,
      {
        level_name: "",
        hierarchy_order: prev.length + 1,
        capacity_to_child: "0",
        serial_template: "",
      },
    ]);
  };

  const handleUpdateUnit = (
    index: number,
    field: keyof UnitLevelItem,
    value: string | number
  ) => {
    setUnits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveUnitRow = (index: number) => {
    setUnits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedSku = sku.trim();

    if (!trimmedName) {
      toast.error("Nama produk wajib diisi.");
      return;
    }

    if (!trimmedSku) {
      toast.error("SKU wajib diisi.");
      return;
    }

    if (units.some((u) => !u.level_name.trim())) {
      toast.error("Semua nama tingkatan satuan wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      let imageUrl = removeImage ? null : (product?.image_url ?? null);

      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/admin/products/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = (await uploadRes.json()) as {
          url?: string;
          error?: string;
        };

        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || "Gagal mengunggah gambar.");
        }

        imageUrl = uploadData.url;
      }

      const payload = {
        name: trimmedName,
        sku: trimmedSku,
        image_url: imageUrl,
      };

      const res = await fetch(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as { product?: Product; error?: string };

      if (!res.ok || !data.product) {
        throw new Error(data.error || "Gagal menyimpan produk.");
      }

      const savedProduct = data.product;

      // Sinkronisasi tingkat satuan milik produk ke product_unit_levels
      const { error: deleteUnitsErr } = await supabase
        .from("product_unit_levels")
        .delete()
        .eq("product_id", savedProduct.id);

      if (deleteUnitsErr) throw deleteUnitsErr;

      if (units.length > 0) {
        const unitInserts = units.map((u, idx) => {
          // Nilai 0 sah untuk level terkecil (tidak punya isi/anak).
          // Jangan pakai `|| 1` karena itu memaksa 0 menjadi 1.
          const parsedCapacity = Number(u.capacity_to_child);
          const capacity = Number.isFinite(parsedCapacity)
            ? Math.max(0, Math.trunc(parsedCapacity))
            : 0;

          return {
            product_id: savedProduct.id,
            level_name: u.level_name.trim().toUpperCase(),
            hierarchy_order: idx + 1,
            capacity_to_child: capacity,
            serial_template: u.serial_template?.trim()
              ? u.serial_template.trim().toUpperCase()
              : null,
          };
        });

        const { error: insertUnitsErr } = await supabase
          .from("product_unit_levels")
          .insert(unitInserts);

        if (insertUnitsErr) throw insertUnitsErr;
      }

      toast.success(product ? "Produk & satuan diperbarui." : "Produk & satuan ditambahkan.");
      onSaved(savedProduct);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan produk.";
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
        className="max-h-[92vh] w-full overflow-y-auto border border-slate-300 bg-white sm:max-w-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Package className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                {product ? "Edit Produk & Satuan" : "Tambah Produk & Satuan"}
              </h2>
              <p className="text-[10px] text-slate-500">
                {product
                  ? "Ubah detail produk serta susunan tingkat satuan kemasan."
                  : "Isi detail produk baru. Satuan otomatis mengikuti template default."}
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

        <form onSubmit={handleSubmit} className="space-y-5 p-4">
          {/* Gambar */}
          <div className="space-y-1.5">
            <Label>Gambar</Label>
            <div className="flex items-center gap-3">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-slate-300 bg-slate-50">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Preview produk"
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-contain p-2"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-slate-300" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handlePickFile(event.target.files?.[0] ?? null)
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {previewUrl ? "Ganti gambar" : "Pilih gambar"}
                  </Button>

                  {previewUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={handleRemoveImage}
                      className="gap-1.5 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </Button>
                  )}
                </div>

                <p className="text-[10px] font-medium text-slate-400">
                  JPG, PNG, WEBP. Maks 5 MB.
                </p>
              </div>
            </div>
          </div>

          {/* Nama & SKU */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">Nama Produk</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Assikha Habbats"
                disabled={saving}
                autoFocus
                className="h-10 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Contoh: ASK-HBT-001"
                disabled={saving}
                className="h-10 font-mono text-sm font-semibold uppercase"
              />
            </div>
          </div>

          {/* Pengaturan Tingkat Satuan Produk (Langsung Menyatu) */}
          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-600" />
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tingkat Satuan Kemasan
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddUnitRow}
                disabled={saving || loadingUnits}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Level
              </Button>
            </div>

            {loadingUnits ? (
              <div className="flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 py-6 text-xs font-semibold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat susunan satuan...
              </div>
            ) : units.length === 0 ? (
              <div className="border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                Belum ada tingkat satuan. Klik <span className="font-bold">Tambah Level</span> untuk menambahkan.
              </div>
            ) : (
              <div className="space-y-2">
                {units.map((unit, idx) => (
                  <div
                    key={unit.id ?? `unit-${idx}`}
                    className="grid grid-cols-12 items-end gap-2 border border-slate-300 bg-slate-50/70 p-2.5"
                  >
                    <div className="col-span-1 flex h-9 items-center justify-center border border-slate-300 bg-white font-mono text-xs font-bold text-slate-600">
                      #{idx + 1}
                    </div>

                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px] text-slate-500">Nama Satuan</Label>
                      <Input
                        value={unit.level_name}
                        onChange={(e) =>
                          handleUpdateUnit(idx, "level_name", e.target.value)
                        }
                        placeholder="KARTON / BAL / SLOP"
                        disabled={saving}
                        className="h-9 bg-white text-xs font-bold uppercase"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-slate-500">Isi</Label>
                      <Input
                        type="number"
                        min={0}
                        value={unit.capacity_to_child ?? 0}
                        onChange={(e) =>
                          handleUpdateUnit(idx, "capacity_to_child", e.target.value)
                        }
                        disabled={saving}
                        className="h-9 bg-white font-mono text-xs"
                      />
                    </div>

                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px] text-slate-500">Template Serial</Label>
                      <Input
                        value={unit.serial_template ?? ""}
                        onChange={(e) =>
                          handleUpdateUnit(idx, "serial_template", e.target.value)
                        }
                        placeholder="SLP-XXXX-YY"
                        disabled={saving}
                        className="h-9 bg-white font-mono text-xs uppercase"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveUnitRow(idx)}
                        disabled={saving}
                        title="Hapus tingkatan"
                        className="flex h-9 w-9 items-center justify-center border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400">
                  Urutan #1 adalah tingkat kemasan paling besar. Isi <code className="bg-slate-100 px-1 font-bold text-slate-600">0</code> untuk level terkecil (tanpa isi). Gunakan <code className="bg-slate-100 px-1 font-bold text-slate-600">XXXX</code> untuk angka acak dan <code className="bg-slate-100 px-1 font-bold text-slate-600">YY</code> untuk kode tetap.
                </p>
              </div>
            )}
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
            <Button type="submit" disabled={saving || loadingUnits} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan Produk"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(
    "checking"
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

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

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const res = await fetch("/api/admin/products");
    const data = (await res.json()) as {
      products?: Product[];
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || "Gagal memuat produk.");
    }

    return data.products ?? [];
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;

    let active = true;

    const load = async () => {
      try {
        const items = await fetchProducts();
        if (active) setProducts(items);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Gagal memuat produk.";
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [access, fetchProducts]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      setProducts(await fetchProducts());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat produk.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)
    );
  }, [products, search]);

  const handleSaved = (product: Product) => {
    setProducts((current) => {
      const exists = current.some((item) => item.id === product.id);
      const next = exists
        ? current.map((item) => (item.id === product.id ? product : item))
        : [...current, product];

      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;

    try {
      setDeletingBusy(true);
      const res = await fetch(`/api/admin/products/${deleting.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus produk.");
      }

      setProducts((current) =>
        current.filter((item) => item.id !== deleting.id)
      );
      toast.success("Produk dihapus.");
      setDeleting(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus produk.";
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
          title="Products"
          description="Kelola nama, SKU, gambar, dan susunan tingkat satuan produk."
          actions={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          }
        />

        {/* Pencarian */}
        <div className="flex items-center gap-2 border border-slate-300 bg-white p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau SKU..."
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
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Daftar produk */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 border border-slate-300 bg-white py-16 text-xs font-bold tracking-wide text-slate-500 uppercase">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat produk...
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="space-y-3 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-50 text-slate-400">
              {search.trim() ? (
                <PackageSearch className="h-6 w-6" />
              ) : (
                <Package className="h-6 w-6" />
              )}
            </div>
            <p className="text-sm font-bold text-slate-900">
              {search.trim() ? "Produk tidak ditemukan" : "Belum ada produk"}
            </p>
            <p className="text-xs text-slate-500">
              {search.trim()
                ? "Coba kata kunci lain."
                : "Tambahkan produk pertama untuk mulai membuat paket."}
            </p>
            {!search.trim() && (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Tambah Produk
              </Button>
            )}
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-2">
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                Daftar Produk
              </p>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                {filteredProducts.length} produk
                {search.trim() ? ` / "${search.trim()}"` : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="flex items-center gap-3 p-3 transition-colors hover:border-slate-900"
                >
                  <ProductThumb product={product} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {product.name.trim()}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-slate-500 uppercase">
                      {product.sku.trim()}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                      aria-label={`Edit ${product.name}`}
                      title="Edit"
                      className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(product)}
                      aria-label={`Hapus ${product.name}`}
                      title="Hapus"
                      className="flex h-9 w-9 items-center justify-center border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      {formOpen && (
        <ProductFormModal
          key={editing?.id ?? "new"}
          product={editing}
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
                Hapus Produk
              </h2>
            </div>

            <div className="space-y-4 p-4">
              <p className="text-xs break-words text-slate-600">
                <span className="font-mono font-bold text-slate-900">
                  {deleting.name.trim()}
                </span>{" "}
                akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
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