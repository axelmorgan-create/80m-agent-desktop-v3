import * as fs from "fs";
import { join } from "path";

interface ProfileWatcher {
  emit(source: string): void;
  start(): void;
  stop(): void;
}

export function createProfileWatcher(
  hermesHome: string,
  onProfilesChanged: (source: string) => void,
): ProfileWatcher {
  let profileWatchers: fs.FSWatcher[] = [];
  let profileWatchDebounce: NodeJS.Timeout | null = null;

  function emit(source: string): void {
    onProfilesChanged(source);
  }

  function schedule(source: string): void {
    if (profileWatchDebounce) {
      clearTimeout(profileWatchDebounce);
    }
    profileWatchDebounce = setTimeout(() => {
      profileWatchDebounce = null;
      emit(source);
    }, 250);
  }

  function stop(): void {
    for (const watcher of profileWatchers) watcher.close();
    profileWatchers = [];
    if (profileWatchDebounce) {
      clearTimeout(profileWatchDebounce);
      profileWatchDebounce = null;
    }
  }

  function start(): void {
    stop();
    const roots = [hermesHome, join(hermesHome, "profiles")];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      try {
        const watcher = fs.watch(
          root,
          { persistent: false },
          (_event, filename) => {
            const changed = filename ? String(filename) : "";
            if (
              root === hermesHome &&
              changed &&
              changed !== "active_profile" &&
              changed !== "profiles"
            ) {
              return;
            }
            schedule("filesystem");
            if (root === hermesHome || changed === "profiles") {
              setTimeout(start, 500);
            }
          },
        );
        watcher.on("error", () => undefined);
        profileWatchers.push(watcher);
      } catch {
        // Profile auto-discovery also has renderer focus/interval fallbacks.
      }
    }
  }

  return { emit, start, stop };
}
