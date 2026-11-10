import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const ALLOWED_CODE_TYPES = new Set(["qr", "barcode"]);

type AdminClient = ReturnType<typeof createAdminClient>;

/** Naik ke atas sampai menemukan paket tanpa parent (Karton). */
async function findRootId(admin: AdminClient, id: string) {
  let currentId = id;

  for (let depth = 0; depth < 10; depth++) {
    const { data, error } = await admin
      .from("packages")
      .select("id, parent_id")
      .eq("id", currentId)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Paket tidak ditemukan.");
    }

    if (!data.parent_id) return data.id;
    currentId = data.parent_id;
  }

  return currentId;
}

/** Kumpulkan id root + seluruh turunannya (Bal, Slop, dst). */
async function collectTreeIds(admin: AdminClient, rootId: string) {
  const ids = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const { data, error } = await admin
      .from("packages")
      .select("id")
      .in("parent_id", frontier);

    if (error) throw new Error(error.message);

    const nextIds = (data || []).map((item) => item.id);
    if (nextIds.length === 0) break;

    ids.push(...nextIds);
    frontier = nextIds;
  }

  return ids;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sesi tidak valid. Silakan login ulang." },
      { status: 401 }
    );
  }

  let body: { id?: unknown; code_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const codeType =
    typeof body.code_type === "string" ? body.code_type.trim().toLowerCase() : "";

  if (!id || !ALLOWED_CODE_TYPES.has(codeType)) {
    return NextResponse.json(
      { error: "Parameter id dan code_type (qr|barcode) wajib diisi." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  try {
    // Cari Karton paling atas, lalu update seluruh set (root + semua turunannya)
    const rootId = await findRootId(admin, id);
    const treeIds = await collectTreeIds(admin, rootId);

    const { data, error } = await admin
      .from("packages")
      .update({ code_type: codeType })
      .in("id", treeIds)
      .select("id");

    if (error) {
      console.error("API ubah tipe kode error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      root_id: rootId,
      code_type: codeType,
      affected: data?.length ?? treeIds.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat mengubah tipe kode.";
    console.error("API ubah tipe kode error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
