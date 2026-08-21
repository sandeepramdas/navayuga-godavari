/**
 * Cranes.ts — procedural tower cranes. Mast, slewing jib + counter-jib, cab,
 * hook cable with lag (one-euro-ish spring), and a wind flag. Jibs slew
 * continuously during the build beats; the fleet scales in at S4 and strikes
 * (scales out) after S7.
 */
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSteel } from './materials';
import type { BuildState } from './BuildState';

interface Crane {
  root: THREE.Group;
  slew: THREE.Group;
  hook: THREE.Mesh;
  cable: THREE.Mesh;
  flag: THREE.Mesh;
  phase: number;
  speed: number;
  hookT: number; // smoothed trolley position
}

// kept clear of the S5 gate-line truck (z≈165) and the S5→S6 camera sweep
const CRANE_POS: [number, number, number][] = [
  [-340, 0, -85],
  [60, 0, -90],
  [300, 0, -80],
];

export class Cranes {
  private cranes: Crane[] = [];
  private t = 0;

  constructor(scene: THREE.Scene) {
    const steel = makeSteel();
    const orange = new THREE.MeshStandardMaterial({ color: 0xe0641a, roughness: 0.5, metalness: 0.3 });

    for (let ci = 0; ci < CRANE_POS.length; ci++) {
      const root = new THREE.Group();
      root.position.set(...CRANE_POS[ci]);
      root.visible = false;
      scene.add(root);

      // mast — centre column with cross-brace impression
      const mastParts: THREE.BufferGeometry[] = [];
      const H = 92;
      const col = new THREE.BoxGeometry(2.6, H, 2.6);
      col.translate(0, H / 2, 0);
      mastParts.push(col);
      for (let y = 8; y < H; y += 12) {
        const brace = new THREE.BoxGeometry(4.6, 0.7, 4.6);
        brace.translate(0, y, 0);
        mastParts.push(brace);
      }
      const base = new THREE.BoxGeometry(10, 2.4, 10);
      base.translate(0, 1.2, 0);
      mastParts.push(base);
      const mast = new THREE.Mesh(BGU.mergeGeometries(mastParts), orange);
      mast.castShadow = true;
      root.add(mast);

      // slewing assembly
      const slew = new THREE.Group();
      slew.position.y = H;
      root.add(slew);

      const jibParts: THREE.BufferGeometry[] = [];
      const jib = new THREE.BoxGeometry(64, 1.6, 1.6);
      jib.translate(32, 1, 0);
      jibParts.push(jib);
      const cjib = new THREE.BoxGeometry(20, 1.8, 2.2);
      cjib.translate(-11, 1, 0);
      jibParts.push(cjib);
      const counterweight = new THREE.BoxGeometry(5, 4.5, 4);
      counterweight.translate(-19, 0, 0);
      jibParts.push(counterweight);
      const apex = new THREE.BoxGeometry(1.2, 12, 1.2);
      apex.translate(0, 6, 0);
      jibParts.push(apex);
      // tie bars
      const tie1 = new THREE.BoxGeometry(46, 0.4, 0.4);
      tie1.translate(23, 6.6, 0);
      tie1.rotateZ(-0.16);
      jibParts.push(tie1);
      const cab = new THREE.BoxGeometry(3.4, 3.2, 3.2);
      cab.translate(2.4, -1.4, 2.6);
      jibParts.push(cab);
      const jibMesh = new THREE.Mesh(BGU.mergeGeometries(jibParts), orange);
      jibMesh.castShadow = true;
      slew.add(jibMesh);

      // cable + hook
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 4), steel);
      slew.add(cable);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), steel);
      slew.add(hook);

      // wind flag on the apex
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 2.2, 6, 1),
        new THREE.MeshBasicMaterial({ color: 0xff6a13, side: THREE.DoubleSide })
      );
      flag.position.set(2, 11, 0);
      slew.add(flag);

      this.cranes.push({
        root, slew, hook, cable, flag,
        phase: ci * 2.1,
        speed: 0.14 + ci * 0.05,
        hookT: 30,
      });
    }
  }

  update(s: BuildState, dt: number): void {
    this.t += dt;
    const vis = s.cranes > 0.003;
    for (const c of this.cranes) {
      c.root.visible = vis;
      if (!vis) continue;
      const grow = 1 - Math.pow(1 - s.cranes, 3);
      c.root.scale.setScalar(Math.max(0.001, grow));
      c.slew.rotation.y = Math.sin(this.t * c.speed + c.phase) * 1.5 + c.phase;
      // trolley target wanders; hook follows with lag (spring)
      const target = 34 + Math.sin(this.t * 0.23 + c.phase * 1.7) * 22;
      c.hookT += (target - c.hookT) * Math.min(1, dt * 1.2);
      const drop = 26 + Math.sin(this.t * 0.31 + c.phase) * 14;
      c.hook.position.set(c.hookT, -drop, 0);
      c.cable.position.set(c.hookT, -drop / 2 + 1, 0);
      c.cable.scale.y = drop;
      // cable sway — follow-through behind slew motion
      c.cable.rotation.z = Math.sin(this.t * c.speed + c.phase + 1.2) * 0.05;
      // flag flutter
      c.flag.rotation.y = Math.PI / 2 + Math.sin(this.t * 6 + c.phase) * 0.22;
      c.flag.scale.y = 1 + Math.sin(this.t * 9 + c.phase) * 0.06;
    }
  }
}
