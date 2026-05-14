import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MessageCircle, Mic, MoreHorizontal, Square, X } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AtmMascot from "./AtmMascot";
import buddyModelUrl from "../../assets/models/winged-atm-buddy.glb?url";

type MascotState =
  | "default"
  | "processing"
  | "typing"
  | "sleep"
  | "error"
  | "searching"
  | "jackpot"
  | "lobster"
  | "urgent"
  | "job-done";

interface BuddyStatePayload {
  state?: MascotState;
  profile?: string;
  label?: string;
}

type BuddyVoiceStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "sent"
  | "error";

const MASCOT_STATES = new Set<MascotState>([
  "default",
  "processing",
  "typing",
  "sleep",
  "error",
  "searching",
  "jackpot",
  "lobster",
  "urgent",
  "job-done",
]);

const MODEL_FRONT_ROTATION = 0;
const FACE_CENTER = new THREE.Vector3(0, 0.345, 0.68);
const FACE_WIDTH = 0.76;
const FACE_HEIGHT = 0.46;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeMascotState(state?: string): MascotState {
  return MASCOT_STATES.has(state as MascotState)
    ? (state as MascotState)
    : "default";
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function createBakedMaterial(
  material: THREE.Material,
  renderer: THREE.WebGLRenderer,
): THREE.Material {
  if (material instanceof THREE.MeshStandardMaterial) {
    material.color.set(0xb4bbb4);
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.metalness = Math.min(material.metalness, 0.18);
    material.roughness = Math.max(material.roughness, 0.72);
  }

  const source = material as THREE.Material & {
    map?: THREE.Texture | null;
    alphaTest?: number;
    side?: THREE.Side;
    transparent?: boolean;
  };

  if (!source.map) {
    material.needsUpdate = true;
    return material;
  }

  source.map.colorSpace = THREE.SRGBColorSpace;
  source.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  source.map.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    name: `${material.name || "desktop-buddy"}-baked`,
    map: source.map,
    color: 0xb4bbb4,
    alphaTest: source.alphaTest || 0.01,
    side: source.side,
    transparent: source.transparent,
    toneMapped: false,
  });
}

function useBuddyModel(
  hostRef: RefObject<HTMLDivElement | null>,
  stateRef: RefObject<MascotState>,
  faceRef: RefObject<HTMLDivElement | null>,
): { ready: boolean; failed: boolean } {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.04, 6.55);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "desktop-buddy-webgl";
    host.appendChild(renderer.domElement);

    const modelRoot = new THREE.Group();
    modelRoot.position.y = -0.02;
    scene.add(modelRoot);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1f231f, 1.35);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(2.7, 3.5, 4);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xdfffee, 0.5);
    rim.position.set(-3.4, 1.6, -2.2);
    scene.add(rim);

    const fill = new THREE.PointLight(0xffe4a4, 0.42, 7);
    fill.position.set(-1.7, -0.8, 2.6);
    scene.add(fill);

    let model: THREE.Object3D | null = null;
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const resize = (): void => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const loader = new GLTFLoader();
    loader.load(
      buddyModelUrl,
      (gltf) => {
        if (disposed) return;

        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 1.18 / Math.max(size.x, size.y, size.z, 0.01);

        model.position.sub(center);
        model.position.y -= 0.01;
        model.scale.setScalar(scale);
        model.rotation.set(0.02, MODEL_FRONT_ROTATION, 0);

        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.frustumCulled = false;
          if (child.material) {
            child.material = Array.isArray(child.material)
              ? child.material.map((material) =>
                  createBakedMaterial(material, renderer),
                )
              : createBakedMaterial(child.material, renderer);
          }
        });

        modelRoot.add(model);
        setReady(true);
      },
      undefined,
      (error) => {
        console.error("Failed to load desktop buddy model", error);
        if (!disposed) setFailed(true);
      },
    );

    const projectModelPoint = (
      localPoint: THREE.Vector3,
    ): { x: number; y: number; z: number } | null => {
      if (!model) return null;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const projected = model.localToWorld(localPoint.clone()).project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
        z: projected.z,
      };
    };

    const updateFaceProjection = (): void => {
      const face = faceRef.current;
      if (!face || !model) return;

      scene.updateMatrixWorld(true);
      const center = projectModelPoint(FACE_CENTER);
      const left = projectModelPoint(
        FACE_CENTER.clone().add(new THREE.Vector3(-FACE_WIDTH / 2, 0, 0)),
      );
      const right = projectModelPoint(
        FACE_CENTER.clone().add(new THREE.Vector3(FACE_WIDTH / 2, 0, 0)),
      );
      const top = projectModelPoint(
        FACE_CENTER.clone().add(new THREE.Vector3(0, FACE_HEIGHT / 2, 0)),
      );
      const bottom = projectModelPoint(
        FACE_CENTER.clone().add(new THREE.Vector3(0, -FACE_HEIGHT / 2, 0)),
      );
      if (!center || !left || !right || !top || !bottom || center.z > 1) {
        face.style.opacity = "0";
        return;
      }

      const width = Math.hypot(right.x - left.x, right.y - left.y);
      const height = Math.hypot(bottom.x - top.x, bottom.y - top.y);
      const angle = Math.atan2(right.y - left.y, right.x - left.x);

      face.style.width = `${width}px`;
      face.style.height = `${height}px`;
      face.style.opacity = "0.93";
      face.style.transform = `translate3d(${center.x - width / 2}px, ${
        center.y - height / 2
      }px, 0) rotate(${angle}rad)`;
    };

    const render = (): void => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const isWorking =
        state === "processing" || state === "typing" || state === "searching";
      const isCelebrating = state === "jackpot" || state === "job-done";
      const sway = isWorking ? 0.18 : 0.1;
      const pace = isWorking ? 1.75 : isCelebrating ? 2.3 : 0.82;

      if (model) {
        model.rotation.y =
          MODEL_FRONT_ROTATION + Math.sin(elapsed * pace) * sway;
        model.rotation.x = 0.02 + Math.sin(elapsed * pace * 0.7) * 0.025;
        model.position.y =
          -0.04 + Math.sin(elapsed * (isCelebrating ? 3.2 : 1.4)) * 0.035;
        modelRoot.rotation.z =
          state === "error" ? Math.sin(elapsed * 9) * 0.025 : 0;
        updateFaceProjection();
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (model) {
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry?.dispose();
          if (child.material) disposeMaterial(child.material);
        });
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [faceRef, hostRef, stateRef]);

  return { ready, failed };
}

export default function DesktopBuddyApp(): React.JSX.Element {
  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const initialProfile = searchParams.get("profile") || "default";
  const [buddyState, setBuddyState] = useState<MascotState>("default");
  const [profileLabel, setProfileLabel] = useState(initialProfile);
  const [voiceStatus, setVoiceStatus] = useState<BuddyVoiceStatus>("idle");
  const [controlsOpen, setControlsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MascotState>("default");
  const voiceStatusRef = useRef<BuddyVoiceStatus>("idle");
  const profileRef = useRef(initialProfile);
  const localPointerRef = useRef<{ x: number; y: number } | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef<number>(0);
  const voiceStatusTimerRef = useRef<number | null>(null);
  const { ready, failed } = useBuddyModel(canvasHostRef, stateRef, faceRef);

  useEffect(() => {
    stateRef.current = buddyState;
  }, [buddyState]);

  useEffect(() => {
    voiceStatusRef.current = voiceStatus;
  }, [voiceStatus]);

  useEffect(() => {
    document.documentElement.classList.add("desktop-buddy-mode");
    document.body.classList.add("desktop-buddy-mode");
    return () => {
      document.documentElement.classList.remove("desktop-buddy-mode");
      document.body.classList.remove("desktop-buddy-mode");
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.hermesAPI?.onDesktopBuddyState?.(
      (payload: BuddyStatePayload) => {
        setBuddyState(safeMascotState(payload.state));
        if (payload.label || payload.profile) {
          setProfileLabel(payload.label || payload.profile || "80M Agent");
        }
        if (payload.profile) {
          profileRef.current = payload.profile;
        }
      },
    );
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      localPointerRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timerId = 0;
    let eyeX = 0;
    let eyeY = 0;

    const setEyeOffset = (x: number, y: number): void => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty("--buddy-eye-x", `${x.toFixed(2)}px`);
      root.style.setProperty("--buddy-eye-y", `${y.toFixed(2)}px`);
    };

    const tick = async (): Promise<void> => {
      const shouldFollow =
        stateRef.current === "default" && voiceStatusRef.current === "idle";
      let targetX = 0;
      let targetY = 0;

      if (shouldFollow) {
        try {
          const payload = await window.hermesAPI?.getDesktopBuddyCursor?.();
          if (payload?.cursor && payload.bounds) {
            const { cursor, bounds } = payload;
            const focusX = bounds.x + bounds.width * 0.5;
            const focusY = bounds.y + bounds.height * 0.39;
            targetX =
              clamp((cursor.x - focusX) / (bounds.width * 0.48), -1, 1) * 15;
            targetY =
              clamp((cursor.y - focusY) / (bounds.height * 0.38), -1, 1) * 9.5;
          } else {
            const localPointer = localPointerRef.current;
            const root = rootRef.current;
            if (localPointer && root) {
              const rect = root.getBoundingClientRect();
              const focusX = rect.width * 0.5;
              const focusY = rect.height * 0.39;
              targetX =
                clamp((localPointer.x - focusX) / (rect.width * 0.55), -1, 1) *
                15;
              targetY =
                clamp((localPointer.y - focusY) / (rect.height * 0.44), -1, 1) *
                9.5;
            }
          }
        } catch {
          targetX = 0;
          targetY = 0;
        }
      }

      eyeX += (targetX - eyeX) * 0.36;
      eyeY += (targetY - eyeY) * 0.36;
      setEyeOffset(eyeX, eyeY);

      if (!cancelled) {
        timerId = window.setTimeout(() => void tick(), 80);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  const clearVoiceStatusTimer = (): void => {
    if (voiceStatusTimerRef.current !== null) {
      window.clearTimeout(voiceStatusTimerRef.current);
      voiceStatusTimerRef.current = null;
    }
  };

  const setTemporaryVoiceStatus = (status: BuddyVoiceStatus): void => {
    clearVoiceStatusTimer();
    setVoiceStatus(status);
    if (status === "sent" || status === "error") {
      voiceStatusTimerRef.current = window.setTimeout(() => {
        setVoiceStatus("idle");
        voiceStatusTimerRef.current = null;
      }, 1500);
    }
  };

  const stopRecording = (): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  };

  const startRecording = async (): Promise<void> => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setTemporaryVoiceStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      recordingStartRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;

        const duration = Date.now() - recordingStartRef.current;
        if (duration < 500 || audioChunksRef.current.length === 0) {
          setVoiceStatus("idle");
          return;
        }

        setVoiceStatus("transcribing");

        try {
          const blob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || mimeType,
          });
          const audioBuffer = await blob.arrayBuffer();
          const audioData = Array.from(new Uint8Array(audioBuffer));
          const transcript = await window.hermesAPI?.transcribeAudio?.(
            audioData,
            blob.type || "audio/webm",
          );
          const text = String(transcript || "").trim();
          if (!text) {
            setTemporaryVoiceStatus("error");
            return;
          }

          const sent = await window.hermesAPI?.sendDesktopBuddyTranscript?.({
            text,
            profile: profileRef.current,
            label: profileLabel,
            createdAt: Date.now(),
          });
          setTemporaryVoiceStatus(sent ? "sent" : "error");
        } catch (error) {
          console.error("Desktop buddy voice send failed", error);
          setTemporaryVoiceStatus("error");
        }
      };

      clearVoiceStatusTimer();
      mediaRecorder.start(100);
      setVoiceStatus("recording");
    } catch (error) {
      console.error("Desktop buddy mic unavailable", error);
      setTemporaryVoiceStatus("error");
    }
  };

  const handleMicToggle = (): void => {
    if (voiceStatus === "recording") {
      stopRecording();
      return;
    }
    if (voiceStatus === "transcribing") return;
    void startRecording();
  };

  useEffect(() => {
    return () => {
      clearVoiceStatusTimer();
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      if (recorder.state === "recording") {
        recorder.stop();
      } else {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleFocusMain = (): void => {
    void window.hermesAPI?.focusDesktopBuddyMain?.();
  };

  const handleClose = (): void => {
    void window.hermesAPI?.closeDesktopBuddy?.();
  };

  const dockExpanded = controlsOpen || voiceStatus !== "idle";

  const collapseDock = (): void => {
    if (voiceStatusRef.current === "idle") {
      setControlsOpen(false);
    }
  };

  const dockLabel =
    voiceStatus === "recording"
      ? "Listening"
      : voiceStatus === "transcribing"
        ? "Transcribing"
        : voiceStatus === "sent"
          ? "Sent"
          : voiceStatus === "error"
            ? "Try again"
            : profileLabel;
  const micTitle =
    voiceStatus === "recording"
      ? "Stop and send voice"
      : voiceStatus === "transcribing"
        ? "Transcribing voice"
        : "Record voice message";

  return (
    <div
      ref={rootRef}
      className={`desktop-buddy-root state-${buddyState} voice-${voiceStatus} ${
        buddyState === "default" && voiceStatus === "idle" ? "eye-idle" : ""
      }`}
    >
      <div className="desktop-buddy-drag-region" />
      <div className="desktop-buddy-aura" />
      <div className="desktop-buddy-stage" data-ready={ready}>
        <div ref={canvasHostRef} className="desktop-buddy-canvas" />
        <div
          ref={faceRef}
          className="desktop-buddy-screen-face"
          aria-hidden="true"
        >
          <div className="desktop-buddy-screen-face-source">
            <AtmMascot state={buddyState} />
          </div>
        </div>
        {!ready && !failed && <div className="desktop-buddy-loader" />}
        {failed && (
          <div className="desktop-buddy-fallback">
            <AtmMascot state={buddyState} />
          </div>
        )}
      </div>
      <div
        className={`desktop-buddy-dock ${dockExpanded ? "expanded" : ""}`}
        onMouseEnter={() => setControlsOpen(true)}
        onMouseLeave={collapseDock}
        onFocusCapture={() => setControlsOpen(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node)) {
            collapseDock();
            return;
          }
          if (!event.currentTarget.contains(nextTarget)) collapseDock();
        }}
      >
        <button
          type="button"
          className="desktop-buddy-control desktop-buddy-toggle"
          title={dockExpanded ? "Collapse controls" : "Open controls"}
          aria-label={dockExpanded ? "Collapse controls" : "Open controls"}
          aria-expanded={dockExpanded}
          onClick={() => setControlsOpen((open) => !open)}
        >
          <MoreHorizontal size={15} />
        </button>
        <div className="desktop-buddy-profile" title={profileLabel}>
          {dockLabel}
        </div>
        <div className="desktop-buddy-controls">
          <button
            type="button"
            className="desktop-buddy-control"
            title="Open main chat"
            aria-label="Open main chat"
            tabIndex={dockExpanded ? 0 : -1}
            onClick={handleFocusMain}
          >
            <MessageCircle size={14} />
          </button>
          <button
            type="button"
            className={`desktop-buddy-control desktop-buddy-mic ${voiceStatus}`}
            title={micTitle}
            aria-label={micTitle}
            aria-pressed={voiceStatus === "recording"}
            disabled={voiceStatus === "transcribing"}
            tabIndex={dockExpanded ? 0 : -1}
            onClick={handleMicToggle}
          >
            {voiceStatus === "recording" ? (
              <Square size={12} fill="currentColor" strokeWidth={1.5} />
            ) : (
              <Mic size={14} />
            )}
          </button>
          <button
            type="button"
            className="desktop-buddy-control"
            title="Close desktop buddy"
            aria-label="Close desktop buddy"
            tabIndex={dockExpanded ? 0 : -1}
            onClick={handleClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
