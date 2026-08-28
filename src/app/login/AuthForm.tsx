"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/session";
import { Eye, EyeOff, Mail, Lock, User, Shield, Phone, AlertCircle, Loader2, KeyRound } from "lucide-react";

type Mode = "login" | "signup";

export function AuthForm() {
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
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");

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
          const res = await signIn(email, password, remember, twoFactorToken || undefined);
          if (!res.ok) {
            if (res.requires2FA) {
              setRequires2FA(true);
              setError(null);
              setFieldError(null);
              return;
            }
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

  return (
    <div>
      {/* Mode Tabs */}
      <div className="flex gap-1.5 sm:gap-2 mb-5 sm:mb-6 p-1 bg-slate-100 rounded-lg sm:rounded-xl">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); setFieldError(null); }}
          className={`flex-1 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-md sm:rounded-xl transition ${
            mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); setFieldError(null); }}
          className={`flex-1 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-md sm:rounded-xl transition ${
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
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 sm:px-4 py-3 text-sm text-red-700 flex items-start gap-2">
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
                className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-xl border bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-600 ${
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
              onChange={(e) => { setEmail(e.target.value); setRequires2FA(false); setTwoFactorToken(""); }}
              placeholder="you@rsl.gh"
              required
              disabled={pending}
              className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-xl border bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-600 ${
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
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-600"
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
              onChange={(e) => { setPassword(e.target.value); setRequires2FA(false); setTwoFactorToken(""); }}
              placeholder={mode === "signup" ? "12+ chars with Aa1!" : "••••••••"}
              required
              disabled={pending}
              className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 rounded-xl border bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-600 ${
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
              Use 12+ characters with uppercase, lowercase, a number and a special character
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
                className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 rounded-xl border bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-600 ${
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

        {mode === "login" && requires2FA && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950">Two-factor verification</p>
                <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">Enter the 6-digit code from your authenticator app to complete sign-in.</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Authentication code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={twoFactorToken}
              onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              disabled={pending}
              className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        )}

        {mode === "login" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                disabled={pending}
              />
              <span className="text-sm sm:text-base text-slate-700">Remember me for 30 days</span>
            </label>
            <span className="text-xs sm:text-sm text-slate-500">
              Account recovery is managed by your system administrator.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 sm:py-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-base sm:text-sm font-semibold hover:from-slate-800 hover:to-slate-700 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 mt-2"
        >
          {pending ? (
            <><Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" /> {mode === "login" ? (requires2FA ? "Verifying..." : "Signing in...") : "Creating account..."}</>
          ) : (
            <>
              {mode === "login" ? (requires2FA ? "Verify & Sign In" : "Sign In") : "Create Account"}
              <span className="ml-1">→</span>
            </>
          )}
        </button>

        {mode === "signup" && (
          <div className="flex items-start gap-2 p-3 sm:p-4 rounded-xl bg-blue-50 border border-blue-100">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs sm:text-sm text-blue-800">
              New accounts are created with <strong>Viewer</strong> role by default. An administrator can upgrade your permissions from the Users page.
            </p>
          </div>
        )}
      </form>

    </div>
  );
}
