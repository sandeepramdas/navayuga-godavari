/**
 * Cofferdams.ts — upper & lower rockfill embankments rising across the river
 * to seal the work area. Trapezoid cross-section extruded along X; growth via
 * y-scale from the base (reads as placed fill), upper leads lower.
 */
import * as THREE from 'three';
import { L } from './layout';
import { makeRockfill } from './materials';
import type { BuildState } from './BuildState';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function makeEmbankment(length: number, height: number, crest: number, baseHalf: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-baseHalf, 0);
  shape.lineTo(-crest / 2, height);
  shape.lineTo(crest / 2, height);
  shape.lineTo(baseHalf, 0);
  shape.lineTo(-baseHalf, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
  geo.rotateY(Math.PI / 2);
  geo.scale(1, 1, -1);
  geo.translate(-length / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

export class Cofferdams {
  private upper: THREE.Mesh;
  private lower: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const mat = makeRockfill();
    this.upper = new THREE.Mesh(
      makeEmbankment(L.cofferHalfLenX * 2, L.cofferHeight, 8, 44),
      mat
    );
    this.upper.position.set(0, -2, L.cofferUpZ);
    this.upper.scale.y = 0.001;
    this.upper.visible = false;
    this.upper.castShadow = true;
    scene.add(this.upper);

    this.lower = new THREE.Mesh(
      makeEmbankment(L.cofferHalfLenX * 2, L.cofferHeight * 0.72, 7, 34),
      mat
    );
    this.lower.position.set(0, -2, L.cofferDownZ);
    this.lower.scale.y = 0.001;
    this.lower.visible = false;
    this.lower.castShadow = true;
    scene.add(this.lower);
  }

  update(s: BuildState): void {
    const upP = easeOutCubic(Math.min(1, s.coffer * 1.35));
    // the lower cofferdam is breached/removed ahead of the S8 release
    const removal = THREE.MathUtils.smoothstep(s.flood, 0.02, 0.3);
    const loP = easeOutCubic(THREE.MathUtils.clamp(s.coffer * 1.35 - 0.35, 0, 1)) * (1 - removal);
    this.upper.visible = upP > 0.002;
    this.lower.visible = loP > 0.002;
    this.upper.scale.y = Math.max(0.001, upP);
    this.lower.scale.y = Math.max(0.001, loP);
  }
}
