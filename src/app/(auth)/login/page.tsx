"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (profile.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/staff/dashboard");
      }
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-slate-900 relative overflow-hidden font-sans">
      {/* Pattern Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      <Card className="w-full max-w-sm bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden relative z-10 text-slate-900">
        <CardContent className="p-7">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50 border border-red-100 text-red-600 shadow-sm">
              <Box className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Teem.id Tracking</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Sistem Pelacakan Supply Chain Internal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Email Perusahaan</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="staff@teem.id"
                  className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:bg-white text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:bg-white text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md shadow-red-600/20 gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk ke Sistem"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 font-medium">
            Belum punya akun?{" "}
            <Link href="/register" className="text-red-600 font-bold hover:underline">
              Daftar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Memuat halaman...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}