"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { QrCode, Printer, Layers, Loader2, PackageCheck, Barcode, Search, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BarcodeLabel } from "@/components/barcode-label";

interface GeneratedItem {
  serial_number: string;
  level: string; // Dinamis sesuai nama level produk
  code_type: "qr" | "barcode";
  product_name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
}

interface UnitLevelItem {
  level_name: string;
  hierarchy_order: number;
  capacity_to_child: number | null;
  serial_template: string | null;
}

interface ProductUnits {
  productId: string;
  levels: UnitLevelItem[];
}

const EMPTY_LEVELS: UnitLevelItem[] = [];

function StickerItem({ item }: { item: GeneratedItem }) {
  return (
    <div className="sticker-item flex flex-col items-center justify-center border border-slate-300 bg-white p-3 text-center">
      <div className="mb-1 max-w-full truncate text-[8px] font-bold tracking-wider text-slate-500 uppercase">
        {item.level} &middot; {item.product_name}
      </div>

      <div className="my-1 flex items-center justify-center bg-white p-1">
        {item.code_type === "qr" ? (
          <QRCodeSVG
            value={item.serial_number}
            size={96}
            level="M"
            marginSize={2}
          />
        ) : (
          <BarcodeLabel value={item.serial_number} height={44} />
        )}
      </div>

      <div className="mt-1 font-mono text-[11px] font-bold tracking-tight text-slate-900">
        {item.serial_number}
      </div>
    </div>
  );
}

export default function PackageGeneratorPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");
  // null = pakai jumlah default yang dihitung dari kapasitas level atasnya.
  const [customQuantity, setCustomQuantity] = useState<number | null>(null);
  const [productId, setProductId] = useState("");
  
  // State untuk Searchable Product Dropdown
  const [productSearch, setProductSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  
  // State untuk menyimpan tingkat satuan dinamis berdasarkan produk yang dipilih
  const [productUnitsState, setProductUnitsState] = useState<ProductUnits>({
    productId: "",
    levels: [],
  });
  const [loadingUnits, setLoadingUnits] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generatedList, setGeneratedList] = useState<GeneratedItem[]>([]);

  const supabase = useMemo(() => createClient(), []);

  // Tutup dropdown saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (generatedList.length === 0) return;
    document.body.classList.add("has-sticker-print");
    return () => document.body.classList.remove("has-sticker-print");
  }, [generatedList.length]);

  // 1. Muat Daftar Produk
  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, image_url")
        .order("name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Gagal memuat produk:", error);
        toast.error("Gagal memuat daftar produk.");
      } else {
        setProducts(data ?? []);
      }
      setLoadingProducts(false);
    };

    void loadProducts();

    return () => {
      active = false;
    };
  }, [supabase]);

  // 2. Muat Tingkat Satuan secara Dinamis saat Produk Dipilih.
  useEffect(() => {
    if (!productId) return;

    let active = true;

    const fetchProductUnits = async () => {
      setLoadingUnits(true);

      const { data, error } = await supabase
        .from("product_unit_levels")
        .select("level_name, hierarchy_order, capacity_to_child, serial_template")
        .eq("product_id", productId)
        .order("hierarchy_order", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Gagal memuat level satuan:", error);
        toast.error("Gagal memuat level satuan produk.");
        setProductUnitsState({ productId, levels: [] });
        setSelectedLevel("");
      } else {
        const levels = data ?? [];
        setProductUnitsState({ productId, levels });
        setSelectedLevel(levels[0]?.level_name ?? "");
      }
      setLoadingUnits(false);
    };

    void fetchProductUnits();

    return () => {
      active = false;
    };
  }, [productId, supabase]);

  // Filter produk berdasarkan ketikan pencarian
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const selectedProductObj = useMemo(() => {
    return products.find((p) => p.id === productId);
  }, [products, productId]);

  const productUnits =
    productUnitsState.productId === productId
      ? productUnitsState.levels
      : EMPTY_LEVELS;
  const unitLevelsLoading =
    loadingUnits ||
    (productId !== "" && productUnitsState.productId !== productId);
  const unitLevelsReady =
    productId !== "" && productUnitsState.productId === productId;

  // Default jumlah cetak:
  // - level teratas (tidak punya level atas) => 1
  // - level di bawahnya => kapasitas isi (capacity_to_child) level tepat di atasnya
  // Contoh: KARTON isi 4 => default BAL 4; BAL isi 20 => default SLOP 20.
  const suggestedQuantity = useMemo(() => {
    if (!unitLevelsReady || !selectedLevel || productUnits.length === 0) return 1;

    const index = productUnits.findIndex(
      (unit) => unit.level_name === selectedLevel
    );
    if (index <= 0) return 1;

    const parentCapacity = Number(productUnits[index - 1]?.capacity_to_child);
    if (!Number.isFinite(parentCapacity) || parentCapacity <= 0) return 1;

    // Validasi generate membatasi jumlah 1..100.
    return Math.min(100, Math.max(1, Math.trunc(parentCapacity)));
  }, [productUnits, selectedLevel, unitLevelsReady]);

  const quantity = customQuantity ?? suggestedQuantity;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedProduct = products.find((item) => item.id === productId);
    if (!selectedProduct) {
      toast.error("Pilih produk terlebih dahulu.");
      return;
    }

    if (!selectedLevel) {
      toast.error("Pilih level kemasan terlebih dahulu.");
      return;
    }

    if (!unitLevelsReady) {
      toast.error("Level satuan produk belum siap. Coba pilih ulang produk.");
      return;
    }

    if (!productUnits.some((unit) => unit.level_name === selectedLevel)) {
      toast.error("Level yang dipilih tidak tersedia untuk produk ini.");
      return;
    }

    if (quantity <= 0 || quantity > 100) {
      toast.error("Jumlah kuantitas harus di antara 1 sampai 100 unit.");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi pengguna tidak valid. Silakan login ulang.");

      const currentUnitMeta = productUnits.find((u) => u.level_name === selectedLevel);
      const template = currentUnitMeta?.serial_template;

      const newItems: GeneratedItem[] = [];
      const dbInserts = [];

      for (let i = 1; i <= quantity; i++) {
        const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
        const timestamp = Date.now().toString().slice(-4);
        
        let serialNumber = "";
        if (template) {
          serialNumber = template
            .replace(/XXXX/g, randomNum)
            .replace(/YY/g, selectedLevel.slice(0, 2).toUpperCase())
            .replace(/TIMESTAMP/g, timestamp);
        } else {
          const prefix = selectedLevel.slice(0, 3).toUpperCase();
          serialNumber = `${prefix}-${Date.now().toString().slice(-6)}-${randomNum}`;
        }

        newItems.push({
          serial_number: serialNumber,
          level: selectedLevel.toLowerCase(),
          code_type: codeType,
          product_name: selectedProduct.name,
        });

        dbInserts.push({
          serial_number: serialNumber,
          level: selectedLevel.toLowerCase(),
          code_type: codeType,
          product_id: selectedProduct.id,
          parent_id: null,
          status: "created",
          created_by: user.id,
        });
      }

      const { error: insertErr } = await supabase.from("packages").insert(dbInserts);
      if (insertErr) throw insertErr;

      setGeneratedList(newItems);
      toast.success(`Berhasil Generate ${quantity} Unit ${selectedLevel.toUpperCase()} (${codeType.toUpperCase()})!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan paket.";
      console.error("Gagal generate:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintStickers = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="no-print">
          <PageHeader
            eyebrow="Modul Operasional"
            title="Generator Kode Satuan"
            description="Buat kode satuan mandiri berdasarkan tingkat kemasan spesifik produk."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
          {/* Panel Konfigurasi */}
          <Card className="no-print">
            <CardHeader className="flex flex-row items-center gap-2">
              <QrCode className="h-3.5 w-3.5 text-slate-500" />
              <CardTitle>Konfigurasi Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleGenerate} className="space-y-4">
                
                {/* Searchable Product Combobox */}
                <div className="space-y-1.5 relative" ref={dropdownRef}>
                  <Label htmlFor="product-search-input">Cari &amp; Pilih Produk</Label>
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <Input
                      id="product-search-input"
                      type="text"
                      placeholder={loadingProducts ? "Memuat produk..." : "Ketik nama produk atau SKU..."}
                      value={isDropdownOpen ? productSearch : (selectedProductObj ? `${selectedProductObj.name} — ${selectedProductObj.sku}` : productSearch)}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        if (!isDropdownOpen) setIsDropdownOpen(true);
                        if (productId) {
                          setProductId("");
                          setCustomQuantity(null);
                        }
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      disabled={loadingProducts}
                      className="h-10 pl-9 pr-8 text-sm font-semibold"
                    />
                    {productId && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductId("");
                          setProductSearch("");
                          setCustomQuantity(null);
                        }}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        title="Reset pilihan"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Hasil Pencarian */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto border border-slate-300 bg-white shadow-lg">
                      {loadingProducts ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Memuat produk...
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">
                          Produk tidak ditemukan.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProductId(p.id);
                                setProductSearch("");
                                setIsDropdownOpen(false);
                                setCustomQuantity(null);
                              }}
                              className={`w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 flex flex-col ${
                                productId === p.id ? "bg-slate-100 font-bold" : ""
                              }`}
                            >
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <span className="font-mono text-[10px] text-slate-500 uppercase">{p.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Level Kemasan Dinamis Berdasarkan Produk */}
                <div className="space-y-1.5">
                  <Label>Level Kemasan (Sesuai Produk)</Label>
                  {unitLevelsLoading ? (
                    <div className="flex h-10 items-center justify-center gap-2 border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat level satuan...
                    </div>
                  ) : !productId ? (
                    <div className="flex h-10 items-center justify-center border border-slate-300 bg-slate-50 px-3 text-xs text-slate-400">
                      Pilih produk terlebih dahulu
                    </div>
                  ) : productUnits.length === 0 ? (
                    <div className="flex h-10 items-center justify-center border border-slate-300 bg-slate-50 px-3 text-center text-xs text-amber-600">
                      Produk ini belum punya level satuan. Atur di Admin → Products.
                    </div>
                  ) : (
                    <div className="grid grid-flow-col auto-cols-fr gap-1.5">
                      {productUnits.map((lvl) => (
                        <button
                          key={lvl.level_name}
                          type="button"
                          onClick={() => {
                            setSelectedLevel(lvl.level_name);
                            setCustomQuantity(null);
                          }}
                          className={`h-10 border text-[11px] font-bold tracking-wide uppercase transition-colors px-1 truncate ${
                            selectedLevel === lvl.level_name
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {lvl.level_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pilih Tipe Kode */}
                <div className="space-y-1.5">
                  <Label>Tipe Kode</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCodeType("qr")}
                      className={`flex h-10 items-center justify-center gap-2 border text-[11px] font-bold tracking-wide uppercase transition-colors ${
                        codeType === "qr"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <QrCode className="h-4 w-4" /> QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeType("barcode")}
                      className={`flex h-10 items-center justify-center gap-2 border text-[11px] font-bold tracking-wide uppercase transition-colors ${
                        codeType === "barcode"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Barcode className="h-4 w-4" /> Barcode
                    </button>
                  </div>
                </div>

                {/* Input Kuantitas (Qty) */}
                <div className="space-y-1.5">
                  <Label htmlFor="generator-quantity">Jumlah Cetak (Qty)</Label>
                  <Input
                    id="generator-quantity"
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) =>
                      setCustomQuantity(
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className="h-10 font-mono text-sm"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Default mengikuti kapasitas level di atasnya (
                    {suggestedQuantity}). Kosongkan untuk memakai default.
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <Button
                    type="submit"
                    disabled={loading || unitLevelsLoading || !unitLevelsReady || !selectedLevel || products.length === 0}
                    className="w-full gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Membuat Kode...
                      </>
                    ) : (
                      <>
                        <Layers className="h-4 w-4" />
                        Generate {quantity} {selectedLevel.toUpperCase()}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Area Preview & Cetak Stiker */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>
                  Pratinjau Stiker Label ({generatedList.length} Item)
                </CardTitle>
                <CardDescription className="mt-1">
                  Format stiker: Gambar kode di atas, nomor seri di bawah.
                </CardDescription>
              </div>
              {generatedList.length > 0 && (
                <Button
                  onClick={handlePrintStickers}
                  variant="outline"
                  size="sm"
                  className="gap-2 no-print"
                >
                  <Printer className="h-4 w-4" />
                  Cetak Stiker ({generatedList.length})
                </Button>
              )}
            </CardHeader>

            <div className="flex-1 p-4">
              {generatedList.length === 0 ? (
                <div className="flex h-full min-h-[350px] flex-col items-center justify-center border border-slate-300 bg-slate-50 p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-300 bg-white text-slate-400">
                    <PackageCheck className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Belum ada stiker yang digenerate
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Cari produk dan pilih level kemasan di sebelah kiri untuk mulai membuat kode stiker.
                  </p>
                </div>
              ) : (
                <div className="grid max-h-[580px] grid-cols-2 gap-3 overflow-y-auto border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 md:grid-cols-5">
                  {generatedList.map((item) => (
                    <StickerItem key={item.serial_number} item={item} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Salinan khusus cetak */}
      {generatedList.length > 0 &&
        createPortal(
          <div id="sticker-print-root">
            <div className="sticker-grid">
              {generatedList.map((item) => (
                <StickerItem key={item.serial_number} item={item} />
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}