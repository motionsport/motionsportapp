"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

// A QR code drawn on the page (no service): dark modules on white, so any phone camera reads it
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#070910", light: "#ffffff" },
    })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto rounded-xl bg-white p-2 [&>svg]:block [&>svg]:w-full [&>svg]:h-full"
      style={{ width: size, height: size }}
      // The library's own SVG markup for this text, nothing from the user rendered as HTML
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
