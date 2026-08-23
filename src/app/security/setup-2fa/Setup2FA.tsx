"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Shield, QrCode, Key } from "lucide-react";
import QRCode from "qrcode";
import { setup2FAAction, verify2FAAction } from "./setup-actions";

export function Setup2FA() {
  const router = useRouter();
  const [step, setStep] = useState<"initial" | "scan" | "verify">("initial");
  const [secret, setSecret] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await setup2FAAction();
      if (result.success && result.secret && result.uri) {
        setSecret(result.secret);
        // Generate QR code
        const qrUrl = await QRCode.toDataURL(result.uri, { width: 256 });
        setQrCodeUrl(qrUrl);
        setStep("scan");
      } else {
        setError(result.error || "Failed to setup 2FA");
      }
    } catch (err) {
      setError("An error occurred while setting up 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await verify2FAAction(verificationCode);
      if (result.success) {
        router.push("/security?2fa=enabled");
        router.refresh();
      } else {
        setError(result.error || "Invalid verification code");
      }
    } catch (err) {
      setError("An error occurred while verifying the code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Setup Two-Factor Authentication</h1>
        <p className="text-muted-foreground">
          Add an extra layer of security to your account
        </p>
      </div>

      <Card className="p-6">
        {step === "initial" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="font-semibold">Why enable 2FA?</h2>
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication adds an extra layer of security by requiring a code from your
                  authenticator app in addition to your password.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">What you&apos;ll need:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-600" />
                  A smartphone with an authenticator app installed
                </li>
                <li className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-green-600" />
                  Google Authenticator, Authy, or similar app
                </li>
              </ul>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
            )}

            <button
              onClick={handleSetup}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Setting up..." : "Get Started"}
            </button>
          </div>
        )}

        {step === "scan" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Scan QR Code</h2>
              <p className="text-sm text-muted-foreground">
                Open your authenticator app and scan this QR code
              </p>
            </div>

            <div className="flex justify-center">
              {qrCodeUrl && (
                <Image src={qrCodeUrl} alt="2FA QR Code" width={256} height={256} unoptimized className="border rounded-lg" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Can&apos;t scan? Enter this code manually:
              </p>
              <div className="p-3 bg-slate-50 rounded-md text-center">
                <code className="text-sm font-mono select-all">{secret}</code>
              </div>
            </div>

            <button
              onClick={() => setStep("verify")}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              I&apos;ve scanned the code
            </button>
          </div>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Verify Setup</h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="flex justify-center">
              <Key className="h-12 w-12 text-muted-foreground" />
            </div>

            <div>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl tracking-widest border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("scan")}
                className="flex-1 px-4 py-2 border rounded-md hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={verificationCode.length !== 6 || isLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

function Smartphone({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}
