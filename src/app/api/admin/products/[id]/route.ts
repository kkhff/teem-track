import { NextRequest, NextResponse } from "next/server";

import { errorMessage, requireAdmin } from "@/lib/require-admin";

const PRODUCT_SELECT = "id, name, sku, image_url, created_at";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/admin/products/[id] -> ubah nama, sku, atau gambar */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      sku?: unknown;
      image_url?: unknown;
    };

    const updates: Record<string, string | null> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "Nama produk tidak boleh kosong." },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (body.sku !== undefined) {
      const sku = typeof body.sku === "string" ? body.sku.trim() : "";
      if (!sku) {
        return NextResponse.json(
          { error: "SKU tidak boleh kosong." },
          { status: 400 }
        );
      }
      updates.sku = sku;
    }

    if (body.image_url !== undefined) {
      const imageUrl =
        typeof body.image_url === "string" ? body.image_url.trim() : "";
      updates.image_url = imageUrl || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 }
      );
    }

    const { data, error } = await guard.admin
      .from("products")
      .update(updates)
      .eq("id", id)
      .select(PRODUCT_SELECT)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ product: data });
  } catch (err) {
    console.error("PATCH admin product error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal mengubah produk.") },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/products/[id] -> hapus produk */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const { data, error } = await guard.admin
      .from("products")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23503 = foreign key violation: produk masih dipakai paket.
      if ((error as { code?: string }).code === "23503") {
        return NextResponse.json(
          {
            error:
              "Produk tidak bisa dihapus karena masih dipakai oleh paket.",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("DELETE admin product error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal menghapus produk.") },
      { status: 500 }
    );
  }
}
