import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

const DEFAULT_PREVIEW_WIDTH = 520;
const MIN_PREVIEW_WIDTH = 420;
const PREVIEW_WIDTH_STORAGE_KEY = "80m-agent-preview-width";

function clampPreviewWidth(width: number): number {
  const maxWidth =
    typeof window === "undefined"
      ? 920
      : Math.max(MIN_PREVIEW_WIDTH, Math.min(1080, window.innerWidth - 360));
  return Math.min(Math.max(width, MIN_PREVIEW_WIDTH), maxWidth);
}

function loadPreviewWidth(): number {
  if (typeof localStorage === "undefined") return DEFAULT_PREVIEW_WIDTH;

  const saved = Number(localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY));
  return Number.isFinite(saved)
    ? clampPreviewWidth(saved)
    : DEFAULT_PREVIEW_WIDTH;
}

export function useAgentPreviewDock() {
  const [showPreview, setShowPreview] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(loadPreviewWidth);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handlePreviewUrl = () => {
      setShowPreview(true);
    };
    window.addEventListener("open-agent-preview-url", handlePreviewUrl);
    return () =>
      window.removeEventListener("open-agent-preview-url", handlePreviewUrl);
  }, []);

  const handlePreviewResizeStart = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeCleanupRef.current?.();
      document.body.classList.add("agent-preview-resizing");

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (moveEvent.buttons === 0) {
          resizeCleanupRef.current?.();
          return;
        }
        const nextWidth = clampPreviewWidth(
          window.innerWidth - moveEvent.clientX,
        );
        setPreviewWidth(nextWidth);
        localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, String(nextWidth));
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          resizeCleanupRef.current?.();
        }
      };

      const cleanup = () => {
        document.body.classList.remove("agent-preview-resizing");
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", cleanup);
        window.removeEventListener("blur", cleanup);
        document.removeEventListener("mouseleave", cleanup);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        resizeCleanupRef.current = null;
      };

      resizeCleanupRef.current = cleanup;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", cleanup);
      window.addEventListener("blur", cleanup);
      document.addEventListener("mouseleave", cleanup);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    },
    [],
  );

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );

  return {
    handlePreviewResizeStart,
    previewWidth,
    setShowPreview,
    showPreview,
  };
}
