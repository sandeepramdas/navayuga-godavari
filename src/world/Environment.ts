/**
 * Environment.ts — physical Sky (three addon) drives both the background and a
 * PMREM-generated scene.environment (image-based lighting with zero downloaded
 * assets). One directional sun with shadows over the head-works, hemisphere
 * fill, FogExp2 aerial perspective. `setGolden(t)` sweeps noon → golden hour;
 * the PMREM env is regenerated once when the sweep commits (single ~10ms cost).
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { BuildState } from './BuildState';

const DAY = { elevation: 42, azimuth: 165, turbidity: 2.6, rayleigh: 2.2, fog: 0x86a0b4, sun: 0xfff2dc, amb: new THREE.Color(0.3, 0.38, 0.47) };
const GOLD = { elevation: 5, azimuth: 235, turbidity: 7, rayleigh: 2.4, fog: 0xc08a58, sun: 0xff9c42, amb: new THREE.Color(0.36, 0.26, 0.22) };

export class Environment {
  readonly sunDir = new THREE.Vector3();
  readonly sunColor = new THREE.Color();
  readonly ambColor = new THREE.Color();
  private sky: Sky;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private pmrem: THREE.PMREMGenerator;
  private skyScene: THREE.Scene;
  private skyForEnv: Sky;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private goldenCommitted = false;
  private lastGolden = -1;
  private lastXray = -1;
  private xrayFog = new THREE.Color(0x04121c);
  private fogDay = new THREE.Color(DAY.fog);
  private fogGold = new THREE.Color(GOLD.fog);
  private sunDay = new THREE.Color(DAY.sun);
  private sunGold = new THREE.Color(GOLD.sun);

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer, shadowMapSize: number) {
    this.sky = new Sky();
    this.sky.scale.setScalar(8000);
    scene.add(this.sky);

    scene.fog = new THREE.FogExp2(DAY.fog, 0.0001);

    this.sun = new THREE.DirectionalLight(DAY.sun, 5.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(shadowMapSize);
    const cam = this.sun.shadow.camera;
    cam.left = -700; cam.right = 700; cam.top = 300; cam.bottom = -300;
    cam.near = 100; cam.far = 2600;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbdd3e4, 0x4a4238, 1.1);
    scene.add(this.hemi);

    // env-map generation rig (separate scene so background stays the big sky)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.skyScene = new THREE.Scene();
    this.skyForEnv = new Sky();
    this.skyForEnv.scale.setScalar(8000);
    this.skyScene.add(this.skyForEnv);

    this.apply(0);
    this.bakeEnv(0);
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.6;
  }

  private sunPosFor(t: number, out: THREE.Vector3): THREE.Vector3 {
    const el = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(DAY.elevation, GOLD.elevation, t));
    const az = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(DAY.azimuth, GOLD.azimuth, t));
    return out.setFromSphericalCoords(1, Math.PI / 2 - el, az);
  }

  private applySky(sky: Sky, t: number): void {
    const u = sky.material.uniforms;
    u.turbidity.value = THREE.MathUtils.lerp(DAY.turbidity, GOLD.turbidity, t);
    u.rayleigh.value = THREE.MathUtils.lerp(DAY.rayleigh, GOLD.rayleigh, t);
    u.mieCoefficient.value = THREE.MathUtils.lerp(0.0025, 0.01, t);
    u.mieDirectionalG.value = 0.85;
    this.sunPosFor(t, u.sunPosition.value as THREE.Vector3);
  }

  private bakeEnv(t: number): void {
    this.applySky(this.skyForEnv, t);
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.skyScene as unknown as THREE.Scene);
    this.scene.environment = this.envTarget.texture;
    old?.dispose();
  }

  private apply(t: number): void {
    this.applySky(this.sky, t);
    this.sunPosFor(t, this.sunDir);
    this.sun.position.copy(this.sunDir).multiplyScalar(1400);
    this.sun.target.position.set(0, 0, 0);
    this.sunColor.lerpColors(this.sunDay, this.sunGold, t);
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = THREE.MathUtils.lerp(5.2, 4.2, t);
    this.hemi.intensity = THREE.MathUtils.lerp(1.1, 0.55, t);
    this.ambColor.lerpColors(DAY.amb, GOLD.amb, t);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.lerpColors(this.fogDay, this.fogGold, t);
    fog.density = THREE.MathUtils.lerp(0.0001, 0.0002, t);
  }

  update(s: BuildState): void {
    if (s.golden !== this.lastGolden) {
      this.lastGolden = s.golden;
      this.apply(s.golden);
      if (!this.goldenCommitted && s.golden > 0.55) {
        this.goldenCommitted = true;
        this.bakeEnv(1);
      } else if (this.goldenCommitted && s.golden < 0.4) {
        this.goldenCommitted = false;
        this.bakeEnv(0);
      }
    }
    // blueprint X-ray beat: drop into a dark void — no sky, no fog wash
    if (s.xray !== this.lastXray) {
      this.lastXray = s.xray;
      this.sky.visible = s.xray < 0.6;
      const fog = this.scene.fog as THREE.FogExp2;
      fog.density = THREE.MathUtils.lerp(0.0001, 0.00002, s.xray);
      this.xrayFog.setHex(0x04121c);
      fog.color.lerpColors(this.fogDay, this.xrayFog, s.xray);
      this.sun.intensity = THREE.MathUtils.lerp(5.2, 1.2, s.xray);
    }
  }
}
