import type * as THREE from "three";

export interface NeuralNode3D {
  id: string;
  label: string;
  value: number;
}

export interface GraphNote {
  id: string;
  path: string;
  name: string;
  relativePath: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface NeuralMap3DProps {
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

export interface SceneNode {
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  pos: THREE.Vector3;
  id: string;
  label: string;
  path?: string;
}

export interface LabelEl {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  id: string;
}
