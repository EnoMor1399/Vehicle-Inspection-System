import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70",
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
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">{eyebrow}</p>
        )}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-950 break-words">{title}</h1>
        {description && <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">{action}</div>}
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
    primary: "bg-slate-900 text-white hover:bg-slate-800 active:scale-95",
    secondary: "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 active:scale-95",
    ghost: "text-slate-700 hover:bg-slate-100 active:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:scale-95",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 sm:px-3.5 py-2 sm:py-1.5 text-sm sm:text-xs min-h-[40px] sm:min-h-0",
    md: "px-4 sm:px-5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0",
  };
  return (
    <button
      type={type}
      className={classNames(
        "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation",
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
        "inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ring-1 whitespace-nowrap",
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
    slate: "from-slate-500 to-slate-700",
    emerald: "from-emerald-500 to-emerald-700",
    red: "from-red-500 to-red-700",
    amber: "from-amber-500 to-amber-700",
    blue: "from-blue-500 to-blue-700",
    violet: "from-violet-500 to-violet-700",
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-semibold text-slate-950 break-words">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>}
        </div>
        {icon && (
          <div
            className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${tones[tone]} text-white grid place-items-center shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-12 sm:py-16 px-4">
      {icon && <div className="mx-auto mb-3 sm:mb-4 text-slate-400">{icon}</div>}
      <p className="text-base sm:text-lg text-slate-900 font-medium">{title}</p>
      {description && <p className="text-sm sm:text-base text-slate-500 mt-1.5 max-w-md mx-auto">{description}</p>}
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
      <span className="block text-sm sm:text-base font-medium text-slate-700 mb-1.5 sm:mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs sm:text-sm text-slate-500 mt-1.5">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={classNames(
        "block w-full rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-colors",
        props.className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={classNames(
        "block w-full rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-colors resize-y min-h-[100px]",
        props.className
      )}
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={classNames(
        "block w-full rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-colors",
        props.className
      )}
    >
      {children}
    </select>
  );
}
