/**
 * ECRFDam.ts — the earth-cum-rock-fill dam closing the main gap, built in
 * visible lifts via an animated clipping plane. Zoned shading (rock shells /
 * clay core / riprap crown) comes from the rockfill shader; the core is a
 * second inner mesh so the zoning reads while the dam is still low.
 */
import * as THREE from 'three';
import { L } from './layout';
import { makeRockfill } from './materials';
import type { BuildState } from './BuildState';

export class ECRFDam {
  private shell: THREE.Mesh;
  private core: THREE.Mesh;
  private clip: THREE.Plane;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    renderer.localClippingEnabled = true;
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // keeps y < constant

    const len = L.ecrfEndX - L.ecrfStartX;
    const mkTrap = (h: number, crestHalf: number, baseHalf: number): THREE.BufferGeometry => {
      const shp = new THREE.Shape();
      shp.moveTo(-baseHalf, -4);
      shp.lineTo(-crestHalf, h);
      shp.lineTo(crestHalf, h);
      shp.lineTo(baseHalf, -4);
      shp.lineTo(-baseHalf, -4);
      const g = new THREE.ExtrudeGeometry(shp, { depth: len, bevelEnabled: false, steps: 1 });
      g.rotateY(Math.PI / 2);
      g.scale(1, 1, -1);
      g.translate(L.ecrfStartX, 0, 0);
      g.computeVertexNormals();
      return g;
    };

    const shellMat = makeRockfill(false);
    shellMat.clippingPlanes = [this.clip];
    this.shell = new THREE.Mesh(mkTrap(L.ecrfHeight, L.ecrfCrestWidth / 2, L.ecrfBaseHalf), shellMat);
    this.shell.castShadow = true;
    this.shell.visible = false;
    scene.add(this.shell);

    const coreMat = makeRockfill(true);
    coreMat.clippingPlanes = [this.clip];
    this.core = new THREE.Mesh(mkTrap(L.ecrfHeight - 1.5, 4, 18), coreMat);
    this.core.position.x = 0.2;
    this.core.visible = false;
    scene.add(this.core);
  }

  update(s: BuildState): void {
    const on = s.ecrf > 0.001;
    this.shell.visible = on;
    this.core.visible = on;
    if (!on) return;
    // clipping constant rises from base −4 to crest + margin, stepped into lifts
    const raw = THREE.MathUtils.lerp(-4, L.ecrfHeight + 2, s.ecrf);
    const liftH = 4;
    const stepped = Math.floor(raw / liftH) * liftH + Math.min(liftH, Math.max(0, (raw % liftH) * 1.6));
    this.clip.constant = stepped;
  }
}
