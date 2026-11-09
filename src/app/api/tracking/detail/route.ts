import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
  }

  try {
    const { data: packageData, error: packageErr } = await supabase
      .from("packages")
      .select("*")
      .eq("id", id)
      .single();

    if (packageErr || !packageData) {
      return NextResponse.json(
        { error: "Paket tidak ditemukan." },
        { status: 404 }
      );
    }

    const { data: logs, error: logsErr } = await supabase
      .from("package_tracking_logs")
      .select("id, action, notes, created_at, profiles(full_name), locations(name)")
      .eq("package_id", id)
      .order("created_at", { ascending: false });

    if (logsErr) throw logsErr;

    // Ambil Bal yang menjadi anak langsung paket ini
    const { data: balList, error: balErr } = await supabase
      .from("packages")
      .select("*")
      .eq("parent_id", id);

    if (balErr) throw balErr;

    // Ambil Slop yang menjadi anak dari Bal-Bal tersebut
    const balIds = (balList || []).map((b) => b.id);
    let slopList: Record<string, unknown>[] = [];

    if (balIds.length > 0) {
      const { data: slops, error: slopErr } = await supabase
        .from("packages")
        .select("*")
        .in("parent_id", balIds);

      if (slopErr) throw slopErr;
      slopList = slops || [];
    }

    return NextResponse.json({
      package: packageData,
      logs: logs || [],
      children: [...(balList || []), ...slopList],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.";
    console.error("API tracking detail error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
