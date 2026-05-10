import * as THREE from "three";
import type { LabelEl, SceneNode } from "./neuralMap3dTypes";

export function clearNeuralMapNodes(
  scene: THREE.Scene,
  sceneNodes: SceneNode[],
  raycasterTargets: THREE.Mesh[],
  clusterBeams: THREE.Line[],
  graphWebLines: THREE.Line[],
  labels: LabelEl[],
): void {
  for (const node of sceneNodes) {
    scene.remove(node.mesh);
    scene.remove(node.glow);
    node.mesh.geometry.dispose();
    (node.mesh.material as THREE.Material).dispose();
    node.glow.geometry.dispose();
    (node.glow.material as THREE.Material).dispose();
  }
  sceneNodes.length = 0;
  raycasterTargets.length = 0;

  for (const line of clusterBeams) {
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }
  clusterBeams.length = 0;

  for (const line of graphWebLines) {
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }
  graphWebLines.length = 0;

  for (const label of labels) label.el.remove();
  labels.length = 0;
}
