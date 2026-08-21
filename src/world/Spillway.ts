/**
 * Spillway.ts — 49 instanced concrete piers (staggered rise from the banks
 * inward), ogee crest weir, stilling-basin apron, deck + hoist portals.
 * One draw call per element family.
 */
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from './layout';
import { makeConcrete, makeSteel } from './materials';
import type { BuildState } from './BuildState';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export class Spillway {
  readonly piers: THREE.InstancedMesh;
  private crest: THREE.Mesh;
  private apron: THREE.Mesh;
  private deck: THREE.Mesh;
  private portals: THREE.InstancedMesh;
  private pierCount = L.bayCount + 1;
  private lastPiers = -1;
  private lastDeck = -1;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene) {
    const concrete = makeConcrete({ liftHeight: 3, stain: 0.5 });

    // --- pier: stem + rounded cutwater nose + downstream taper
    const stem = new THREE.BoxGeometry(L.pierThickness, L.pierHeight, L.pierLength);
    stem.translate(0, L.pierHeight / 2, 0);
    const nose = new THREE.CylinderGeometry(L.pierThickness / 2, L.pierThickness / 2, L.pierHeight, 12);
    nose.translate(0, L.pierHeight / 2, -L.pierLength / 2);
    const hoistBlock = new THREE.BoxGeometry(L.pierThickness + 1.6, 5, 10);
    hoistBlock.translate(0, L.pierHeight + 2.5, 6);
    const pierGeo = BGU.mergeGeometries([stem, nose, hoistBlock]);
    this.piers = new THREE.InstancedMesh(pierGeo, concrete, this.pierCount);
    this.piers.castShadow = true;
    this.piers.receiveShadow = true;
    this.piers.visible = false;
    this.piers.frustumCulled = false; // instances animated in Y; cheap enough to always draw
    scene.add(this.piers);

    // --- ogee crest weir (profile in (z,y), extruded along X)
    // flat apex plateau z∈[−3, +7] at sill level so the radial gates seat on it
    const shape = new THREE.Shape();
    shape.moveTo(-10, 0);
    shape.lineTo(-10, L.sillY - 3.5);
    shape.quadraticCurveTo(-8, L.sillY, -3, L.sillY);
    shape.lineTo(7, L.sillY);
    shape.quadraticCurveTo(13, L.sillY - 2, 16, L.sillY - 9);
    shape.quadraticCurveTo(19, L.sillY - 15, 24, 0);
    shape.lineTo(-10, 0);
    const crestGeo = new THREE.ExtrudeGeometry(shape, { depth: L.spillwayWidth, bevelEnabled: false, steps: 1 });
    // shape plane is (x=zProfile, y=height), extrusion along +z → rotate so extrusion runs along +X
    crestGeo.rotateY(Math.PI / 2); // x' = depthAxis, z' = -profileAxis
    crestGeo.scale(1, 1, -1);
    crestGeo.translate(L.spillwayLeft, 0, 0);
    crestGeo.computeVertexNormals();
    this.crest = new THREE.Mesh(crestGeo, makeConcrete({ liftHeight: 2.4, stain: 0.35, tint: 0xc2bdb4 }));
    this.crest.visible = false;
    scene.add(this.crest);

    // --- stilling-basin apron
    const apronGeo = new THREE.BoxGeometry(L.spillwayWidth + 20, 2.4, 110);
    this.apron = new THREE.Mesh(apronGeo, makeConcrete({ liftHeight: 10, stain: 0.6, tint: 0xa8a49c }));
    this.apron.position.set(0, -3, 70);
    this.apron.visible = false;
    scene.add(this.apron);

    // --- deck / road bridge
    const deckGeo = new THREE.BoxGeometry(L.spillwayWidth + 46, L.deckThickness, 11);
    this.deck = new THREE.Mesh(deckGeo, makeConcrete({ liftHeight: 100, stain: 0.15, tint: 0xcac5bc }));
    this.deck.position.set(0, L.deckY + 60, 4);
    this.deck.castShadow = true;
    this.deck.visible = false;
    scene.add(this.deck);

    // --- hoist portal frames every 4 bays
    const steel = makeSteel();
    const leg = new THREE.BoxGeometry(1.1, 9, 1.1);
    const legA = leg.clone(); legA.translate(-5, 4.5, 0);
    const legB = leg.clone(); legB.translate(5, 4.5, 0);
    const beam = new THREE.BoxGeometry(12, 1.3, 1.3); beam.translate(0, 9, 0);
    const brace = new THREE.BoxGeometry(12, 0.6, 0.6); brace.translate(0, 5.5, 0);
    const portalGeo = BGU.mergeGeometries([legA, legB, beam, brace]);
    const portalCount = 13;
    this.portals = new THREE.InstancedMesh(portalGeo, steel, portalCount);
    for (let i = 0; i < portalCount; i++) {
      const x = L.spillwayLeft + (i / (portalCount - 1)) * L.spillwayWidth;
      this.m.compose(this.v.set(x, L.deckY + 1.6, 4), this.q.identity(), this.sc.set(1, 1, 1));
      this.portals.setMatrixAt(i, this.m);
    }
    this.portals.instanceMatrix.needsUpdate = true;
    this.portals.visible = false;
    this.portals.frustumCulled = false;
    scene.add(this.portals);
  }

  /** world X of pier i (0..48) */
  pierX(i: number): number {
    return L.spillwayLeft + L.pierThickness / 2 + i * (L.baySpan + L.pierThickness);
  }

  /** world X of bay centre i (0..47) */
  bayX(i: number): number {
    return this.pierX(i) + (L.baySpan + L.pierThickness) / 2;
  }

  update(s: BuildState): void {
    // crest & apron lead the pier phase
    const crestP = Math.min(1, s.piers * 2.4);
    this.crest.visible = crestP > 0.001;
    this.apron.visible = crestP > 0.001;
    this.crest.position.y = THREE.MathUtils.lerp(-26, 0, easeOutCubic(crestP));
    this.apron.position.y = THREE.MathUtils.lerp(-9, -1.2, easeOutCubic(crestP));

    if (s.piers !== this.lastPiers) {
      this.lastPiers = s.piers;
      this.piers.visible = s.piers > 0.001;
      if (this.piers.visible) {
        const n = this.pierCount;
        const K = 0.75; // stagger spread
        const half = (n - 1) / 2;
        for (let i = 0; i < n; i++) {
          // banks first, centre last
          const order = 1 - Math.abs(i - half) / half;
          const p = THREE.MathUtils.clamp((s.piers * (1 + K) - order * K), 0, 1);
          const y = THREE.MathUtils.lerp(-L.pierHeight - 12, 0, easeOutCubic(p));
          this.m.compose(this.v.set(this.pierX(i), y, 0), this.q.identity(), this.sc.set(1, 1, 1));
          this.piers.setMatrixAt(i, this.m);
        }
        this.piers.instanceMatrix.needsUpdate = true;
      }
    }

    if (s.deck !== this.lastDeck) {
      this.lastDeck = s.deck;
      const p = easeOutCubic(s.deck);
      this.deck.visible = s.deck > 0.001;
      this.portals.visible = s.deck > 0.6;
      this.deck.position.y = THREE.MathUtils.lerp(L.deckY + 60, L.deckY + L.deckThickness / 2, p);
    }
  }
}
