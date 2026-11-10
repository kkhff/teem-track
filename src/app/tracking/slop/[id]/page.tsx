import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import SlopDetailClient from "./detail-client";

export default function SlopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
          Memuat detail slop...
        </div>
      }
    >
      <SlopDetailClient params={params} />
    </Suspense>
  );
}
