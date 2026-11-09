import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PackageDetailClient from "./detail-client";

export default function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-red-600" />
          Memuat detail paket...
        </div>
      }
    >
      <PackageDetailClient params={params} />
    </Suspense>
  );
}
