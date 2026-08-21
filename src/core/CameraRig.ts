/**
 * CameraRig.ts — cinematic rig: dolly (xz) → boom (y) → camera, with a tweened
 * focus target (never snap lookAt), simplex-ish micro-drift and FOV as a
 * storytelling parameter. GSAP animates `pos`, `look` and `fov` directly;
 * the rig resolves everything in update() with zero allocations.
 */
import * as THREE from 'three';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  /** tweened by the master timeline */
  readonly pos = new THREE.Vector3(130, 430, 330);
  readonly look = new THREE.Vector3(-40, 0, -220);
  fov = 55;
  /** 0..1 — scales handheld drift (set 0 during HUD-stat beats) */
  drift = 1;
  /** scroll-velocity FOV kick in degrees, decays in update() */
  fovKick = 0;

  private smoothedLook = new THREE.Vector3();
  private t = 0;
  private scratch = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 2, 9000);
    this.camera.position.copy(this.pos);
    this.smoothedLook.copy(this.look);
    this.camera.lookAt(this.look);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** map |scroll velocity| → transient fov widen (documentary energy) */
  kick(v: number): void {
    this.fovKick = Math.min(2, Math.max(this.fovKick, Math.abs(v) * 0.9));
  }

  update(dt: number): void {
    this.t += dt;

    // damped look target — never snaps between sections
    const k = 1 - Math.pow(0.0008, dt);
    this.smoothedLook.lerp(this.look, k);

    // layered-sine "simplex-lite" handheld drift (amplitude ~0.5 world units at dam scale)
    const a = 0.55 * this.drift;
    const dx = a * (Math.sin(this.t * 0.9) * 0.6 + Math.sin(this.t * 1.7 + 2.1) * 0.4);
    const dy = a * 0.6 * (Math.sin(this.t * 1.13 + 4.2) * 0.7 + Math.sin(this.t * 0.61) * 0.3);
    const dz = a * (Math.sin(this.t * 0.74 + 1.3) * 0.5 + Math.sin(this.t * 1.41 + 0.4) * 0.5);

    this.camera.position.set(this.pos.x + dx, this.pos.y + dy, this.pos.z + dz);
    this.scratch.copy(this.smoothedLook);
    this.scratch.y += dy * 0.4;
    this.camera.lookAt(this.scratch);

    // fov with decaying scroll kick
    this.fovKick *= Math.pow(0.02, dt);
    const f = this.fov + this.fovKick;
    if (Math.abs(this.camera.fov - f) > 0.01) {
      this.camera.fov = f;
      this.camera.updateProjectionMatrix();
    }
  }
}
