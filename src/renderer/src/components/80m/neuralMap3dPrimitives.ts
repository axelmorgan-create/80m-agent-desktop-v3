import * as THREE from "three";

export const GREEN = new THREE.Color(0x4ade80);
export const GREEN_DIM = new THREE.Color(0x22c55e);
export const GREEN_DARK = new THREE.Color(0x166534);
export const BG = new THREE.Color(0x030a06);
export const MAX_GRAPH_NODES = 180;

export interface NeuralDust {
  cloud: THREE.Points;
  velocities: Float32Array;
  count: number;
}

export interface NeuralCenter {
  centerMesh: THREE.Mesh;
  wireMesh: THREE.Mesh;
  innerCloud: THREE.Points;
  centerLight: THREE.PointLight;
}

export function createNeuralDust(count = 400): NeuralDust {
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 30;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    velocities[i * 3] = (Math.random() - 0.5) * 0.003;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  return {
    cloud: new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: GREEN,
        size: 0.035,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
    velocities,
    count,
  };
}

export function createNeuralCenter(): NeuralCenter {
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
  const ipGeo = new THREE.BufferGeometry();
  const ipPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    const r = Math.random() * 0.9;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
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

  return {
    centerMesh,
    wireMesh,
    innerCloud,
    centerLight: new THREE.PointLight(0x4ade80, 2.5, 20),
  };
}
