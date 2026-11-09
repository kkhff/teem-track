import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const parent = request.nextUrl.searchParams.get("parent");

  try {
    // Mode 1: ambil anak-anak (Bal & Slop) dari sebuah Karton
    if (parent) {
      const { data: balList, error: balErr } = await supabase
        .from("packages")
        .select("*")
        .eq("parent_id", parent);

      if (balErr) throw balErr;

      const balIds = (balList || []).map((b) => b.id);
      if (balIds.length === 0) {
        return NextResponse.json([]);
      }

      const { data: slops, error: slopErr } = await supabase
        .from("packages")
        .select("*")
        .in("parent_id", balIds);

      if (slopErr) throw slopErr;

      return NextResponse.json([...(balList || []), ...(slops || [])]);
    }

    // Mode 2: tanpa query -> tampilkan 20 karton terbaru
    if (!q) {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("level", "karton")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Mode 3: cari berdasarkan nomor seri, lalu kembalikan karton akarnya
    const { data: matched, error: matchErr } = await supabase
      .from("packages")
      .select("*")
      .ilike("serial_number", `%${q}%`);

    if (matchErr) throw matchErr;
    if (!matched || matched.length === 0) {
      return NextResponse.json([]);
    }

    const kartonIds = new Set<string>();
    for (const item of matched) {
      if (item.level === "karton") {
        kartonIds.add(item.id);
      } else if (item.level === "bal" && item.parent_id) {
        kartonIds.add(item.parent_id);
      } else if (item.level === "slop" && item.parent_id) {
        const { data: balData } = await supabase
          .from("packages")
          .select("parent_id")
          .eq("id", item.parent_id)
          .single();
        if (balData?.parent_id) kartonIds.add(balData.parent_id);
      }
    }

    if (kartonIds.size === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .in("id", Array.from(kartonIds));

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.";
    console.error("API tracking error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
