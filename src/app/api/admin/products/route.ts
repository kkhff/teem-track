import { NextRequest, NextResponse } from "next/server";

import { errorMessage, requireAdmin } from "@/lib/require-admin";

const PRODUCT_SELECT = "id, name, sku, image_url, created_at";

/** GET /api/admin/products?q=... -> daftar produk */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    let query = guard.admin
      .from("products")
      .select(PRODUCT_SELECT)
      .order("name", { ascending: true });

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ products: data ?? [] });
  } catch (err) {
    console.error("GET admin products error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal memuat produk.") },
      { status: 500 }
    );
  }
}

/** POST /api/admin/products -> tambah produk */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      sku?: unknown;
      image_url?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const rawImage = typeof body.image_url === "string" ? body.image_url.trim() : "";
    const image_url = rawImage || null;

    if (!name) {
      return NextResponse.json(
        { error: "Nama produk wajib diisi." },
        { status: 400 }
      );
    }

    if (!sku) {
      return NextResponse.json(
        { error: "SKU wajib diisi." },
        { status: 400 }
      );
    }

    const { data, error } = await guard.admin
      .from("products")
      .insert({ name, sku, image_url })
      .select(PRODUCT_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (err) {
    console.error("POST admin products error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal menyimpan produk.") },
      { status: 500 }
    );
  }
}
