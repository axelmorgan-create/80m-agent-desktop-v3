import { useCallback } from "react";

export type DesktopToastTone = "info" | "success" | "warning" | "error";

export function useDesktopToast(): (
  title: string,
  body: string,
  tone?: DesktopToastTone,
) => void {
  return useCallback(
    (title: string, body: string, tone: DesktopToastTone = "info") => {
      window.dispatchEvent(
        new CustomEvent("desktop-toast", {
          detail: { title, body, tone },
        }),
      );
    },
    [],
  );
}
