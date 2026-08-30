import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] text-[var(--vims-ink)] shadow-[var(--vims-shadow-soft)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-2xl font-semibold tracking-[-0.025em] text-[var(--vims-ink)] sm:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-[var(--vims-ink-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit" | "reset";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-[var(--vims-ink)] text-[var(--vims-panel-solid)] shadow-sm hover:opacity-90",
    secondary: "border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] text-[var(--vims-ink)] shadow-sm hover:bg-[var(--vims-panel-soft)]",
    ghost: "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
    success: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  };
  const sizes: Record<string, string> = {
    sm: "min-h-9 px-3 py-2 text-xs sm:min-h-0 sm:py-1.5",
    md: "min-h-11 px-4 py-2.5 text-sm sm:min-h-10 sm:py-2",
  };
  return (
    <button
      type={type}
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#07101c]",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "red" | "blue" | "violet" | "orange";
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/45 dark:text-amber-300 dark:ring-amber-800",
    red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/45 dark:text-red-300 dark:ring-red-800",
    blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/45 dark:text-blue-300 dark:ring-blue-800",
    violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/45 dark:text-violet-300 dark:ring-violet-800",
    orange: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/45 dark:text-orange-300 dark:ring-orange-800",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "emerald" | "red" | "amber" | "blue" | "violet";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-300 dark:ring-emerald-900",
    red: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/45 dark:text-red-300 dark:ring-red-900",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-300 dark:ring-amber-900",
    blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-300 dark:ring-blue-900",
    violet: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/45 dark:text-violet-300 dark:ring-violet-900",
  };

  return (
    <Card className="group relative overflow-hidden p-4 sm:p-5">
      <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--vims-line)] transition-colors group-hover:bg-[var(--brand-color)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-[var(--vims-ink)] sm:text-[28px]">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-[var(--vims-ink-muted)]">{hint}</p>}
        </div>
        {icon && (
          <div className={classNames("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", tones[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--vims-line-strong)] bg-[var(--vims-panel-soft)] px-4 py-12 text-center sm:py-14">
      {icon && <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--vims-panel-solid)] text-[var(--vims-ink-muted)] shadow-sm ring-1 ring-[var(--vims-line)]">{icon}</div>}
      <p className="text-base font-semibold text-[var(--vims-ink)]">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[var(--vims-ink-muted)]">{description}</p>}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">
        {label}
        {required && <span className="ml-0.5 text-red-500 dark:text-red-400">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-[var(--vims-ink-muted)]">{hint}</span>}
    </label>
  );
}

const controlClass =
  "block w-full rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3.5 py-2.5 text-base text-[var(--vims-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-[var(--vims-ink-muted)] transition-[border-color,box-shadow,background-color,color] hover:border-[var(--vims-ink-muted)] focus:border-[var(--brand-color)] focus:outline-none focus:ring-4 focus:ring-[var(--vims-focus)] sm:text-sm";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={classNames(controlClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={classNames(controlClass, "min-h-[110px] resize-y", props.className)}
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={classNames(controlClass, props.className)}>
      {children}
    </select>
  );
}
