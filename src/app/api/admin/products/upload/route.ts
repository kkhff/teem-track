import { NextRequest, NextResponse } from "next/server";

import { errorMessage, requireAdmin } from "@/lib/require-admin";

const BUCKET = "product-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** POST /api/admin/products/upload -> unggah gambar produk */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File gambar tidak ditemukan." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: "Format gambar harus JPG, PNG, WEBP, GIF, atau AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran gambar maksimal 5 MB." },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];
    const path = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${extension}`;

    const { error } = await guard.admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    const { data } = guard.admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl }, { status: 201 });
  } catch (err) {
    console.error("POST admin product upload error:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Gagal mengunggah gambar.") },
      { status: 500 }
    );
  }
}
