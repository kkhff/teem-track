import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

type AdminGuardResult =
  | { ok: true; admin: AdminClient; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Pastikan request berasal dari user yang login dan punya role `admin`.
 * Dipakai sebelum operasi apa pun yang memakai service role.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Gagal memeriksa role admin:", profileError);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Gagal memverifikasi akses." },
        { status: 500 }
      ),
    };
  }

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak. Halaman ini khusus admin." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, admin: createAdminClient(), userId: user.id };
}

/** Ambil pesan error yang aman untuk ditampilkan ke client. */
export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
