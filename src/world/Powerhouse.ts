/**
 * Powerhouse.ts — ~960 MW station on the left bank: machine hall, intake block,
 * six penstocks running down the slope, transformer yard. Assembles bottom-up;
 * hall windows go emissive at golden hour.
 */
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from './layout';
import { makeConcrete, makeSteel } from './materials';
import type { BuildState } from './BuildState';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export class Powerhouse {
  private group: THREE.Group;
  private hall: THREE.Mesh;
  private intake: THREE.Mesh;
  private penstocks: THREE.Mesh;
  private yard: THREE.Mesh;
  private windowsMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.set(L.phX, 0, L.phZ);
    this.group.visible = false;
    scene.add(this.group);

    const concrete = makeConcrete({ liftHeight: 4, stain: 0.3, tint: 0xc6c1b8 });

    // foundation pad — keeps the station above the S8 tailwater
    const pad = new THREE.Mesh(new THREE.BoxGeometry(210, 16, 130), makeConcrete({ liftHeight: 8, stain: 0.6, tint: 0xa5a09a }));
    pad.position.y = 4; // −4 … +12
    this.group.add(pad);

    // everything else assembles on top of the pad
    const top = new THREE.Group();
    top.position.y = 12;
    this.group.add(top);

    // machine hall with window band
    const hallGeo = new THREE.BoxGeometry(150, 34, 52);
    hallGeo.translate(0, 17, 0);
    this.hall = new THREE.Mesh(hallGeo, concrete);
    this.hall.castShadow = true;
    top.add(this.hall);

    this.windowsMat = new THREE.MeshStandardMaterial({
      color: 0x1a2126,
      roughness: 0.2,
      metalness: 0.6,
      emissive: 0xffb45e,
      emissiveIntensity: 0,
    });
    const winGeo = new THREE.BoxGeometry(150.6, 5, 46);
    winGeo.translate(0, 25, 0);
    const windows = new THREE.Mesh(winGeo, this.windowsMat);
    this.hall.add(windows);

    // intake block upstream of the hall
    const intakeGeo = new THREE.BoxGeometry(120, 48, 26);
    intakeGeo.translate(0, 24, -66);
    this.intake = new THREE.Mesh(intakeGeo, concrete);
    this.intake.castShadow = true;
    top.add(this.intake);

    // six penstocks running from the intake crest down into the hall's upstream face
    const pens: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.CylinderGeometry(3.2, 3.2, 52, 12);
      p.rotateX(-0.62); // top leans upstream (−z) toward the intake
      p.translate(-50 + i * 20, 24, -42);
      pens.push(p);
    }
    this.penstocks = new THREE.Mesh(BGU.mergeGeometries(pens), makeSteel());
    this.penstocks.castShadow = true;
    top.add(this.penstocks);

    // transformer yard
    const yardParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.BoxGeometry(8, 7, 10);
      b.translate(-40 + i * 20, 3.5, 44);
      yardParts.push(b);
    }
    this.yard = new THREE.Mesh(BGU.mergeGeometries(yardParts), makeSteel());
    top.add(this.yard);
  }

  update(s: BuildState): void {
    this.group.visible = s.power > 0.001;
    if (!this.group.visible) return;
    const p = s.power;
    // staged assembly: intake → penstocks → hall → yard
    const stage = (a: number, b: number): number =>
      easeOutCubic(THREE.MathUtils.clamp((p - a) / (b - a), 0, 1));
    const sIntake = stage(0, 0.35);
    const sPen = stage(0.25, 0.6);
    const sHall = stage(0.45, 0.85);
    const sYard = stage(0.75, 1);
    this.intake.scale.y = Math.max(0.001, sIntake);
    this.penstocks.visible = sPen > 0.01;
    this.penstocks.scale.setScalar(Math.max(0.001, sPen));
    this.penstocks.position.y = (1 - sPen) * 10;
    this.hall.scale.y = Math.max(0.001, sHall);
    this.hall.visible = sHall > 0.01;
    this.yard.visible = sYard > 0.01;
    this.yard.scale.y = Math.max(0.001, sYard);
    // windows warm up with golden hour
    this.windowsMat.emissiveIntensity = s.golden * 1.6 * (sHall > 0.9 ? 1 : 0);
  }
}
