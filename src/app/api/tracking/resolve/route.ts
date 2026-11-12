import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json(
      { error: "Parameter code wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("packages")
      .select("id, serial_number, level, code_type, status")
      .ilike("serial_number", code)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: `Kode ${code} tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json(data[0]);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mencari kode paket.";
    console.error("API tracking resolve error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
