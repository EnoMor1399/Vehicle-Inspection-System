"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/session";
import { Button } from "@/components/ui";
import { Eye, EyeOff, Mail, Lock, User, Shield, Phone, AlertCircle, Loader2 } from "lucide-react";

type Mode = "login" | "signup";

export function AuthForm({ hasUsers, showDemoAccounts = false }: { hasUsers: boolean; showDemoAccounts?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // Signup form state
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    startTransition(async () => {
      try {
        if (mode === "login") {
          const res = await signIn(email, password, remember);
          if (!res.ok) {
            setError(res.error);
            setFieldError(res.field || null);
            return;
          }
          router.push("/");
          router.refresh();
        } else {
          const res = await signUp({ name, email, password, confirmPassword, phone });
          if (!res.ok) {
            setError(res.error);
            setFieldError(res.field || null);
            return;
          }
          router.push("/");
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      }
    });
  }

  function fillDemo(email: string) {
    setEmail(email);
    setPassword("Demo-Only@2026!");
    setMode("login");
    setError(null);
    setFieldError(null);
  }

  return (
    <div>
      {/* Mode Tabs */}
      <div className="flex gap-1.5 sm:gap-2 mb-5 sm:mb-6 p-1 bg-slate-100 rounded-lg sm:rounded-xl">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); setFieldError(null); }}
          className={`flex-1 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-md sm:rounded-lg transition ${
            mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); setFieldError(null); }}
          className={`flex-1 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-md sm:rounded-lg transition ${
            mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Create Account
        </button>
      </div>

      <div className="mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mt-1">
          {mode === "login"
            ? "Sign in to continue to VIMS"
            : "Join Road Safety Limited as a viewer"}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 sm:px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {mode === "signup" && (
          <div>
            <label className="block text-sm sm:text-base font-medium text-slate-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Mensah"
                required
                disabled={pending}
                className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg border bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                  fieldError === "name" ? "border-red-400" : "border-slate-300"
                }`}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm sm:text-base font-medium text-slate-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@rsl.gh"
              required
              disabled={pending}
              className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg border bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                fieldError === "email" ? "border-red-400" : "border-slate-300"
              }`}
            />
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label className="block text-sm sm:text-base font-medium text-slate-700 mb-2">
              Phone <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 20 000 0000"
                disabled={pending}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm sm:text-base font-medium text-slate-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min. 8 chars, Aa1" : "••••••••"}
              required
              disabled={pending}
              className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 rounded-lg border bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                fieldError === "password" ? "border-red-400" : "border-slate-300"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
          {mode === "signup" && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Use 8+ characters with uppercase, lowercase and a number
            </p>
          )}
        </div>

        {mode === "signup" && (
          <div>
            <label className="block text-sm sm:text-base font-medium text-slate-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                disabled={pending}
                className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 rounded-lg border bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                  fieldError === "confirmPassword" ? "border-red-400" : "border-slate-300"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>
        )}

        {mode === "login" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                disabled={pending}
              />
              <span className="text-sm sm:text-base text-slate-700">Remember me for 30 days</span>
            </label>
            <button type="button" className="text-sm sm:text-base text-amber-700 hover:text-amber-800 font-medium">
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 sm:py-3 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 text-white text-base sm:text-sm font-semibold hover:from-slate-800 hover:to-slate-700 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 mt-2"
        >
          {pending ? (
            <><Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" /> {mode === "login" ? "Signing in..." : "Creating account..."}</>
          ) : (
            <>
              {mode === "login" ? "Sign In" : "Create Account"}
              <span className="ml-1">→</span>
            </>
          )}
        </button>

        {mode === "signup" && (
          <div className="flex items-start gap-2 p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-100">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs sm:text-sm text-blue-800">
              New accounts are created with <strong>Viewer</strong> role by default. An administrator can upgrade your permissions from the Users page.
            </p>
          </div>
        )}
      </form>

      {/* Demo credentials */}
      {hasUsers && showDemoAccounts && (
        <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-slate-200">
          <p className="text-xs sm:text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3 sm:mb-4">
            Demo Accounts <span className="text-slate-400 font-normal normal-case">(password: Demo-Only@2026!)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <DemoButton label="Super Admin" email="ceo@rsl.gh" onClick={fillDemo} />
            <DemoButton label="Inspector" email="john@rsl.gh" onClick={fillDemo} />
            <DemoButton label="Supervisor" email="grace@rsl.gh" onClick={fillDemo} />
            <DemoButton label="Auditor" email="nana@rsl.gh" onClick={fillDemo} />
          </div>
        </div>
      )}
    </div>
  );
}

function DemoButton({ label, email, onClick }: { label: string; email: string; onClick: (email: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(email)}
      className="text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition active:scale-95"
    >
      <p className="text-sm sm:text-base font-semibold text-slate-900">{label}</p>
      <p className="text-xs sm:text-sm text-slate-500 font-mono mt-0.5">{email}</p>
    </button>
  );
}
