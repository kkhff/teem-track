"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Box, User, Mail, KeyRound, MapPin, Loader2 } from "lucide-react";

interface Location {
  id: string;
  name: string;
  type: string;
}

function RegisterContent() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [locationId, setLocationId] = useState("");
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Ambil data lokasi dari tabel locations saat komponen dimuat
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from("locations")
          .select("id, name, type")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        setLocations(data || []);
      } catch (err) {
        console.error("Gagal memuat data lokasi:", err);
        toast.error("Gagal memuat daftar lokasi penempatan.");
      } finally {
        setLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [supabase]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !locationId) {
      toast.error("Semua kolom termasuk penempatan lokasi wajib diisi!");
      return;
    }

    if (password.length < 6) {
      toast.error("Password minimal harus 6 karakter!");
      return;
    }

    try {
      setLoading(true);

      // 1. Daftarkan user ke Supabase Auth
      // Catatan: Trigger database otomatis akan memasukkan data ke tabel profiles berdasarkan id dan email.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Update tambahan untuk mengisi location_id yang dipilih pada tabel profiles
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            location_id: locationId,
            full_name: fullName.trim() 
          })
          .eq("id", authData.user.id);

        if (updateError) throw updateError;
      }

      toast.success("Pendaftaran berhasil!", {
        description: "Silakan masuk menggunakan akun baru Anda.",
      });

      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mendaftar.";
      console.error("Gagal mendaftar:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 font-sans text-slate-900">
      <div className="w-full max-w-md border border-slate-300 bg-white">
        <div className="border-b border-slate-300 bg-slate-50 px-4 py-2.5">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
            Pendaftaran Staf
          </p>
          <h1 className="mt-0.5 text-sm font-bold tracking-tight text-slate-900">
            Daftar Akun Baru
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

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="register-name">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Nama Lengkap Staf"
                  className="h-10 pl-9 text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="register-email">Email Perusahaan</Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-email"
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
              <Label htmlFor="register-location">
                Penempatan Lokasi (Pabrik / Gudang)
              </Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-3 left-3 z-10 h-4 w-4 text-slate-400" />
                <select
                  id="register-location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="h-10 w-full cursor-pointer appearance-none rounded-none border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                  disabled={loadingLocations}
                >
                  <option value="" disabled>
                    {loadingLocations
                      ? "Memuat lokasi..."
                      : "Pilih Lokasi Penempatan"}
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="register-password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-password"
                  type="password"
                  placeholder="••••••••"
                  className="h-10 pl-9 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || loadingLocations}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Daftar Sekarang"
              )}
            </Button>
          </form>
        </div>

        <div className="border-t border-slate-300 bg-slate-50 px-5 py-3 text-center text-[11px] text-slate-500">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-bold text-slate-900 underline underline-offset-2 hover:text-slate-700"
          >
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-xs font-bold tracking-wide text-slate-500 uppercase">
        Memuat halaman...
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}