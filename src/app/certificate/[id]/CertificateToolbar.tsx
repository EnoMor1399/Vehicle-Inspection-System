"use client";

import { Button } from "@/components/ui";
import { Download, Printer, Share2 } from "lucide-react";

interface CertificateToolbarProps {
  vehicleRegistration: string;
  verifyUrl: string;
}

export function CertificateToolbar({ vehicleRegistration, verifyUrl }: CertificateToolbarProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Inspection Certificate - ${vehicleRegistration}`,
          text: `View the inspection certificate for ${vehicleRegistration}`,
          url: verifyUrl,
        });
      } catch (err) {
        console.log("Share cancelled or failed:", err);
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(verifyUrl);
        alert("Certificate URL copied to clipboard!");
      } catch (err) {
        console.log("Failed to copy URL:", err);
      }
    }
  };

  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-2 bg-white rounded-xl shadow-lg p-2 border border-slate-200">
      <Button onClick={handlePrint} variant="secondary" size="sm" className="flex items-center gap-2">
        <Printer className="w-4 h-4" />
        Print
      </Button>
      <Button onClick={handleDownload} variant="secondary" size="sm" className="flex items-center gap-2">
        <Download className="w-4 h-4" />
        Save PDF
      </Button>
      <Button onClick={handleShare} variant="secondary" size="sm" className="flex items-center gap-2">
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    </div>
  );
}
