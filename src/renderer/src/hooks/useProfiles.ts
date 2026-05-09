import { useCallback, useEffect, useState } from "react";

export interface RendererProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isActive: boolean;
  model: string;
  provider: string;
  hasEnv: boolean;
  hasSoul: boolean;
  skillCount: number;
  gatewayRunning: boolean;
}

function sortProfiles(profiles: RendererProfileInfo[]): RendererProfileInfo[] {
  return [...profiles].sort((a, b) => {
    if (a.name === "default") return -1;
    if (b.name === "default") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function useProfiles(options: { intervalMs?: number } = {}): {
  profiles: RendererProfileInfo[];
  loading: boolean;
  error: string;
  refreshProfiles: (silent?: boolean) => Promise<void>;
} {
  const intervalMs = options.intervalMs ?? 30000;
  const [profiles, setProfiles] = useState<RendererProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshProfiles = useCallback(async (silent = true): Promise<void> => {
    if (!window.hermesAPI?.listProfiles) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const list = await window.hermesAPI.listProfiles();
      setProfiles(sortProfiles((list || []) as RendererProfileInfo[]));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfiles(false);

    const refreshQuietly = (): void => {
      void refreshProfiles(true);
    };

    const unsubscribe = window.hermesAPI?.onProfilesChanged?.(refreshQuietly);
    window.addEventListener("focus", refreshQuietly);
    const handleVisibility = (): void => {
      if (!document.hidden) refreshQuietly();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(refreshQuietly, intervalMs);

    return () => {
      unsubscribe?.();
      window.removeEventListener("focus", refreshQuietly);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [intervalMs, refreshProfiles]);

  return { profiles, loading, error, refreshProfiles };
}
