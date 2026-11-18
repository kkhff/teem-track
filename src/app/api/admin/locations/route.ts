import { NextRequest, NextResponse } from "next/server";

import { errorMessage, requireAdmin } from "@/lib/require-admin";

const LOCATION_SELECT =
  "id, name, type, address, is_active, created_at, updated_at";

const VALID_TYPES = new Set(["factory", "warehouse"]);

/** GET /api/admin/locations -> daftar pabrik & gudang */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await guard.admin
      .from("locations")
      .select(LOCATION_SELECT)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ locations: data ?? [] });
  } catch (err) {
    console.error("GET admin locations error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal memuat lokasi.") },
      { status: 500 }
    );
  }
}

/** POST /api/admin/locations -> tambah lokasi */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      type?: unknown;
      address?: unknown;
      is_active?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address =
      typeof body.address === "string" ? body.address.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Nama lokasi wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof body.type !== "string" || !VALID_TYPES.has(body.type)) {
      return NextResponse.json(
        { error: "Tipe lokasi harus Pabrik atau Gudang." },
        { status: 400 }
      );
    }

    const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

    const { data, error } = await guard.admin
      .from("locations")
      .insert({
        name,
        type: body.type,
        address: address || null,
        is_active: isActive,
      })
      .select(LOCATION_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json({ location: data }, { status: 201 });
  } catch (err) {
    console.error("POST admin locations error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal menyimpan lokasi.") },
      { status: 500 }
    );
  }
}
