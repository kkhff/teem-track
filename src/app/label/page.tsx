"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { BarcodeLabel } from "@/components/barcode-label";
import {
  Printer,
  Loader2,
  QrCode,
  Barcode,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Tag,
  Search,
  X,
} from "lucide-react";

interface LabelItem {
  id: string;
  serial_number: string;
  level: string;
  code_type: "qr" | "barcode";
  created_at: string;
  product_id: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface UnitLevelItem {
  level_name: string;
  hierarchy_order: number;
}

function StickerPrintCard({ item }: { item: LabelItem }) {
  return (
    <div className="sticker-item flex flex-col items-center justify-center border border-slate-300 bg-white p-2 text-center">
      <div className="mb-0.5 max-w-full truncate text-[7px] font-bold tracking-wider text-slate-500 uppercase">
        {item.level} &middot; {item.product?.name || "Tanpa Produk"}
      </div>

      <div className="my-0.5 flex items-center justify-center bg-white p-0.5">
        {item.code_type === "qr" ? (
          <QRCodeSVG
            value={item.serial_number}
            size={72}
            level="M"
            marginSize={1}
          />
        ) : (
          <BarcodeLabel value={item.serial_number} height={36} />
        )}
      </div>

      <div className="mt-0.5 font-mono text-[9px] font-bold tracking-tight text-slate-900">
        {item.serial_number}
      </div>
    </div>
  );
}

export default function LabelsArchivePage() {
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  
  // Searchable Product Combobox State di Filter
  const [selectedProduct, setSelectedProduct] = useState(""); // product id
  const [productSearch, setProductSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Level satuan dinamis berdasarkan produk terpilih
  const [productLevels, setProductLevels] = useState<UnitLevelItem[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("all");
  
  const [selectedCodeType, setSelectedCodeType] = useState("all");

  // Selection States (untuk Reprint)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsToPrint, setItemsToPrint] = useState<LabelItem[]>([]);

  // Pagination States
  const [itemsPerPage, setItemsPerPage] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const supabase = useMemo(() => createClient(), []);

  // Tutup dropdown pencarian produk saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aktifkan CSS khusus print
  useEffect(() => {
    if (itemsToPrint.length === 0) return;
    document.body.classList.add("has-sticker-print");
    return () => document.body.classList.remove("has-sticker-print");
  }, [itemsToPrint.length]);

  // 1. Muat Daftar Produk untuk Combobox
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .order("name", { ascending: true });

      if (!error && data) {
        setProducts(data);
      }
    };
    void fetchProducts();
  }, [supabase]);

  // 2. Muat Level Satuan secara Dinamis ketika Produk Dipilih
  useEffect(() => {
    if (!selectedProduct) {
      setProductLevels([]);
      setSelectedLevel("all");
      return;
    }

    let active = true;
    const fetchUnits = async () => {
      setLoadingLevels(true);
      const { data, error } = await supabase
        .from("product_unit_levels")
        .select("level_name, hierarchy_order")
        .eq("product_id", selectedProduct)
        .order("hierarchy_order", { ascending: true });

      if (!active) return;

      if (!error && data) {
        setProductLevels(data);
        setSelectedLevel("all"); // Reset pilihan level saat produk diganti
      } else {
        setProductLevels([]);
        setSelectedLevel("all");
      }
      setLoadingLevels(false);
    };

    void fetchUnits();

    return () => {
      active = false;
    };
  }, [selectedProduct, supabase]);

  // Filter produk untuk combobox
  const filteredProductOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const selectedProductObj = useMemo(() => {
    return products.find((p) => p.id === selectedProduct);
  }, [products, selectedProduct]);

  // Muat data label dari tabel packages
  const loadLabels = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("packages")
        .select("id, serial_number, level, code_type, created_at, product_id, product:products(id, name, sku)")
        .order("created_at", { ascending: false })
        .limit(600);

      if (error) throw error;

      const formatted: LabelItem[] = (data ?? []).map((row) => ({
        id: row.id,
        serial_number: row.serial_number,
        level: row.level,
        code_type: row.code_type === "barcode" ? "barcode" : "qr",
        created_at: row.created_at,
        product_id: row.product_id,
        product: Array.isArray(row.product) ? row.product[0] ?? null : row.product,
      }));

      setLabels(formatted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat arsip label.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadLabels();
  }, [loadLabels]);

  // Filtering data label utama
  const filteredLabels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return labels.filter((item) => {
      const matchSearch =
        !q ||
        item.serial_number.toLowerCase().includes(q) ||
        (item.product?.name && item.product.name.toLowerCase().includes(q)) ||
        (item.product?.sku && item.product.sku.toLowerCase().includes(q));

      const matchProduct =
        !selectedProduct || item.product_id === selectedProduct;

      const matchLevel =
        selectedLevel === "all" || item.level.toLowerCase() === selectedLevel.toLowerCase();

      const matchCodeType =
        selectedCodeType === "all" || item.code_type === selectedCodeType;

      return matchSearch && matchProduct && matchLevel && matchCodeType;
    });
  }, [labels, searchQuery, selectedProduct, selectedLevel, selectedCodeType]);

  // Reset pagination saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProduct, selectedLevel, selectedCodeType, itemsPerPage]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredLabels.length / itemsPerPage) || 1;
  const paginatedLabels = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLabels.slice(start, start + itemsPerPage);
  }, [filteredLabels, currentPage, itemsPerPage]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedLabels.map((item) => item.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const triggerPrint = (targets: LabelItem[]) => {
    if (targets.length === 0) {
      toast.error("Pilih minimal 1 label untuk dicetak.");
      return;
    }
    setItemsToPrint(targets);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSelected = () => {
    const selectedItems = labels.filter((item) => selectedIds.has(item.id));
    triggerPrint(selectedItems);
  };

  const isAllPageSelected =
    paginatedLabels.length > 0 &&
    paginatedLabels.every((item) => selectedIds.has(item.id));

  return (
    <div className="min-h-screen w-full bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="no-print w-full space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader
          eyebrow="Inspeksi & Reprint"
          title="Label QR & Barcode"
          description="Periksa visual kode setiap produk dan cetak ulang stiker yang dibutuhkan."
          actions={
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs"
                >
                  Batal Pilih ({selectedIds.size})
                </Button>
              )}
              <Button
                type="button"
                onClick={handlePrintSelected}
                disabled={selectedIds.size === 0}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Cetak Terpilih ({selectedIds.size})
              </Button>
            </div>
          }
        />

        {/* Panel Filter Dinamis */}
        <section className="w-full border border-slate-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              Filter Arsip Label
            </h2>
            <span className="font-mono text-[10px] font-bold tracking-wide text-slate-500 uppercase">
              {filteredLabels.length} label ditemukan
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Search Serial Number */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Cari Nomor Seri
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Ketik nomor seri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 font-mono text-xs"
                />
              </div>
            </div>

            {/* 2. Searchable Product Combobox */}
            <div className="space-y-1.5 relative" ref={dropdownRef}>
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Filter Produk
              </p>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Semua produk (ketik untuk cari)..."
                  value={isDropdownOpen ? productSearch : (selectedProductObj ? `${selectedProductObj.name} (${selectedProductObj.sku})` : productSearch)}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (!isDropdownOpen) setIsDropdownOpen(true);
                    if (selectedProduct) setSelectedProduct(""); // Reset produk jika diketik ulang
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="h-10 pl-9 pr-8 text-xs font-semibold"
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct("");
                      setProductSearch("");
                    }}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    title="Reset filter produk"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown Hasil Pencarian Produk */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto border border-slate-300 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct("");
                      setProductSearch("");
                      setIsDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100 font-semibold"
                  >
                    -- Semua Produk --
                  </button>
                  {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p.id);
                        setProductSearch("");
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 flex flex-col ${
                        selectedProduct === p.id ? "bg-slate-100 font-bold" : ""
                      }`}
                    >
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="font-mono text-[10px] text-slate-500 uppercase">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Level Satuan Dinamis (Terkunci/Disabled jika produk belum dipilih) */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Level Satuan (Dinamis)
              </p>
              {loadingLevels ? (
                <div className="flex h-10 items-center justify-center gap-1 border border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat level...
                </div>
              ) : (
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  disabled={!selectedProduct || productLevels.length === 0}
                  className="h-10 w-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 uppercase focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="all">
                    {!selectedProduct ? "Pilih produk dulu" : productLevels.length === 0 ? "Tidak ada level" : "Semua Level"}
                  </option>
                  {productLevels.map((lvl) => (
                    <option key={lvl.level_name} value={lvl.level_name}>
                      {lvl.level_name.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 4. Format Kode */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Format Kode
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Semua", value: "all" },
                  { label: "QR", value: "qr" },
                  { label: "Barcode", value: "barcode" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSelectedCodeType(tab.value)}
                    className={`h-10 border text-[11px] font-bold tracking-wide uppercase transition-colors ${
                      selectedCodeType === tab.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Grid Katalog QR & Barcode (10 Kolom) */}
        <section className="w-full border border-slate-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectPage}
                disabled={paginatedLabels.length === 0}
                className="flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-700 uppercase hover:bg-slate-100 disabled:opacity-50"
              >
                {isAllPageSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-slate-900" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                )}
                Pilih Halaman Ini
              </button>

              <span className="font-mono text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Menampilkan {(currentPage - 1) * itemsPerPage + (paginatedLabels.length > 0 ? 1 : 0)} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredLabels.length)} dari {filteredLabels.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Tampil:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="cursor-pointer border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 border border-slate-300 bg-slate-50 py-14 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data label...
              </div>
            ) : filteredLabels.length === 0 ? (
              <div className="border border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border border-slate-300 bg-white text-slate-400">
                  <Tag className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Tidak ada label yang cocok
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ubah filter produk atau level satuan di atas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                {paginatedLabels.map((item) => {
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`group relative flex cursor-pointer flex-col justify-between border p-2 transition-colors ${
                        isSelected
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "border-slate-300 bg-white hover:border-slate-500"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-0.5 border border-slate-700 bg-slate-800 px-1 py-0.2 text-[8px] font-bold tracking-wide text-white uppercase">
                          {item.code_type === "qr" ? (
                            <QrCode className="h-2 w-2" />
                          ) : (
                            <Barcode className="h-2 w-2" />
                          )}
                          {item.level}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item.id);
                          }}
                          className="text-slate-600 hover:text-slate-900"
                          aria-label="Pilih label"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-slate-900" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </button>
                      </div>

                      <div className="my-1 flex min-h-[80px] items-center justify-center border border-slate-200 bg-white p-1">
                        {item.code_type === "qr" ? (
                          <QRCodeSVG
                            value={item.serial_number}
                            size={64}
                            level="M"
                            marginSize={1}
                          />
                        ) : (
                          <BarcodeLabel value={item.serial_number} height={32} />
                        )}
                      </div>

                      <div className="space-y-0.5 text-center">
                        <p
                          className="truncate font-mono text-[10px] font-bold text-slate-900"
                          title={item.serial_number}
                        >
                          {item.serial_number}
                        </p>
                        <p
                          className="truncate text-[9px] font-medium text-slate-600"
                          title={item.product?.name || "Tanpa Produk"}
                        >
                          {item.product?.name || "Tanpa Produk"}
                        </p>
                      </div>

                      <div className="mt-2 border-t border-slate-200 pt-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerPrint([item]);
                          }}
                          className="flex h-6 w-full items-center justify-center gap-1 border border-slate-300 bg-white text-[9px] font-bold tracking-wide text-slate-700 uppercase transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                        >
                          <Printer className="h-2.5 w-2.5" /> Cetak
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kontrol Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                <p className="text-xs font-medium text-slate-500">
                  Halaman <span className="font-bold text-slate-900">{currentPage}</span> dari{" "}
                  <span className="font-bold text-slate-900">{totalPages}</span>
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 gap-1 px-3 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8 gap-1 px-3 text-xs"
                  >
                    Selanjutnya <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {itemsToPrint.length > 0 &&
        createPortal(
          <div id="sticker-print-root">
            <div className="sticker-grid">
              {itemsToPrint.map((item) => (
                <StickerPrintCard key={item.id} item={item} />
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}