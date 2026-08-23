import QRCodeLib from "qrcode";

export async function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const dataUrl = await QRCodeLib.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="Verification QR code" width={size} height={size} />;
}
