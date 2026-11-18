import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

/**
 * Header halaman bergaya industrial: panel kotak, label mikro uppercase,
 * judul tegas, dan area aksi di kanan.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border border-slate-300 bg-white p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "mt-0.5 text-lg font-bold tracking-tight text-slate-900 sm:text-xl",
            titleClassName
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-xs text-slate-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
