import * as THREE from "three";
import type { GraphEdge } from "./neuralMap3dTypes";

export function sphericalPos(i: number, n: number, r: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) * 0.7,
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export function forceLayout(
  nodes: { id: string; x: number; y: number; z: number }[],
  edges: GraphEdge[],
  iterations: number,
): void {
  const idxMap = new Map<string, number>();
  nodes.forEach((n, i) => idxMap.set(n.id, i));
  const k = 2.5;
  for (let iter = 0; iter < iterations; iter++) {
    const temp = 0.3 * (1 - iter / iterations);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
        const force = ((k * k) / dist) * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        nodes[i].x += fx;
        nodes[i].y += fy;
        nodes[i].z += fz;
        nodes[j].x -= fx;
        nodes[j].y -= fy;
        nodes[j].z -= fz;
      }
    }
    for (const edge of edges) {
      const si = idxMap.get(edge.source);
      const ti = idxMap.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dz = nodes[ti].z - nodes[si].z;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
      const force = (dist / k) * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      nodes[si].x += fx;
      nodes[si].y += fy;
      nodes[si].z += fz;
      nodes[ti].x -= fx;
      nodes[ti].y -= fy;
      nodes[ti].z -= fz;
    }
  }
}
