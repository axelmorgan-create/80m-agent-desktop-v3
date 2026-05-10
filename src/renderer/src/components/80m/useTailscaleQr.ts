import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { TailscaleMobileStatus } from "./settingsTypes";

export function useTailscaleQr(
  tailscale: TailscaleMobileStatus | null,
): string {
  const [tailscaleQr, setTailscaleQr] = useState("");
  const url = tailscale?.pairUrl || tailscale?.tailnetUrl;

  useEffect(() => {
    if (!url) {
      setTailscaleQr("");
      return;
    }

    let active = true;
    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: "#111611", light: "#f4fff7" },
    })
      .then((dataUrl) => {
        if (active) setTailscaleQr(dataUrl);
      })
      .catch(() => {
        if (active) setTailscaleQr("");
      });

    return () => {
      active = false;
    };
  }, [url]);

  return tailscaleQr;
}
