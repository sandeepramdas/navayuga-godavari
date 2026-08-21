/**
 * DiaphragmWall.ts — the S2 X-ray beat. Instanced wall panels drive down into
 * the riverbed one-by-one under a holographic treatment (emissive cyan, seen
 * through the translucent blueprint terrain). A setback flicker recalls the
 * 2019–20 flood damage before the panels re-seat.
 */
import * as THREE from 'three';
import { L } from './layout';
import type { BuildState } from './BuildState';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export class DiaphragmWall {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.MeshStandardMaterial;
  private last = { w: -1, sb: -1, xr: -1 };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene) {
    const panelW = (L.dwallHalfLen * 2) / L.dwallPanels;
    const geo = new THREE.BoxGeometry(panelW - 1.5, L.dwallDepth, 2.6);
    geo.translate(0, -L.dwallDepth / 2, 0); // origin at panel top
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x0e2f42,
      emissive: 0x39c6ff,
      emissiveIntensity: 0.55,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, L.dwallPanels);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(s: BuildState): void {
    if (s.wall === this.last.w && s.setback === this.last.sb && s.xray === this.last.xr) return;
    this.last.w = s.wall;
    this.last.sb = s.setback;
    this.last.xr = s.xray;

    this.mesh.visible = s.wall > 0.001 && s.xray > 0.02;
    this.mat.opacity = 0.85 * s.xray;
    this.mat.emissiveIntensity = 0.55 + 0.9 * s.setback;
    // flood-setback flicker: panels glow orange & shudder
    this.mat.emissive.setHex(s.setback > 0.35 ? 0xff6a13 : 0x39c6ff);
    if (!this.mesh.visible) return;

    const n = L.dwallPanels;
    const panelW = (L.dwallHalfLen * 2) / n;
    const K = 1.6; // strong sequencing — panel-by-panel
    for (let i = 0; i < n; i++) {
      const order = i / (n - 1);
      const p = THREE.MathUtils.clamp(s.wall * (1 + K) - order * K, 0, 1);
      const topY = THREE.MathUtils.lerp(26, 1.5, easeOutCubic(p));
      const shudder = s.setback * Math.sin(i * 12.9898) * 2.4 * s.setback;
      this.m.compose(
        this.v.set(-L.dwallHalfLen + panelW / 2 + i * panelW, topY + shudder, L.dwallZ),
        this.q.identity(),
        this.sc.set(1, Math.max(0.001, easeOutCubic(p)), 1)
      );
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
