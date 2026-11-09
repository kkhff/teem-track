"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-slate-900 relative overflow-hidden font-sans py-10">
      {/* Pattern Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      <Card className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden relative z-10 text-slate-900">
        <CardContent className="p-7">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50 border border-red-100 text-red-600 shadow-sm">
              <Box className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Daftar Akun Baru</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Teem.id Tracking System</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Nama Lengkap Staf"
                  className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:bg-white text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

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
              <Label className="text-xs font-semibold text-slate-700">Penempatan Lokasi (Pabrik / Gudang)</Label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white appearance-none cursor-pointer"
                  required
                  disabled={loadingLocations}
                >
                  <option value="" disabled>
                    {loadingLocations ? "Memuat lokasi..." : "Pilih Lokasi Penempatan"}
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:bg-white text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || loadingLocations}
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md shadow-red-600/20 gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Daftar Sekarang"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 font-medium">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-red-600 font-bold hover:underline">
              Masuk
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Memuat halaman...
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}