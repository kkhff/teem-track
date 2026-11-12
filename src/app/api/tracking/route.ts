import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_LEVELS = new Set(["karton", "bal", "slop"]);

const MAX_CHILDREN: Record<string, number> = {
  karton: 4,
  bal: 20,
  slop: 0,
};

interface PackageRow {
  id: string;
  level: string;
  [key: string]: unknown;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Tambahkan jumlah anak saat ini + kapasitas maksimum per level. */
async function withCapacity(
  supabase: SupabaseServerClient,
  rows: PackageRow[]
) {
  if (rows.length === 0) return [];

  const parentIds = rows.map((row) => row.id);
  const { data: children, error } = await supabase
    .from("packages")
    .select("parent_id")
    .in("parent_id", parentIds);

  if (error) throw error;

  const childCounts = new Map<string, number>();
  for (const child of children || []) {
    const parentId = child.parent_id as string | null;
    if (!parentId) continue;
    childCounts.set(parentId, (childCounts.get(parentId) || 0) + 1);
  }

  // Serial induk, supaya item yang sudah masuk kontainer tetap bisa dikenali.
  const rowParentIds = Array.from(
    new Set(
      rows
        .map((row) => row.parent_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );

  const parentSerials = new Map<string, string>();
  if (rowParentIds.length > 0) {
    const { data: parents, error: parentError } = await supabase
      .from("packages")
      .select("id, serial_number")
      .in("id", rowParentIds);

    if (parentError) throw parentError;

    for (const parent of parents || []) {
      parentSerials.set(parent.id as string, parent.serial_number as string);
    }
  }

  return rows.map((row) => ({
    ...row,
    parent_serial: row.parent_id
      ? parentSerials.get(row.parent_id as string) ?? null
      : null,
    current_children_count: childCounts.get(row.id) || 0,
    max_capacity: MAX_CHILDREN[row.level] ?? 0,
  }));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const parent = request.nextUrl.searchParams.get("parent");
  const levelParam = (
    request.nextUrl.searchParams.get("level") ?? ""
  ).toLowerCase();
  const level = VALID_LEVELS.has(levelParam) ? levelParam : "";

  try {
    // Mode 1: ambil anak-anak (Bal & Slop) dari sebuah Karton
    if (parent) {
      if (level === "karton") {
        return NextResponse.json([]);
      }

      const { data: balList, error: balErr } = await supabase
        .from("packages")
        .select("*")
        .eq("parent_id", parent)
        .order("created_at", { ascending: false });

      if (balErr) throw balErr;

      if (level === "bal") {
        return NextResponse.json(await withCapacity(supabase, balList || []));
      }

      const balIds = (balList || []).map((b) => b.id);
      if (balIds.length === 0) {
        return NextResponse.json([]);
      }

      const { data: slops, error: slopErr } = await supabase
        .from("packages")
        .select("*")
        .in("parent_id", balIds)
        .order("created_at", { ascending: false });

      if (slopErr) throw slopErr;

      if (level === "slop") {
        return NextResponse.json(await withCapacity(supabase, slops || []));
      }

      return NextResponse.json(
        await withCapacity(supabase, [...(balList || []), ...(slops || [])])
      );
    }

    // Mode 2: tanpa query -> semua paket (termasuk yang sudah masuk induk)
    // "Semua" = seluruh kode, filter level tertentu = paket pada level tersebut.
    if (!q) {
      let listQuery = supabase
        .from("packages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      listQuery = level ? listQuery.eq("level", level) : listQuery;

      const { data, error } = await listQuery;

      if (error) throw error;
      return NextResponse.json(await withCapacity(supabase, data || []));
    }

    // Mode 3: cari berdasarkan nomor seri (langsung tampilkan item yang cocok,
    // termasuk yang sudah masuk ke Bal / Karton).
    let matchQuery = supabase
      .from("packages")
      .select("*")
      .ilike("serial_number", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (level) matchQuery = matchQuery.eq("level", level);

    const { data: matched, error: matchErr } = await matchQuery;

    if (matchErr) throw matchErr;

    return NextResponse.json(await withCapacity(supabase, matched || []));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.";
    console.error("API tracking error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
