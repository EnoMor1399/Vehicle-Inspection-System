import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025),0_12px_32px_rgba(15,23,42,0.045)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
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
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:mb-8 sm:pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-7 bg-[var(--brand-color)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          </div>
        )}
        <h1 className="break-words text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">{description}</p>
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
    primary: "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
    secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    success: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
  };
  const sizes: Record<string, string> = {
    sm: "min-h-9 px-3 py-2 text-xs sm:min-h-0 sm:py-1.5",
    md: "min-h-11 px-4 py-2.5 text-sm sm:min-h-10 sm:py-2",
  };
  return (
    <button
      type={type}
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
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
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    orange: "bg-orange-50 text-orange-800 ring-orange-200",
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
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };

  return (
    <Card className="group relative overflow-hidden p-4 sm:p-5">
      <span className="absolute inset-x-0 top-0 h-[2px] bg-slate-200 transition-colors group-hover:bg-[var(--brand-color)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-12 text-center sm:py-14">
      {icon && <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">{icon}</div>}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
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
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

const controlClass =
  "block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] hover:border-slate-400 focus:border-[var(--brand-color)] focus:outline-none focus:ring-4 focus:ring-slate-100 sm:text-sm";

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
