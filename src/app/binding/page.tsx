"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  QrCode, 
  Layers, 
  Box,
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  X,
  Calendar,
  MapPin
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface LocationItem {
  id: string;
  name: string;
  type: string;
}

interface PackageData {
  id: string;
  serial_number: string;
  level: string; // Dinamis sesuai level produk
  code_type: string;
  status: string;
  parent_id: string | null;
  current_location_id: string | null;
  product_id: string | null;
  product: { name: string; image_url: string | null } | null;
}

type ProductRef = { name: string } | { name: string }[] | null;

interface ChildData {
  id: string;
  serial_number: string;
  level: string;
  status: string;
  // Supabase dapat mengembalikan relasi sebagai objek atau array.
  product: ProductRef;
  // true = baru hasil scan dan belum ditulis ke database.
  isTemporary: boolean;
}

interface SerialSuggestion {
  id: string;
  serial_number: string;
  level: string;
  product_id: string | null;
  // Supabase dapat mengembalikan relasi sebagai objek atau array.
  product: ProductRef;
}

const getProductName = (product: ProductRef) => {
  if (!product) return null;
  if (Array.isArray(product)) return product[0]?.name ?? null;
  return product.name;
};

const getSuggestionProductName = (item: SerialSuggestion) =>
  getProductName(item.product);

interface ScanFeedback {
  status: "processing" | "success" | "error";
  message: string;
}

const subscribeToNothing = () => () => {};

let cachedToday: Date | null = null;
const getClientToday = () => {
  if (!cachedToday) cachedToday = new Date();
  return cachedToday;
};
const getServerToday = () => null;

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateID = (value: string) => {
  if (!value) return "Memuat tanggal...";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
};

export default function ScanOperationPage() {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");

  // --- STATE FORM & BINDING ---
  const [parentInput, setParentInput] = useState("");
  const [parentPackage, setParentPackage] = useState<PackageData | null>(null);
  
  // State untuk menyimpan kapasitas dinamis berdasarkan produk & level kemasan
  const [dynamicCapacity, setDynamicCapacity] = useState<number>(0);
  // Level yang boleh menjadi isi: tepat satu tingkat di bawah level paket induk.
  const [childLevel, setChildLevel] = useState<string | null>(null);

  const [childInput, setChildInput] = useState("");
  const [childrenList, setChildrenList] = useState<ChildData[]>([]);

  // --- STATE AUTOCOMPLETE NOMOR PAKET / ISI ---
  const [parentSuggestions, setParentSuggestions] = useState<SerialSuggestion[]>([]);
  const [childSuggestions, setChildSuggestions] = useState<SerialSuggestion[]>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [childSearching, setChildSearching] = useState(false);
  const [showParentSuggestions, setShowParentSuggestions] = useState(false);
  const [showChildSuggestions, setShowChildSuggestions] = useState(false);
  const parentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentSearchSeq = useRef(0);
  const childSearchSeq = useRef(0);
  const parentInputRef = useRef<HTMLInputElement | null>(null);
  const childInputRef = useRef<HTMLInputElement | null>(null);

  // --- STATE KAMERA ASLI ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanTargetField, setScanTargetField] = useState<"parent" | "child" | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const scanFeedbackRef = useRef<ScanFeedback | null>(null);
  const scanTargetRef = useRef<"parent" | "child" | null>(null);
  const isProcessingRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraPanelRef = useRef<HTMLElement | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Klik pada kolom tanggal langsung membuka panel tanggal, bukan hanya fokus teks.
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // Browser bisa menolak showPicker pada kondisi tertentu.
      }
    } else {
      input.focus();
    }
  };

  const todayDate = useSyncExternalStore(
    subscribeToNothing,
    getClientToday,
    getServerToday
  );

  // Tanggal operasi bisa dikustom; default-nya tanggal hari ini.
  const [customDate, setCustomDate] = useState<string | null>(null);
  const operationDate = customDate ?? (todayDate ? toISODate(todayDate) : "");
  const currentDateFormatted = formatDateID(operationDate);

  // Ambil daftar lokasi gudang/pabrik saat pertama load
  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, type")
        .eq("is_active", true);

      if (error) {
        toast.error("Gagal memuat data lokasi gudang");
      } else {
        setLocations(data || []);
        if (data && data.length > 0) {
          setSelectedLocation(data[0].id);
        }
      }
    };
    fetchLocations();
  }, [supabase]);

  // Kapasitas Dinamis berdasarkan konfigurasi product_unit_levels (atau default_unit_levels)
  const maxCapacity = dynamicCapacity;
  const currentCount = childrenList.length;
  const pendingCount = childrenList.filter((child) => child.isTemporary).length;
  const isFull = parentPackage ? (maxCapacity > 0 && currentCount >= maxCapacity) : false;

  // UX: fokus otomatis mengikuti langkah yang sedang aktif.
  useEffect(() => {
    if (!parentPackage && !isCameraOpen) {
      parentInputRef.current?.focus();
    }
  }, [parentPackage, isCameraOpen]);

  useEffect(() => {
    if (parentPackage && childLevel && !isFull && !loading && !isCameraOpen) {
      childInputRef.current?.focus();
    }
  }, [parentPackage, childLevel, isFull, loading, isCameraOpen]);

  // ==========================================
  // AUTOCOMPLETE NOMOR SERI
  // ==========================================

  const runParentSearch = useCallback(
    (term: string) => {
      if (parentSearchTimer.current) clearTimeout(parentSearchTimer.current);

      const keyword = term.trim();
      if (keyword.length < 2) {
        parentSearchSeq.current += 1;
        setParentSuggestions([]);
        setParentSearching(false);
        return;
      }

      const seq = ++parentSearchSeq.current;
      setParentSearching(true);

      parentSearchTimer.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("packages")
          .select("id, serial_number, level, product_id, product:products(name)")
          .ilike("serial_number", `%${keyword}%`)
          .order("serial_number", { ascending: true })
          .limit(8);

        if (seq !== parentSearchSeq.current) return;

        if (error) {
          setParentSuggestions([]);
        } else {
          setParentSuggestions((data as SerialSuggestion[] | null) ?? []);
        }
        setParentSearching(false);
      }, 250);
    },
    [supabase]
  );

  const runChildSearch = useCallback(
    (term: string) => {
      if (childSearchTimer.current) clearTimeout(childSearchTimer.current);

      const keyword = term.trim();
      const productId = parentPackage?.product_id;
      const parentId = parentPackage?.id;

      // Isi hanya boleh dari produk yang sama dan tepat satu level di bawah induk.
      if (!productId || !parentId || !childLevel || keyword.length < 2) {
        childSearchSeq.current += 1;
        setChildSuggestions([]);
        setChildSearching(false);
        return;
      }

      const seq = ++childSearchSeq.current;
      setChildSearching(true);

      childSearchTimer.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("packages")
          .select("id, serial_number, level, product_id, product:products(name)")
          .ilike("serial_number", `%${keyword}%`)
          .eq("product_id", productId)
          .eq("level", childLevel.toLowerCase())
          .neq("id", parentId)
          .is("parent_id", null)
          .order("serial_number", { ascending: true })
          .limit(8);

        if (seq !== childSearchSeq.current) return;

        if (error) {
          setChildSuggestions([]);
        } else {
          setChildSuggestions((data as unknown as SerialSuggestion[] | null) ?? []);
        }
        setChildSearching(false);
      }, 250);
    },
    [supabase, parentPackage?.product_id, parentPackage?.id, childLevel]
  );

  useEffect(() => {
    return () => {
      if (parentSearchTimer.current) clearTimeout(parentSearchTimer.current);
      if (childSearchTimer.current) clearTimeout(childSearchTimer.current);
    };
  }, []);

  // ==========================================
  // LOGIKA FETCH & BINDING
  // ==========================================

  const handleFetchAndSetParent = useCallback(async (serial: string): Promise<ScanFeedback> => {
    if (!serial.trim()) {
      return { status: "error", message: "Kode seri paket masih kosong." };
    }

    try {
      setLoading(true);
      const { data: pkg, error } = await supabase
        .from("packages")
        .select("*, product:products(name, image_url)")
        .eq("serial_number", serial.trim())
        .single();

      if (error || !pkg) throw new Error("Kode seri paket tidak ditemukan di database.");

      setParentPackage(pkg);

      // Ambil susunan level produk untuk menentukan:
      // - kapasitas isi level induk
      // - level isi yang diizinkan (tepat satu tingkat di bawahnya)
      type UnitLevelRow = {
        level_name: string;
        hierarchy_order: number;
        capacity_to_child: number | null;
      };

      let levels: UnitLevelRow[] = [];
      if (pkg.product_id) {
        const { data: productLevels } = await supabase
          .from("product_unit_levels")
          .select("level_name, hierarchy_order, capacity_to_child")
          .eq("product_id", pkg.product_id)
          .order("hierarchy_order", { ascending: true });

        levels = productLevels ?? [];
      }

      if (levels.length === 0) {
        const { data: defaultLevels } = await supabase
          .from("default_unit_levels")
          .select("level_name, hierarchy_order, capacity_to_child")
          .order("hierarchy_order", { ascending: true });

        levels = defaultLevels ?? [];
      }

      const parentLevelName = (pkg.level || "").trim().toUpperCase();
      const parentIndex = levels.findIndex(
        (level) =>
          (level.level_name || "").trim().toUpperCase() === parentLevelName
      );
      const parentUnit = parentIndex >= 0 ? levels[parentIndex] : null;
      const nextUnit = parentIndex >= 0 ? levels[parentIndex + 1] ?? null : null;

      // Kapasitas muat (capacity_to_child) milik level induk.
      let capacityVal = parentUnit?.capacity_to_child ?? 0;

      // Jika produk belum mengatur kapasitas level ini, pakai default global.
      if (capacityVal === 0) {
        const { data: defaultUnitData } = await supabase
          .from("default_unit_levels")
          .select("capacity_to_child")
          .ilike("level_name", pkg.level)
          .maybeSingle();

        if (defaultUnitData && defaultUnitData.capacity_to_child !== null) {
          capacityVal = defaultUnitData.capacity_to_child;
        }
      }

      setDynamicCapacity(capacityVal);
      setChildLevel(nextUnit ? nextUnit.level_name.trim().toUpperCase() : null);

      // Ambil daftar isi yang sudah terikat sebelumnya
      const { data: children, error: childErr } = await supabase
        .from("packages")
        .select("id, serial_number, level, status, product:products(name)")
        .eq("parent_id", pkg.id);

      if (childErr) throw childErr;
      setChildrenList(
        ((children as unknown as ChildData[] | null) ?? []).map((child) => ({
          ...child,
          product: child.product ?? null,
          isTemporary: false,
        }))
      );
      setParentInput("");
      setChildInput("");
      setChildSuggestions([]);
      setShowChildSuggestions(false);
      toast.success(`Paket ${pkg.serial_number} berhasil dimuat!`);

      return {
        status: "success",
        message: `Paket ${pkg.level.toUpperCase()} ${pkg.serial_number} berhasil dimuat.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat paket.";
      toast.error(msg);
      setParentPackage(null);
      setChildrenList([]);
      setDynamicCapacity(0);
      setChildLevel(null);
      return { status: "error", message: msg };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleAutoAddChild = useCallback(async (serial: string): Promise<ScanFeedback> => {
    if (!parentPackage) {
      const msg = "Scan atau pilih paket terlebih dahulu sebelum memasukkan isi!";
      toast.error(msg);
      return { status: "error", message: msg };
    }
    if (!serial.trim()) {
      return { status: "error", message: "Kode seri isi paket masih kosong." };
    }

    if (maxCapacity > 0 && isFull) {
      const msg = `Gagal! ${parentPackage.level.toUpperCase()} ini sudah PENUH (${maxCapacity}/${maxCapacity}).`;
      toast.error(msg);
      return { status: "error", message: msg };
    }

    try {
      setLoading(true);

      const { data: child, error: childErr } = await supabase
        .from("packages")
        .select("*, product:products(name, image_url)")
        .eq("serial_number", serial.trim())
        .single();

      if (childErr || !child) throw new Error(`Kode ${serial} tidak ditemukan di database.`);

      if (parentPackage.product_id && child.product_id && parentPackage.product_id !== child.product_id) {
        throw new Error("Produk isi tidak cocok dengan produk paket!");
      }

      if (!childLevel) {
        throw new Error(
          `Paket ${parentPackage.level.toUpperCase()} tidak punya level isi di bawahnya.`
        );
      }

      if ((child.level || "").trim().toUpperCase() !== childLevel.trim().toUpperCase()) {
        throw new Error(
          `Isi harus level ${childLevel.toUpperCase()}, bukan ${(child.level || "-").toUpperCase()}.`
        );
      }

      if (child.parent_id) {
        throw new Error(`Item ${child.serial_number} sudah terikat ke paket lain!`);
      }

      if (
        childrenList.some(
          (item) =>
            item.id === child.id ||
            item.serial_number.trim().toUpperCase() ===
              child.serial_number.trim().toUpperCase()
        )
      ) {
        throw new Error(`Item ${child.serial_number} sudah ada di daftar.`);
      }

      // Masukkan sebagai data sementara dulu; database baru diubah saat "Selesai".
      setChildrenList((prev) => [
        ...prev,
        {
          id: child.id,
          serial_number: child.serial_number,
          level: child.level,
          status: child.status,
          product: (child.product ?? null) as ProductRef,
          isTemporary: true,
        },
      ]);
      setChildInput("");
      toast.success(
        `${child.serial_number} masuk ke daftar. Tekan SELESAI untuk menyimpan.`
      );

      return {
        status: "success",
        message: `Berhasil! ${child.serial_number} masuk ke daftar (belum disimpan).`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambahkan isi paket.";
      toast.error(msg);
      return { status: "error", message: msg };
    } finally {
      setLoading(false);
    }
  }, [parentPackage, childLevel, childrenList, isFull, maxCapacity, supabase]);

  const handleFinishBinding = useCallback(async () => {
    if (!parentPackage) {
      toast.error("Muat paket terlebih dahulu.");
      return;
    }

    const pendingItems = childrenList.filter((child) => child.isTemporary);
    if (pendingItems.length === 0) {
      toast.error("Belum ada isi baru yang perlu disimpan.");
      return;
    }

    try {
      setLoading(true);

      const ids = pendingItems.map((child) => child.id);
      const { data: latest, error: checkErr } = await supabase
        .from("packages")
        .select("id, serial_number, product_id, level, parent_id")
        .in("id", ids);

      if (checkErr) throw checkErr;

      const latestById = new Map((latest ?? []).map((row) => [row.id, row]));
      const problems: string[] = [];

      for (const item of pendingItems) {
        const row = latestById.get(item.id);
        if (!row) {
          problems.push(`${item.serial_number}: tidak ditemukan`);
          continue;
        }
        if (row.parent_id) {
          problems.push(`${item.serial_number}: sudah terikat paket lain`);
          continue;
        }
        if (
          parentPackage.product_id &&
          row.product_id &&
          parentPackage.product_id !== row.product_id
        ) {
          problems.push(`${item.serial_number}: produk tidak cocok`);
          continue;
        }
        if (
          childLevel &&
          (row.level || "").trim().toUpperCase() !==
            childLevel.trim().toUpperCase()
        ) {
          problems.push(`${item.serial_number}: level bukan ${childLevel}`);
        }
      }

      if (problems.length > 0) {
        throw new Error(`Gagal menyimpan: ${problems.join(", ")}`);
      }

      if (maxCapacity > 0) {
        const { count: boundCount, error: countErr } = await supabase
          .from("packages")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", parentPackage.id);

        if (countErr) throw countErr;
        if ((boundCount ?? 0) + pendingItems.length > maxCapacity) {
          throw new Error(
            `Kapasitas paket tidak mencukupi (maksimal ${maxCapacity} isi).`
          );
        }
      }

      const { error: updateErr } = await supabase
        .from("packages")
        .update({
          parent_id: parentPackage.id,
          current_location_id:
            selectedLocation || parentPackage.current_location_id,
        })
        .in("id", ids);

      if (updateErr) throw updateErr;

      setChildrenList((prev) =>
        prev.map((child) =>
          child.isTemporary ? { ...child, isTemporary: false } : child
        )
      );
      toast.success(
        `${pendingItems.length} isi berhasil disimpan ke paket ${parentPackage.serial_number}.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan isi paket.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    parentPackage,
    childrenList,
    childLevel,
    maxCapacity,
    selectedLocation,
    supabase,
  ]);

  const handleRemoveTemporaryChild = (id: string) => {
    setChildrenList((prev) =>
      prev.filter((child) => !(child.id === id && child.isTemporary))
    );
    childInputRef.current?.focus();
  };

  const handleSelectParentSuggestion = (item: SerialSuggestion) => {
    setShowParentSuggestions(false);
    setParentInput(item.serial_number);
    void handleFetchAndSetParent(item.serial_number);
  };

  const handleSelectChildSuggestion = (item: SerialSuggestion) => {
    setShowChildSuggestions(false);
    setChildInput(item.serial_number);
    void handleAutoAddChild(item.serial_number);
  };

  // --- INISIALISASI KAMERA ---
  const handlersRef = useRef({
    handleFetchAndSetParent,
    handleAutoAddChild,
  });

  useEffect(() => {
    handlersRef.current = {
      handleFetchAndSetParent,
      handleAutoAddChild,
    };
  }, [handleFetchAndSetParent, handleAutoAddChild]);

  useEffect(() => {
    if (!isCameraOpen) return;

    const scanner = new Html5Qrcode("real-reader-view");
    scannerRef.current = scanner;
    let cancelled = false;

    const processScan = async (decodedText: string) => {
      if (isProcessingRef.current) return;

      const currentFeedback = scanFeedbackRef.current;
      if (currentFeedback && currentFeedback.status !== "processing") return;

      isProcessingRef.current = true;

      const target = scanTargetRef.current;
      const cleaned = decodedText.trim();
      const processing: ScanFeedback = {
        status: "processing",
        message: `Memproses ${cleaned}...`,
      };
      scanFeedbackRef.current = processing;
      setScanFeedback(processing);

      const handlers = handlersRef.current;
      let feedback: ScanFeedback;

      try {
        if (target === "parent") {
          setParentInput(cleaned);
          feedback = await handlers.handleFetchAndSetParent(cleaned);
        } else if (target === "child") {
          setChildInput(cleaned);
          feedback = await handlers.handleAutoAddChild(cleaned);
        } else {
          feedback = { status: "error", message: "Target scan tidak dikenali." };
        }
      } catch (err) {
        feedback = {
          status: "error",
          message: err instanceof Error ? err.message : "Gagal memproses hasil scan.",
        };
      } finally {
        isProcessingRef.current = false;
      }

      if (cancelled) return;

      scanFeedbackRef.current = feedback;
      setScanFeedback(feedback);

      if (target === "parent" && feedback.status === "success") {
        window.setTimeout(() => {
          if (cancelled) return;
          setIsCameraOpen(false);
          setScanTargetField(null);
          scanTargetRef.current = null;
          scanFeedbackRef.current = null;
          setScanFeedback(null);
        }, 900);
      }
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void processScan(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        console.error("Gagal membuka kamera:", err);
        toast.error("Tidak dapat mengakses kamera perangkat.");
        setIsCameraOpen(false);
      });

    return () => {
      cancelled = true;
      const current = scannerRef.current;
      scannerRef.current = null;

      if (!current) return;

      try {
        if (current.isScanning) {
          current.stop().then(() => current.clear()).catch(() => {});
        } else {
          current.clear();
        }
      } catch {
        // abaikan
      }
    };
  }, [isCameraOpen]);

  useEffect(() => {
    if (!isCameraOpen) return;

    const node = cameraPanelRef.current;
    if (!node) return;

    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isCameraOpen]);

  const resetScanFeedback = () => {
    scanFeedbackRef.current = null;
    isProcessingRef.current = false;
    setScanFeedback(null);
  };

  const openCamera = (target: "parent" | "child") => {
    scanTargetRef.current = target;
    setScanTargetField(target);
    resetScanFeedback();
    setIsCameraOpen(true);
  };

  const closeCameraPanel = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setIsCameraOpen(false);
    setScanTargetField(null);
    scanTargetRef.current = null;
    resetScanFeedback();
  };

  const handleScanAgain = () => {
    resetScanFeedback();
  };

  const handleManualParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowParentSuggestions(false);
    handleFetchAndSetParent(parentInput);
  };

  const handleManualChildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowChildSuggestions(false);
    handleAutoAddChild(childInput);
  };

  const handleResetBinding = () => {
    if (
      pendingCount > 0 &&
      !window.confirm(
        `Ada ${pendingCount} isi yang belum disimpan. Yakin ganti paket dan buang data tersebut?`
      )
    ) {
      return;
    }
    closeCameraPanel();
    setParentPackage(null);
    setChildrenList([]);
    setDynamicCapacity(0);
    setChildLevel(null);
    setParentInput("");
    setChildInput("");
    setParentSuggestions([]);
    setChildSuggestions([]);
    setShowParentSuggestions(false);
    setShowChildSuggestions(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 pb-16 font-sans text-slate-900">
      <main className="w-full space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Informasi operasi */}
        <section className="w-full border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-50 px-4 py-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Informasi 
            </h2>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tanggal
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={operationDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  onClick={openDatePicker}
                  aria-label="Tanggal operasi"
                  title="Klik untuk ubah tanggal"
                  className="w-full min-w-0 cursor-pointer bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none focus:ring-0"
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-slate-400">
                {currentDateFormatted}
              </p>
            </div>
            <div className="px-4 py-3">
              <label
                htmlFor="binding-location"
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Lokasi
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <select
                  id="binding-location"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full border-0 bg-transparent p-0 font-mono text-xs font-semibold text-slate-900 focus:outline-none focus:ring-0"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Status
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
                <span
                  className={`inline-block h-1.5 w-1.5 ${
                    parentPackage ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {parentPackage
                  ? `Paket dimuat · ${currentCount}/${maxCapacity}`
                  : "Menunggu paket"}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-4">
            {/* Form binding */}
            <section className="border border-slate-300 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Form Binding
                </h2>
                {parentPackage && (
                  <button
                    type="button"
                    onClick={handleResetBinding}
                    className="flex items-center gap-1 border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3 w-3" /> Ganti Paket
                  </button>
                )}
              </div>

              <div className="space-y-5 p-4">
                {/* Nomor paket */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="binding-parent-input"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Kode Paket
                  </label>

                  {!parentPackage ? (
                    <form
                      onSubmit={handleManualParentSubmit}
                      className="flex gap-2"
                    >
                      <div className="relative min-w-0 flex-1">
                        <input
                          ref={parentInputRef}
                          id="binding-parent-input"
                          type="text"
                          enterKeyHint="go"
                          autoComplete="off"
                          placeholder="Scan / ketik kode paket..."
                          value={parentInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setParentInput(value);
                            setShowParentSuggestions(true);
                            runParentSearch(value);
                          }}
                          onFocus={() => setShowParentSuggestions(true)}
                          onBlur={() =>
                            window.setTimeout(
                              () => setShowParentSuggestions(false),
                              120
                            )
                          }
                          disabled={loading}
                          className="h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm font-semibold text-slate-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                        />

                        {showParentSuggestions &&
                          parentInput.trim().length >= 2 && (
                            <div
                              className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto border border-slate-300 bg-white shadow-lg"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {parentSearching ? (
                                <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Mencari kode...
                                </p>
                              ) : parentSuggestions.length === 0 ? (
                                <p className="px-3 py-2 text-[11px] text-slate-500">
                                  Tidak ada kode yang cocok.
                                </p>
                              ) : (
                                parentSuggestions.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      handleSelectParentSuggestion(item)
                                    }
                                    className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-slate-100"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-mono text-xs font-bold text-slate-900">
                                        {item.serial_number}
                                      </span>
                                      <span className="block truncate text-[10px] text-slate-500">
                                        {getSuggestionProductName(item) ?? "Tanpa produk"}
                                      </span>
                                    </span>
                                    <span className="shrink-0 border border-slate-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                                      {item.level}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCamera("parent")}
                        aria-label="Scan QR Paket"
                        title="Scan QR Paket"
                        className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !parentInput.trim()}
                        className="flex h-10 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Muat
                          </>
                        ) : (
                          "Muat"
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="border border-slate-300 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        {parentPackage.product?.image_url ? (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-slate-300 bg-white">
                            <Image
                              src={parentPackage.product.image_url}
                              alt={parentPackage.product.name}
                              fill
                              unoptimized
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-500">
                            {parentPackage.level.toLowerCase() === "karton" ? (
                              <Box className="h-5 w-5" />
                            ) : (
                              <Layers className="h-5 w-5" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                              {parentPackage.level}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {parentPackage.serial_number}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium text-slate-600">
                            {parentPackage.product?.name || "Tanpa produk"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            Isi
                          </p>
                          <p
                            className={`font-mono text-sm font-bold ${
                              isFull ? "text-red-600" : "text-slate-900"
                            }`}
                          >
                            {currentCount}/{maxCapacity}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nomor isi */}
                <div className="space-y-1.5 border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="binding-child-input"
                      className="block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Kode Isi
                    </label>
                    {!parentPackage && (
                      <span className="text-[10px] font-semibold text-amber-700">
                        Muat paket terlebih dahulu
                      </span>
                    )}
                  </div>
                  <form
                    onSubmit={handleManualChildSubmit}
                    className="flex gap-2"
                  >
                    <div className="relative min-w-0 flex-1">
                      <input
                        ref={childInputRef}
                        id="binding-child-input"
                        type="text"
                        enterKeyHint="go"
                        autoComplete="off"
                        placeholder={
                          !parentPackage
                            ? "Muat paket terlebih dahulu"
                            : !childLevel
                              ? `Level ${parentPackage.level.toUpperCase()} tidak punya isi`
                              : isFull
                                ? "Paket sudah penuh"
                                : `Scan / ketik kode ${childLevel}...`
                        }
                        value={childInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChildInput(value);
                          setShowChildSuggestions(true);
                          runChildSearch(value);
                        }}
                        onFocus={() => setShowChildSuggestions(true)}
                        onBlur={() =>
                          window.setTimeout(
                            () => setShowChildSuggestions(false),
                            120
                          )
                        }
                        disabled={loading || isFull || !parentPackage || !childLevel}
                        className="h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm font-semibold text-slate-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                      />

                      {showChildSuggestions &&
                        parentPackage &&
                        childLevel &&
                        !isFull &&
                        childInput.trim().length >= 2 && (
                          <div
                            className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto border border-slate-300 bg-white shadow-lg"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                              Produk: {getProductName(parentPackage.product) ?? "Tanpa produk"} · Isi: {childLevel}
                            </p>
                            {childSearching ? (
                              <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Mencari kode...
                              </p>
                            ) : childSuggestions.length === 0 ? (
                              <p className="px-3 py-2 text-[11px] text-slate-500">
                                Tidak ada kode produk ini yang cocok.
                              </p>
                            ) : (
                              childSuggestions.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    handleSelectChildSuggestion(item)
                                  }
                                  className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-slate-100"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-xs font-bold text-slate-900">
                                      {item.serial_number}
                                    </span>
                                    <span className="block truncate text-[10px] text-slate-500">
                                      {getSuggestionProductName(item) ?? "Tanpa produk"}
                                    </span>
                                  </span>
                                  <span className="shrink-0 border border-slate-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                                    {item.level}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openCamera("child")}
                      disabled={isFull || !parentPackage}
                      aria-label="Scan QR Isi"
                      title="Scan QR Isi"
                      className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        isFull ||
                        !parentPackage ||
                        !childInput.trim()
                      }
                      className="flex h-10 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Tambah
                        </>
                      ) : (
                        "Tambah"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </section>

            {/* Panel kamera inline */}
            {isCameraOpen && (
              <section
                ref={cameraPanelRef}
                className="scroll-mt-4 border border-slate-800 bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <QrCode className="h-4 w-4 text-slate-300" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white">
                        {scanTargetField === "parent"
                          ? "Scan Paket"
                          : "Scan Isi Paket"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {scanTargetField === "parent"
                          ? "Arahkan kamera ke kode paket."
                          : "Arahkan kamera ke kode isi."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCameraPanel}
                    aria-label="Tutup kamera"
                    className="flex h-8 w-8 items-center justify-center border border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3">
                  <div className="relative h-64 w-full overflow-hidden border border-slate-700 bg-black sm:h-72">
                    <div id="real-reader-view" className="h-full w-full" />
                  </div>

                  {scanFeedback ? (
                    <div
                      className={`mt-3 flex items-start gap-2 border px-3 py-2.5 text-xs font-medium ${
                        scanFeedback.status === "success"
                          ? "border-emerald-700 bg-emerald-950/60 text-emerald-200"
                          : scanFeedback.status === "error"
                            ? "border-red-800 bg-red-950/60 text-red-200"
                            : "border-amber-700 bg-amber-950/50 text-amber-200"
                      }`}
                    >
                      {scanFeedback.status === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : scanFeedback.status === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      )}
                      <p className="flex-1 leading-relaxed">
                        {scanFeedback.message}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-center text-[11px] text-slate-400">
                      Posisikan QR / barcode di dalam area pandang.
                    </p>
                  )}

                  {scanFeedback && scanFeedback.status !== "processing" && (
                    <button
                      type="button"
                      onClick={handleScanAgain}
                      className="mt-3 flex h-9 w-full items-center justify-center gap-2 border border-slate-600 bg-slate-800 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Scan Lagi
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Tabel isi paket */}
          <section className="border border-slate-300 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Daftar Isi Paket
              </h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  {parentPackage
                    ? `${currentCount} / ${maxCapacity} item`
                    : `${childrenList.length} item`}
                  {pendingCount > 0 && (
                    <span className="ml-1 text-amber-700">
                      · {pendingCount} belum disimpan
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleFinishBinding}
                  disabled={loading || pendingCount === 0 || !parentPackage}
                  className="flex items-center gap-1 border border-slate-900 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <CheckCircle2 className="h-3 w-3" /> Selesai
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-12 px-4 py-2.5">No</th>
                    <th className="px-4 py-2.5">Serial Number</th>
                    <th className="px-4 py-2.5">Produk</th>
                    <th className="w-24 px-4 py-2.5">Level</th>
                    <th className="w-28 px-4 py-2.5">Status</th>
                    <th className="w-28 px-4 py-2.5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {childrenList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-xs text-slate-500"
                      >
                        Belum ada isi paket. Data akan muncul setelah kode isi
                        ditambahkan.
                      </td>
                    </tr>
                  ) : (
                    childrenList.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                          {c.serial_number}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">
                          {getProductName(c.product) ??
                            getProductName(parentPackage?.product ?? null) ??
                            "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="border border-slate-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                            {c.level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {c.isTemporary ? (
                            <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                              Menunggu
                            </span>
                          ) : (
                            <span className="border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                              {c.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {c.isTemporary ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveTemporaryChild(c.id)}
                              title="Keluarkan dari daftar (belum disimpan)"
                              className="flex items-center gap-1 border border-slate-300 bg-white px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            >
                              <X className="h-3 w-3" /> Keluarkan
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}