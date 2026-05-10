import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

interface NeuralNode3D {
  id: string;
  label: string;
  value: number;
}
interface GraphNote {
  id: string;
  path: string;
  name: string;
  relativePath: string;
  linkCount: number;
}
interface GraphEdge {
  source: string;
  target: string;
}

interface NeuralMap3DProps {
  nodes: NeuralNode3D[];
  activeId: string;
  onSelect: (id: string) => void;
  scanning: boolean;
  vaultConnected: boolean;
  totalNotes: number;
  mode?: "cluster" | "graph";
  graphNotes?: GraphNote[];
  graphEdges?: GraphEdge[];
  graphSearch?: string;
  onNoteSelect?: (path: string) => void;
}

const GREEN = new THREE.Color(0x4ade80);
const GREEN_DIM = new THREE.Color(0x22c55e);
const GREEN_DARK = new THREE.Color(0x166534);
const BG = new THREE.Color(0x030a06);
const MAX_GRAPH_NODES = 180;

function sphericalPos(i: number, n: number, r: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) * 0.7,
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* Simple force-directed layout — runs synchronously for N iterations */
function forceLayout(
  nodes: { id: string; x: number; y: number; z: number }[],
  edges: GraphEdge[],
  iterations: number,
): void {
  const idxMap = new Map<string, number>();
  nodes.forEach((n, i) => idxMap.set(n.id, i));
  const k = 2.5; // ideal distance
  for (let iter = 0; iter < iterations; iter++) {
    const temp = 0.3 * (1 - iter / iterations);
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x,
          dy = nodes[i].y - nodes[j].y,
          dz = nodes[i].z - nodes[j].z;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
        const force = ((k * k) / dist) * temp;
        const fx = (dx / dist) * force,
          fy = (dy / dist) * force,
          fz = (dz / dist) * force;
        nodes[i].x += fx;
        nodes[i].y += fy;
        nodes[i].z += fz;
        nodes[j].x -= fx;
        nodes[j].y -= fy;
        nodes[j].z -= fz;
      }
    }
    // attraction along edges
    for (const e of edges) {
      const si = idxMap.get(e.source),
        ti = idxMap.get(e.target);
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x,
        dy = nodes[ti].y - nodes[si].y,
        dz = nodes[ti].z - nodes[si].z;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
      const force = (dist / k) * temp;
      const fx = (dx / dist) * force,
        fy = (dy / dist) * force,
        fz = (dz / dist) * force;
      nodes[si].x += fx;
      nodes[si].y += fy;
      nodes[si].z += fz;
      nodes[ti].x -= fx;
      nodes[ti].y -= fy;
      nodes[ti].z -= fz;
    }
  }
}

export default function NeuralMap3D(
  props: NeuralMap3DProps,
): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(props);
  const sceneRef = useRef<{
    cleanup: () => void;
    rebuildGraph: () => void;
  } | null>(null);
  const prevModeRef = useRef(props.mode);

  useEffect(() => {
    stateRef.current = props;
  }, [props]);

  // Rebuild scene when mode changes
  useEffect(() => {
    if (prevModeRef.current !== props.mode) {
      prevModeRef.current = props.mode;
      if (sceneRef.current) {
        sceneRef.current.cleanup();
        sceneRef.current = null;
      }
    }
  }, [props.mode]);

  const initScene = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // clean previous
    if (sceneRef.current) {
      sceneRef.current.cleanup();
      sceneRef.current = null;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = BG;
    scene.fog = new THREE.FogExp2(0x030a06, 0.04);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(0, 3, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 50;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.4,
      0.6,
      0.3,
    );
    composer.addPass(bloom);

    scene.add(new THREE.AmbientLight(0x4ade80, 0.15));
    const centerLight = new THREE.PointLight(0x4ade80, 2.5, 20);
    scene.add(centerLight);

    // Ambient dust
    const dustCount = 400;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustVel = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 30;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      dustVel[i * 3] = (Math.random() - 0.5) * 0.003;
      dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustCloud = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: GREEN,
        size: 0.035,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(dustCloud);

    // Labels container
    const labelContainer = document.createElement("div");
    labelContainer.className = "neural-3d-labels";
    container.appendChild(labelContainer);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.5 };
    const mouse = new THREE.Vector2(-10, -10);
    let hoveredId: string | null = null;
    const raycasterTargets: THREE.Mesh[] = [];

    interface SceneNode {
      mesh: THREE.Mesh;
      glow: THREE.Mesh;
      pos: THREE.Vector3;
      id: string;
      label: string;
      path?: string;
    }
    const sceneNodes: SceneNode[] = [];
    const clusterBeams: THREE.Line[] = []; // 1:1 with sceneNodes in cluster mode
    const graphWebLines: THREE.Line[] = []; // web connections in graph mode
    interface LabelEl {
      el: HTMLDivElement;
      pos: THREE.Vector3;
      id: string;
    }
    const labels: LabelEl[] = [];

    // Center brain (shared)
    const centerGeo = new THREE.IcosahedronGeometry(1.1, 3);
    const centerMat = new THREE.MeshPhysicalMaterial({
      color: GREEN_DARK,
      emissive: GREEN,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.18,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    scene.add(centerMesh);
    const wireGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const wireMesh = new THREE.Mesh(
      wireGeo,
      new THREE.MeshBasicMaterial({
        color: GREEN,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      }),
    );
    scene.add(wireMesh);
    // inner cloud
    const ipGeo = new THREE.BufferGeometry();
    const ipPos = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      const r = Math.random() * 0.9,
        t = Math.random() * Math.PI * 2,
        p = Math.acos(2 * Math.random() - 1);
      ipPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      ipPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      ipPos[i * 3 + 2] = r * Math.cos(p);
    }
    ipGeo.setAttribute("position", new THREE.BufferAttribute(ipPos, 3));
    const innerCloud = new THREE.Points(
      ipGeo,
      new THREE.PointsMaterial({
        color: GREEN,
        size: 0.04,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(innerCloud);

    const centerLabel = document.createElement("div");
    centerLabel.className = "neural-3d-label neural-3d-label-center";
    centerLabel.innerHTML = "SECOND<br/>BRAIN";
    labelContainer.appendChild(centerLabel);

    function buildNodes(): void {
      // Clear old
      for (const n of sceneNodes) {
        scene.remove(n.mesh);
        scene.remove(n.glow);
        n.mesh.geometry.dispose();
        (n.mesh.material as THREE.Material).dispose();
        n.glow.geometry.dispose();
        (n.glow.material as THREE.Material).dispose();
      }
      sceneNodes.length = 0;
      raycasterTargets.length = 0;
      for (const l of clusterBeams) {
        scene.remove(l);
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
      clusterBeams.length = 0;
      for (const l of graphWebLines) {
        scene.remove(l);
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
      graphWebLines.length = 0;
      for (const lb of labels) lb.el.remove();
      labels.length = 0;

      const state = stateRef.current;
      const isGraph = state.mode === "graph";

      if (isGraph && state.graphNotes && state.graphNotes.length > 0) {
        // ═══ GRAPH MODE ═══
        const notes = state.graphNotes.slice(0, MAX_GRAPH_NODES);
        const noteIdSet = new Set(notes.map((n) => n.id));
        const edges = (state.graphEdges || []).filter(
          (e) => noteIdSet.has(e.source) && noteIdSet.has(e.target),
        );

        // Force layout
        const layoutNodes = notes.map((n, i) => {
          const angle = (i / notes.length) * Math.PI * 2;
          const r = 4 + Math.random() * 4;
          return {
            id: n.id,
            x: Math.cos(angle) * r,
            y: (Math.random() - 0.5) * 4,
            z: Math.sin(angle) * r,
          };
        });
        forceLayout(layoutNodes, edges, 80);
        const posMap = new Map(
          layoutNodes.map((n) => [n.id, new THREE.Vector3(n.x, n.y, n.z)]),
        );

        // Create node meshes
        for (const note of notes) {
          const pos = posMap.get(note.id) || new THREE.Vector3();
          const radius = 0.25 + Math.min(note.linkCount * 0.08, 0.5);
          const geo = new THREE.IcosahedronGeometry(radius, 2);
          const mat = new THREE.MeshPhysicalMaterial({
            color: GREEN_DARK,
            emissive: GREEN_DIM,
            emissiveIntensity: note.linkCount > 0 ? 0.45 : 0.2,
            transparent: true,
            opacity: note.linkCount > 0 ? 0.75 : 0.5,
            roughness: 0.4,
            metalness: 0.15,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          mesh.userData = { nodeId: note.id, notePath: note.path };
          scene.add(mesh);
          raycasterTargets.push(mesh);

          const glowGeo = new THREE.SphereGeometry(radius * 2.8, 12, 12);
          const glowMat = new THREE.MeshBasicMaterial({
            color: GREEN,
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.copy(pos);
          scene.add(glow);

          // Per-node point light for visibility
          const nl = new THREE.PointLight(0x4ade80, 0.3, 3);
          nl.position.copy(pos);
          scene.add(nl);

          sceneNodes.push({
            mesh,
            glow,
            pos,
            id: note.id,
            label: note.name.replace(/\.(md|markdown)$/i, ""),
            path: note.path,
          });

          const el = document.createElement("div");
          el.className = "neural-3d-label neural-3d-label-clickable";
          el.textContent = note.name
            .replace(/\.(md|markdown)$/i, "")
            .slice(0, 24);
          el.dataset.noteId = note.id;
          el.dataset.notePath = note.path;
          labelContainer.appendChild(el);
          labels.push({ el, pos, id: note.id });
        }

        // Web connections between notes — much more visible
        for (const edge of edges) {
          const sp = posMap.get(edge.source),
            tp = posMap.get(edge.target);
          if (!sp || !tp) continue;
          const lineGeo = new THREE.BufferGeometry().setFromPoints([sp, tp]);
          const lineMat = new THREE.LineBasicMaterial({
            color: GREEN,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          scene.add(line);
          graphWebLines.push(line);
        }

        // Zoom camera out for large graphs
        if (notes.length > 50) camera.position.set(0, 5, 18);
        else camera.position.set(0, 3, 12);
      } else {
        // ═══ CLUSTER MODE ═══
        const clusterNodes = state.nodes;
        const count = clusterNodes.length;
        clusterNodes.forEach((node, i) => {
          const pos = sphericalPos(i, count, 5.2);
          const geo = new THREE.IcosahedronGeometry(0.38, 2);
          const mat = new THREE.MeshPhysicalMaterial({
            color: GREEN_DARK,
            emissive: GREEN_DIM,
            emissiveIntensity: node.value > 0 ? 0.35 : 0.08,
            transparent: true,
            opacity: node.value > 0 ? 0.65 : 0.25,
            roughness: 0.4,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          mesh.userData = { nodeId: node.id };
          scene.add(mesh);
          raycasterTargets.push(mesh);

          const glowGeo = new THREE.SphereGeometry(0.38 * 2.2, 16, 16);
          const glowMat = new THREE.MeshBasicMaterial({
            color: GREEN,
            transparent: true,
            opacity: 0.06,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.copy(pos);
          scene.add(glow);

          const nl = new THREE.PointLight(0x4ade80, 0.4, 4);
          nl.position.copy(pos);
          scene.add(nl);

          sceneNodes.push({ mesh, glow, pos, id: node.id, label: node.label });

          // beam to center
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            pos,
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: GREEN,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          scene.add(line);
          clusterBeams.push(line);

          const el = document.createElement("div");
          el.className = "neural-3d-label";
          el.textContent = node.label;
          labelContainer.appendChild(el);
          labels.push({ el, pos, id: node.id });
        });
        camera.position.set(0, 3, 10);
      }
    }

    buildNodes();

    // Handle label clicks (for graph mode clickable labels)
    function onLabelClick(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.dataset.noteId) return;
      e.stopPropagation();
      selectGraphNode(target.dataset.noteId);
    }
    labelContainer.addEventListener("click", onLabelClick);

    // Event handlers
    let selectedGraphId: string | null = null;
    let lastSearchApplied = "";

    function onPointerMove(e: PointerEvent): void {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function selectGraphNode(id: string): void {
      const state = stateRef.current;
      const node = sceneNodes.find((n) => n.id === id);
      if (state.mode === "graph" && node?.path && state.onNoteSelect) {
        selectedGraphId = id;
        state.onNoteSelect(node.path);
      } else {
        state.onSelect(id);
      }
    }

    function onClick(e: MouseEvent): void {
      const state = stateRef.current;
      // Fresh raycast at click time — don't rely on animation loop's hoveredId
      const rect = renderer.domElement.getBoundingClientRect();
      const clickMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(clickMouse, camera);
      const hits = raycaster.intersectObjects(raycasterTargets);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.nodeId as string;
        selectGraphNode(hitId);
        return;
      }
      // Check center brain
      const cHits = raycaster.intersectObject(centerMesh);
      if (cHits.length > 0) {
        state.onSelect("notes");
      }
    }

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.style.cursor = "grab";

    const clock = new THREE.Clock();
    let animId = 0;
    let lastGraphKey = "";

    function animate(): void {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const state = stateRef.current;
      const isScanning = state.scanning;
      const search = (state.graphSearch || "").toLowerCase();
      const isGraph = state.mode === "graph";

      // Check if graph data changed — rebuild if needed
      const graphKey = isGraph
        ? `${(state.graphNotes || []).length}:${(state.graphEdges || []).length}`
        : `c:${state.nodes.length}`;
      if (graphKey !== lastGraphKey) {
        lastGraphKey = graphKey;
        selectedGraphId = null;
        buildNodes();
      }

      // Search auto-select: when search text changes, select first matching note
      if (isGraph && search && search !== lastSearchApplied) {
        lastSearchApplied = search;
        const match = sceneNodes.find((n) =>
          n.label.toLowerCase().includes(search),
        );
        if (match?.path) {
          selectedGraphId = match.id;
          if (state.onNoteSelect) state.onNoteSelect(match.path);
        }
      } else if (!search && lastSearchApplied) {
        lastSearchApplied = "";
      }

      controls.autoRotateSpeed = isScanning ? 2.0 : 0.4;
      controls.update();

      // Center brain
      const breath = 1 + Math.sin(t * 1.2) * 0.06;
      centerMesh.scale.setScalar(breath);
      wireMesh.rotation.y = t * 0.15;
      wireMesh.rotation.x = t * 0.08;
      wireMesh.scale.setScalar(breath);
      centerLight.intensity = 2 + Math.sin(t * 1.5) * 0.8;
      innerCloud.rotation.y = t * 0.2;
      innerCloud.rotation.x = t * 0.1;

      // Raycasting for hover cursor
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycasterTargets);
      hoveredId = null;

      sceneNodes.forEach((entry, i) => {
        const isHit =
          intersects.length > 0 && intersects[0].object === entry.mesh;
        const mat = entry.mesh.material as THREE.MeshPhysicalMaterial;
        const glowMat = entry.glow.material as THREE.MeshBasicMaterial;

        // Search dimming (graph mode)
        const matchesSearch =
          !search || entry.label.toLowerCase().includes(search);
        const searchDim = isGraph && search && !matchesSearch;

        // Active state
        let isActive = false;
        if (isGraph) {
          isActive = entry.id === selectedGraphId || isHit;
        } else {
          isActive = entry.id === state.activeId;
        }

        if (isHit) {
          hoveredId = entry.id;
          renderer.domElement.style.cursor = "pointer";
        }

        const tgtEmissive = searchDim
          ? 0.03
          : isActive
            ? 0.7
            : isHit
              ? 0.5
              : 0.2;
        const tgtOpacity = searchDim ? 0.1 : isActive ? 0.9 : isHit ? 0.8 : 0.5;
        const tgtScale = isActive ? 1.35 : isHit ? 1.2 : 1.0;
        const tgtGlow = searchDim
          ? 0.01
          : isActive
            ? 0.18
            : isHit
              ? 0.12
              : 0.04;

        mat.emissiveIntensity += (tgtEmissive - mat.emissiveIntensity) * 0.08;
        mat.opacity += (tgtOpacity - mat.opacity) * 0.08;
        glowMat.opacity += (tgtGlow - glowMat.opacity) * 0.08;
        entry.mesh.scale.lerp(
          new THREE.Vector3(tgtScale, tgtScale, tgtScale),
          0.08,
        );
        entry.glow.scale.lerp(
          new THREE.Vector3(tgtScale, tgtScale, tgtScale),
          0.06,
        );

        // Cluster beam lines (1:1 with nodes in cluster mode)
        if (!isGraph && i < clusterBeams.length) {
          const lm = clusterBeams[i].material as THREE.LineBasicMaterial;
          const tgtLine = isActive ? 0.5 : isHit ? 0.3 : 0.08;
          lm.opacity += (tgtLine - lm.opacity) * 0.1;
        }
      });

      if (!hoveredId) renderer.domElement.style.cursor = "grab";

      // Dust
      const posAttr = dustCloud.geometry.getAttribute("position");
      const arr = posAttr.array as Float32Array;
      const sm = isScanning ? 5 : 1;
      for (let i = 0; i < dustCount; i++) {
        arr[i * 3] += dustVel[i * 3] * sm;
        arr[i * 3 + 1] += dustVel[i * 3 + 1] * sm;
        arr[i * 3 + 2] += dustVel[i * 3 + 2] * sm;
        if (Math.abs(arr[i * 3]) > 15) arr[i * 3] *= -0.9;
        if (Math.abs(arr[i * 3 + 1]) > 10) arr[i * 3 + 1] *= -0.9;
        if (Math.abs(arr[i * 3 + 2]) > 15) arr[i * 3 + 2] *= -0.9;
        if (isScanning) {
          arr[i * 3] *= 0.998;
          arr[i * 3 + 1] *= 0.998;
          arr[i * 3 + 2] *= 0.998;
        }
      }
      posAttr.needsUpdate = true;

      // Labels
      const el = containerRef.current;
      if (!el) return;
      const hw = el.clientWidth / 2,
        hh = el.clientHeight / 2;
      labels.forEach((lbl) => {
        const p = lbl.pos.clone().project(camera);
        lbl.el.style.transform = `translate(-50%,-50%) translate(${p.x * hw + hw}px,${-(p.y * hh) + hh}px)`;
        const behind = p.z > 1;
        const searchMatch =
          !search || lbl.el.textContent!.toLowerCase().includes(search);
        const isSelected = isGraph && lbl.id === selectedGraphId;
        lbl.el.style.opacity = behind
          ? "0"
          : isGraph && search && !searchMatch
            ? "0.1"
            : isSelected
              ? "1"
              : "0.7";
        lbl.el.classList.toggle(
          "active",
          isGraph ? isSelected : lbl.id === state.activeId,
        );
      });
      const cp = new THREE.Vector3(0, 0, 0).project(camera);
      centerLabel.style.transform = `translate(-50%,-50%) translate(${cp.x * hw + hw}px,${-(cp.y * hh) + hh}px)`;
      centerLabel.style.opacity = cp.z > 1 ? "0" : "1";

      bloom.strength = isScanning ? 2.0 : 1.4;
      composer.render();
    }
    animate();

    function onResize(): void {
      const c = containerRef.current;
      if (!c) return;
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(c.clientWidth, c.clientHeight);
      composer.setSize(c.clientWidth, c.clientHeight);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    function cleanup(): void {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      labelContainer.removeEventListener("click", onLabelClick);
      controls.dispose();
      renderer.dispose();
      composer.dispose();
      labelContainer.remove();
      if (renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Line ||
          obj instanceof THREE.Points
        ) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    sceneRef.current = { cleanup, rebuildGraph: buildNodes };
    return cleanup;
  }, []);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  return (
    <div
      ref={containerRef}
      className="neural-3d-container"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    />
  );
}
