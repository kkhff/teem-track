import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-none border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 transition-colors outline-none placeholder:text-slate-400 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        "focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900",
        "aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500/30",
        className
      )}
      {...props}
    />
  );
}

export { Input };
