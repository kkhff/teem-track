"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Box, Mail, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email dan password wajib diisi!");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // Cek profil user buat tentuin role & status
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Profil pengguna tidak ditemukan.");
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        toast.error("Akun Anda telah dinonaktifkan oleh Admin.");
        return;
      }

      toast.success("Login berhasil!", { description: "Mengalihkan ke sistem..." });

      const redirectUrl = searchParams.get("redirect");
      router.push(
        redirectUrl && redirectUrl.startsWith("/") ? redirectUrl : "/dashboard"
      );
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Email atau password salah.";
      console.error("Gagal login:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 font-sans text-slate-900">
      <div className="w-full max-w-sm border border-slate-300 bg-white">
        <div className="border-b border-slate-300 bg-slate-50 px-4 py-2.5">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
            Akses Internal
          </p>
          <h1 className="mt-0.5 text-sm font-bold tracking-tight text-slate-900">
            Login Staf
          </h1>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 border border-slate-300 bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-900 bg-slate-900 text-white">
              <Box className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                Teem.id Tracking
              </p>
              <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                Sistem Pelacakan Supply Chain
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email Perusahaan</Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="staff@teem.id"
                  className="h-10 pl-9 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-10 pr-10 pl-9 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-2.5 right-2 flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                  tabIndex={-1}
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk ke Sistem"
              )}
            </Button>
          </form>
        </div>

        <div className="border-t border-slate-300 bg-slate-50 px-5 py-3 text-center text-[11px] text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-bold text-slate-900 underline underline-offset-2 hover:text-slate-700"
          >
            Daftar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-xs font-bold tracking-wide text-slate-500 uppercase">
        Memuat halaman...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}