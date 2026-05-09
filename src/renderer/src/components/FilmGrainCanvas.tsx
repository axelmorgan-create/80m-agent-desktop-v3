import { useEffect, useRef } from "react";

type GrainTheme = "light" | "dark";

const getResolvedTheme = (): GrainTheme =>
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";

const getGrainOpacity = (): string =>
  getResolvedTheme() === "dark" ? "0.18" : "0.12";

const FilmGrainCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let rafId: number;

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.ceil(window.innerWidth);
      const height = Math.ceil(window.innerHeight);

      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const syncTheme = (): void => {
      canvas.style.opacity = getGrainOpacity();
    };

    resize();
    syncTheme();
    window.addEventListener("resize", resize);

    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
    });

    const draw = (): void => {
      frameRef.current++;
      // Regenerate at a high backing resolution so the texture stays fine, not blocky.
      if (frameRef.current % 3 === 0) {
        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const v =
            128 + (Math.random() + Math.random() + Math.random() - 1.5) * 76;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
      }
      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="film-grain-canvas"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 10000,
        pointerEvents: "none",
        display: "block",
        imageRendering: "auto",
        mixBlendMode: "soft-light",
        opacity: 0.18,
      }}
      aria-hidden="true"
    />
  );
};

export default FilmGrainCanvas;
