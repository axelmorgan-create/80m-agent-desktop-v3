import { useState, useEffect, useCallback } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import Welcome from "./screens/Welcome/Welcome";
import Install from "./screens/Install/Install";
import Setup from "./screens/Setup/Setup";
import SplashScreen from "./screens/SplashScreen/SplashScreen";
import { Layout80m } from "./components/80m";
import { useI18n } from "./components/useI18n";
import BackgroundLayers from "./components/BackgroundLayers";
import FilmGrainCanvas from "./components/FilmGrainCanvas";
import AppTitleBar from "./components/80m/AppTitleBar";
import AppNotifications from "./components/80m/AppNotifications";
import SelectionToolbar from "./components/80m/SelectionToolbar";

type Screen = "splash" | "welcome" | "installing" | "setup" | "main";

const SVG_ICON_CLICK_CLASS = "svg-icon-clicked";
const SVG_ICON_CLICK_MOTION_PREFIX = "svg-icon-clicked--";
const SVG_ICON_CLICK_MS = 760;
const SVG_ICON_HOST_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  "[data-icon-motion]",
  ".sidebar-nav-item",
  ".sidebar-80m-nav-item",
  ".conversation-tab",
  ".memory-tab",
  ".skills-tab",
  ".kanban-doc-button",
  ".tools-card",
  ".agents-card",
].join(",");
const svgIconMotionTimers = new WeakMap<
  SVGElement,
  { timer: number; motionClass: string }
>();

function appendSvgIconSignal(bits: string[], element: Element | null): void {
  if (!element) return;

  [
    "class",
    "id",
    "aria-label",
    "title",
    "data-icon-motion",
    "data-lucide",
    "role",
  ].forEach((attr) => {
    const value = element.getAttribute(attr);
    if (value) bits.push(value);
  });

  const text = element.textContent?.trim();
  if (text && text.length <= 120) {
    bits.push(text);
  }
}

function getSvgIconSignal(svg: SVGElement, host: Element | null): string {
  const bits: string[] = [];
  appendSvgIconSignal(bits, svg);
  appendSvgIconSignal(bits, svg.closest("[class*='icon'], [class*='Icon']"));
  appendSvgIconSignal(bits, host);
  appendSvgIconSignal(bits, host?.parentElement ?? null);

  const svgTitle = svg.querySelector("title")?.textContent?.trim();
  if (svgTitle) bits.push(svgTitle);

  return bits.join(" ").toLowerCase().replace(/[_-]+/g, " ");
}

function signalHas(signal: string, ...needles: string[]): boolean {
  return needles.some((needle) => signal.includes(needle));
}

function getSvgIconClickMotion(svg: SVGElement, host: Element | null): string {
  const signal = getSvgIconSignal(svg, host);

  if (signalHas(signal, "trash", "delete", "discard")) return "trash";
  if (signalHas(signal, "copy", "clipboard")) {
    return signalHas(signal, "paste") ? "paste" : "copy";
  }
  if (signalHas(signal, "mic", "record", "voice")) return "mic";
  if (signalHas(signal, "send", "queue", "steer")) return "send";
  if (signalHas(signal, "arrow right", "go", "forward")) return "send";
  if (signalHas(signal, "back", "arrow left")) return "back";
  if (signalHas(signal, "refresh", "reload", "recheck", "sync")) {
    return "refresh";
  }
  if (signalHas(signal, "external", "open outside", "reveal")) {
    return "external";
  }
  if (signalHas(signal, "download", "upload", "import", "export", "backup")) {
    return "transfer";
  }
  if (signalHas(signal, "brain", "memory", "neural")) return "brain";
  if (signalHas(signal, "search", "scan", "inspect")) return "search";
  if (signalHas(signal, "folder", "file", "vault", "document")) return "folder";
  if (signalHas(signal, "preview", "eye", "vision")) return "eye";
  if (signalHas(signal, "settings", "wrench", "configure")) return "settings";
  if (signalHas(signal, "plus", "new", "add", "create")) return "plus";
  if (signalHas(signal, "close", "dismiss", "x circle", " lucide x ")) {
    return "close";
  }
  if (signalHas(signal, "minimize", "minus")) return "minimize";
  if (signalHas(signal, "stop", "abort")) return "stop";
  if (signalHas(signal, "play", "resume", "start")) return "play";
  if (signalHas(signal, "pause")) return "pause";
  if (signalHas(signal, "split", "layers", "stack", "column", "kanban")) {
    return "layers";
  }
  if (signalHas(signal, "square", "maximize", "restore", "window", "browser")) {
    return "window";
  }
  if (signalHas(signal, "chevron", "dropdown", "menu", "open conversations")) {
    return "chevron";
  }
  if (signalHas(signal, "globe", "web", "gateway", "network")) return "globe";
  if (signalHas(signal, "check", "success", "ok")) return "check";
  if (signalHas(signal, "alert", "warning", "error", "triangle")) {
    return "alert";
  }
  if (signalHas(signal, "clock", "timer", "calendar", "schedule")) {
    return "clock";
  }
  if (signalHas(signal, "spark", "zap", "fast", "bolt")) return "spark";
  if (signalHas(signal, "terminal", "shell", "command")) return "terminal";
  if (signalHas(signal, "code", "execution")) return "code";
  if (signalHas(signal, "pen", "edit", "write")) return "pen";
  if (signalHas(signal, "audio", "tts", "sound", "speaker")) return "audio";
  if (signalHas(signal, "image", "photo", "camera")) return "image";
  if (signalHas(signal, "bot", "agent")) return "bot";
  if (signalHas(signal, "chat", "message", "conversation")) return "chat";

  return "pop";
}

function clearSvgIconClickMotion(svg: SVGElement): void {
  svg.classList.remove(SVG_ICON_CLICK_CLASS);
  Array.from(svg.classList)
    .filter((className) => className.startsWith(SVG_ICON_CLICK_MOTION_PREFIX))
    .forEach((className) => svg.classList.remove(className));
}

function restartSvgIconClickMotion(
  svg: SVGElement,
  host: Element | null,
): void {
  if (svg.classList.contains("svg-icon-motion-disabled")) return;

  const previous = svgIconMotionTimers.get(svg);
  if (previous) {
    window.clearTimeout(previous.timer);
  }

  const motionClass = `${SVG_ICON_CLICK_MOTION_PREFIX}${getSvgIconClickMotion(
    svg,
    host,
  )}`;

  clearSvgIconClickMotion(svg);
  void svg.getBoundingClientRect();
  svg.classList.add(SVG_ICON_CLICK_CLASS, motionClass);

  const timer = window.setTimeout(() => {
    clearSvgIconClickMotion(svg);
    svgIconMotionTimers.delete(svg);
  }, SVG_ICON_CLICK_MS);
  svgIconMotionTimers.set(svg, { timer, motionClass });
}

function triggerSvgIconClickMotion(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;

  const icons = new Map<SVGElement, Element | null>();
  const host = target.closest(SVG_ICON_HOST_SELECTOR);
  const directSvg = target.closest("svg");
  if (directSvg instanceof SVGElement) {
    icons.set(directSvg, host);
  }

  host?.querySelectorAll("svg").forEach((svg) => {
    if (svg instanceof SVGElement) {
      icons.set(svg, host);
    }
  });

  icons.forEach((iconHost, svg) => restartSvgIconClickMotion(svg, iconHost));
}

function App(): React.JSX.Element {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>("splash");
  const [installError, setInstallError] = useState<string | null>(null);
  const [nextScreen, setNextScreen] = useState<Screen | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  const runInstallCheck = useCallback(async () => {
    let plannedScreen: Screen = "welcome";
    let isRemote = false;
    try {
      const conn = await window.hermesAPI.getConnectionConfig();
      isRemote = conn.mode === "remote";

      // Remote mode: verify the remote server is reachable
      if (conn.mode === "remote" && conn.remoteUrl) {
        const ok = await window.hermesAPI.testRemoteConnection(
          conn.remoteUrl,
          conn.apiKey,
        );
        if (ok) {
          plannedScreen = "main";
        } else {
          setInstallError(
            `Cannot reach remote 80M at ${conn.remoteUrl}. Check the URL or switch to local mode.`,
          );
          plannedScreen = "welcome";
        }
        setNextScreen(plannedScreen);
        return;
      }

      // Local mode: normal install check
      const status = await window.hermesAPI.checkInstall();
      if (!status.installed) {
        plannedScreen = "welcome";
      } else if (!status.hasApiKey) {
        plannedScreen = "setup";
      } else {
        plannedScreen = "main";
      }
      setNextScreen(plannedScreen);
    } catch {
      setNextScreen("welcome");
      return;
    }

    // Deep Python verification can be slow on cold startup, so keep it off the
    // critical route and surface the broken-install warning after the UI opens.
    if ((plannedScreen === "main" || plannedScreen === "setup") && !isRemote) {
      window.hermesAPI.verifyInstall().then((ok) => {
        if (!ok) {
          setInstallError(t("errors.installBroken"));
          setNextScreen("welcome");
          setScreen("welcome");
        }
      });
    }
  }, [t]);

  // Run install check during splash
  useEffect(() => {
    runInstallCheck();
  }, [runInstallCheck]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      triggerSvgIconClickMotion(event.target);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== " ") return;
      triggerSvgIconClickMotion(event.target);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // Transition away from splash when both animation and install check are done
  useEffect(() => {
    if (splashDone && nextScreen) {
      setScreen(nextScreen);
    }
  }, [splashDone, nextScreen]);

  const handleSplashFinished = useCallback(() => {
    setSplashDone(true);
  }, []);

  function handleInstallComplete(): void {
    setInstallError(null);
    setScreen("setup");
  }

  function handleInstallFailed(error: string): void {
    setInstallError(error);
    setScreen("welcome");
  }

  function handleRetryInstall(): void {
    setInstallError(null);
    setScreen("installing");
  }

  function handleRecheck(): void {
    setInstallError(null);
    setScreen("splash");
    setSplashDone(false);
    setNextScreen(null);
    runInstallCheck();
  }

  function renderScreen(): React.JSX.Element {
    switch (screen) {
      case "splash":
        return <SplashScreen onFinished={handleSplashFinished} />;
      case "welcome":
        return (
          <Welcome
            error={installError}
            onStart={handleRetryInstall}
            onRecheck={handleRecheck}
          />
        );
      case "installing":
        return (
          <Install
            onComplete={handleInstallComplete}
            onFailed={handleInstallFailed}
          />
        );
      case "setup":
        return <Setup onComplete={() => setScreen("main")} />;
      case "main":
        return <Layout80m playSplashLanding={splashDone} />;
    }
  }

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="app">
          <AppTitleBar />
          <BackgroundLayers />
          <div className="app-content">{renderScreen()}</div>
          <SelectionToolbar />
          <AppNotifications />
          <FilmGrainCanvas />
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
