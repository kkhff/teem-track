import { NextRequest, NextResponse } from "next/server";

import { errorMessage, requireAdmin } from "@/lib/require-admin";

const LOCATION_SELECT =
  "id, name, type, address, is_active, created_at, updated_at";

const VALID_TYPES = new Set(["factory", "warehouse"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/admin/locations/[id] -> ubah lokasi */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      type?: unknown;
      address?: unknown;
      is_active?: unknown;
    };

    const updates: Record<string, string | boolean | null> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "Nama lokasi tidak boleh kosong." },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (body.type !== undefined) {
      if (typeof body.type !== "string" || !VALID_TYPES.has(body.type)) {
        return NextResponse.json(
          { error: "Tipe lokasi harus Pabrik atau Gudang." },
          { status: 400 }
        );
      }
      updates.type = body.type;
    }

    if (body.address !== undefined) {
      const address =
        typeof body.address === "string" ? body.address.trim() : "";
      updates.address = address || null;
    }

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 }
      );
    }

    const { data, error } = await guard.admin
      .from("locations")
      .update(updates)
      .eq("id", id)
      .select(LOCATION_SELECT)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Lokasi tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ location: data });
  } catch (err) {
    console.error("PATCH admin location error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal mengubah lokasi.") },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/locations/[id] -> hapus lokasi */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    // Beberapa foreign key memakai ON DELETE SET NULL, jadi cek manual dulu
    // supaya penghapusan tidak diam-diam melepas lokasi dari profil/paket.
    const [profileRefs, packageRefs, logRefs] = await Promise.all([
      guard.admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("location_id", id),
      guard.admin
        .from("packages")
        .select("id", { count: "exact", head: true })
        .or(`current_location_id.eq.${id},destination_location_id.eq.${id}`),
      guard.admin
        .from("package_tracking_logs")
        .select("id", { count: "exact", head: true })
        .eq("location_id", id),
    ]);

    for (const check of [profileRefs, packageRefs, logRefs]) {
      if (check.error) throw check.error;
    }

    const isUsed =
      (profileRefs.count ?? 0) > 0 ||
      (packageRefs.count ?? 0) > 0 ||
      (logRefs.count ?? 0) > 0;

    if (isUsed) {
      return NextResponse.json(
        {
          error:
            "Lokasi tidak bisa dihapus karena masih dipakai. Nonaktifkan saja.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await guard.admin
      .from("locations")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23503 = masih direferensikan profil/paket/log.
      if ((error as { code?: string }).code === "23503") {
        return NextResponse.json(
          {
            error:
              "Lokasi tidak bisa dihapus karena masih dipakai. Nonaktifkan saja.",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Lokasi tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("DELETE admin location error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal menghapus lokasi.") },
      { status: 500 }
    );
  }
}
