/**
 * Gates.ts — 48 radial crest gates as TWO InstancedMeshes (safety-orange skin
 * plate + bare-steel radial arms) = 2 draw calls. Install wave ripples from the
 * centre outward with anticipation (a small shudder before the lift), then the
 * whole battery rotates open for the S8 release.
 */
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from './layout';
import { makeOrangeSteel, makeSteel } from './materials';
import type { BuildState } from './BuildState';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export class Gates {
  readonly skins: THREE.InstancedMesh;
  readonly arms: THREE.InstancedMesh;
  /** trunnion world positions — used by the welding-spark emitter */
  readonly trunnions: THREE.Vector3[] = [];

  private trunnionY = L.sillY + 17;
  private trunnionZ = 10;
  private last = { g: -1, o: -1 };
  private m = new THREE.Matrix4();
  private mr = new THREE.Matrix4();
  private mt = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private axis = new THREE.Vector3(1, 0, 0);

  constructor(scene: THREE.Scene, private bayX: (i: number) => number) {
    // --- skin: cylinder sector, axis along X after rotateZ, arc facing upstream-down
    const THETA0 = Math.PI + 0.15;
    const THETA_LEN = 1.4;
    const skin = new THREE.CylinderGeometry(
      L.gateRadius, L.gateRadius, L.baySpan - 1.4, 22, 1, true,
      THETA0, THETA_LEN
    );
    skin.rotateZ(Math.PI / 2);
    // horizontal stiffener ribs on the downstream face of the skin
    const rib = new THREE.TorusGeometry(L.gateRadius + 0.35, 0.24, 6, 22, THETA_LEN);
    rib.rotateY(-Math.PI / 2);
    rib.rotateX(THETA0);
    const rib1 = rib.clone(); rib1.translate(-(L.baySpan - 1.4) / 3, 0, 0);
    const rib2 = rib.clone(); rib2.translate((L.baySpan - 1.4) / 3, 0, 0);
    const skinGeo = BGU.mergeGeometries([skin, rib, rib1, rib2]);
    const orange = makeOrangeSteel();
    orange.side = THREE.DoubleSide;
    this.skins = new THREE.InstancedMesh(skinGeo, orange, L.bayCount);
    this.skins.castShadow = true;
    this.skins.visible = false;
    this.skins.frustumCulled = false;
    scene.add(this.skins);

    // --- arms: two pairs of radial struts + trunnion shaft
    const armLen = L.gateRadius;
    const mkArm = (side: number, ang: number): THREE.BoxGeometry => {
      const a = new THREE.BoxGeometry(0.8, 0.8, armLen);
      a.translate(0, 0, -armLen / 2);
      a.rotateX(-ang); // tilt DOWN toward the skin sector
      a.translate(side * (L.baySpan / 2 - 1.6), 0, 0);
      return a;
    };
    // angles pointing from trunnion into the skin sector (down-upstream)
    const a1 = 0.5, a2 = 1.3;
    const shaft = new THREE.CylinderGeometry(0.9, 0.9, L.baySpan - 0.6, 10);
    shaft.rotateZ(Math.PI / 2);
    const armsGeo = BGU.mergeGeometries([
      mkArm(-1, a1), mkArm(-1, a2), mkArm(1, a1), mkArm(1, a2), shaft,
    ]);
    this.arms = new THREE.InstancedMesh(armsGeo, makeSteel(), L.bayCount);
    this.arms.castShadow = true;
    this.arms.visible = false;
    this.arms.frustumCulled = false;
    scene.add(this.arms);

    for (let i = 0; i < L.bayCount; i++) {
      this.trunnions.push(new THREE.Vector3(this.bayX(i), this.trunnionY, this.trunnionZ));
    }
  }

  update(s: BuildState): void {
    if (s.gates === this.last.g && s.gateOpen === this.last.o) return;
    this.last.g = s.gates;
    this.last.o = s.gateOpen;
    const on = s.gates > 0.001;
    this.skins.visible = on;
    this.arms.visible = on;
    if (!on) return;

    const n = L.bayCount;
    const half = (n - 1) / 2;
    const K = 0.85;
    for (let i = 0; i < n; i++) {
      // ripple from the centre outward
      const order = Math.abs(i - half) / half;
      let p = THREE.MathUtils.clamp(s.gates * (1 + K) - order * K, 0, 1);
      // anticipation: 4% dip just before the drop settles
      const settle = easeOutCubic(p);
      const anticip = Math.sin(Math.min(p * Math.PI, Math.PI)) * (p < 0.5 ? -0.03 : 0.015);
      const drop = THREE.MathUtils.lerp(85, 0, settle) + anticip * 10;

      // opening rotation about the trunnion axis, slight outward ripple too
      const openLocal = THREE.MathUtils.clamp(s.gateOpen * (1 + 0.4) - order * 0.4, 0, 1);
      const ang = -openLocal * 0.85;

      const tx = this.bayX(i);
      // M = T(bay,trunnion) · R(ang) then instance geometry already centred on trunnion
      this.q.setFromAxisAngle(this.axis, ang);
      this.mr.makeRotationFromQuaternion(this.q);
      this.mt.makeTranslation(tx, this.trunnionY + drop, this.trunnionZ);
      this.m.multiplyMatrices(this.mt, this.mr);
      this.skins.setMatrixAt(i, this.m);
      this.arms.setMatrixAt(i, this.m);
    }
    this.skins.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
  }
}
