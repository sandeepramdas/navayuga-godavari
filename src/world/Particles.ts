/**
 * Particles.ts — GPU point systems, one draw call each:
 *  · Dust — construction haze cycling upward over the pier field (S4–S6)
 *  · Sparks — welding bursts at gate trunnions (S5)
 *  · Spray — ballistic white water off the gate lips + mist (S8)
 *  · Birds — a handful of instanced silhouettes crossing the S8 reveal
 * All animation runs in shaders off uTime/uIntensity; CPU touches nothing per-frame.
 */
import * as THREE from 'three';
import { L } from './layout';
import type { BuildState } from './BuildState';

function makePointsMaterial(frag: string, vert: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uPixelRatio: { value: 1 }, ...uniforms },
    vertexShader: vert,
    fragmentShader: frag,
  });
}

const SOFT_DISC = /* glsl */ `
  float disc(vec2 uv) {
    float d = length(uv - 0.5) * 2.0;
    return smoothstep(1.0, 0.2, d);
  }
`;

export class Particles {
  private dust: THREE.Points;
  private sparks: THREE.Points;
  private spray: THREE.Points;
  private birds: THREE.InstancedMesh;
  private mats: THREE.ShaderMaterial[] = [];
  private t = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(scene: THREE.Scene, particleScale: number, pixelRatio: number, trunnions: THREE.Vector3[]) {
    // ---------- DUST ----------
    const dustN = Math.round(500 * particleScale);
    {
      const pos = new Float32Array(dustN * 3);
      const seed = new Float32Array(dustN);
      for (let i = 0; i < dustN; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * 520;
        pos[i * 3 + 1] = Math.random() * 6;
        pos[i * 3 + 2] = (Math.random() * 2 - 1) * 60;
        seed[i] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const mat = makePointsMaterial(
        /* glsl */ `
          uniform float uIntensity;
          varying float vA;
          ${SOFT_DISC}
          void main() {
            float a = disc(gl_PointCoord) * vA * uIntensity * 0.16;
            gl_FragColor = vec4(vec3(0.72, 0.66, 0.55), a);
          }
        `,
        /* glsl */ `
          uniform float uTime;
          uniform float uPixelRatio;
          attribute float aSeed;
          varying float vA;
          void main() {
            float cycle = fract(uTime * (0.04 + aSeed * 0.05) + aSeed);
            vec3 p = position;
            p.y += cycle * (26.0 + aSeed * 22.0);
            p.x += sin(uTime * 0.4 + aSeed * 40.0) * 6.0;
            vA = smoothstep(0.0, 0.15, cycle) * smoothstep(1.0, 0.55, cycle);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (300.0 + aSeed * 500.0) * uPixelRatio / -mv.z;
          }
        `,
        {}
      );
      mat.blending = THREE.NormalBlending;
      this.dust = new THREE.Points(g, mat);
      this.dust.frustumCulled = false;
      this.dust.visible = false;
      scene.add(this.dust);
      this.mats.push(mat);
    }

    // ---------- SPARKS ----------
    const sparkN = Math.round(260 * particleScale);
    {
      const pos = new Float32Array(sparkN * 3);
      const seed = new Float32Array(sparkN);
      const vel = new Float32Array(sparkN * 3);
      for (let i = 0; i < sparkN; i++) {
        const t = trunnions[Math.floor(Math.random() * trunnions.length)];
        pos[i * 3] = t.x + (Math.random() - 0.5) * 6;
        pos[i * 3 + 1] = t.y + (Math.random() - 0.5) * 3;
        pos[i * 3 + 2] = t.z;
        seed[i] = Math.random();
        vel[i * 3] = (Math.random() - 0.5) * 10;
        vel[i * 3 + 1] = 4 + Math.random() * 9;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
      const mat = makePointsMaterial(
        /* glsl */ `
          uniform float uIntensity;
          varying float vA;
          ${SOFT_DISC}
          void main() {
            float a = disc(gl_PointCoord) * vA * uIntensity;
            gl_FragColor = vec4(vec3(1.0, 0.62, 0.18) * 2.2, a);
          }
        `,
        /* glsl */ `
          uniform float uTime;
          uniform float uPixelRatio;
          attribute float aSeed;
          attribute vec3 aVel;
          varying float vA;
          void main() {
            float life = 0.9 + aSeed * 0.6;
            float age = fract(uTime * (1.0 / life) + aSeed * 7.0) * life;
            vec3 p = position + aVel * age;
            p.y -= 14.0 * age * age; // gravity
            vA = (1.0 - age / life);
            vA *= vA;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (40.0 + aSeed * 60.0) * uPixelRatio / -mv.z;
          }
        `,
        {}
      );
      this.sparks = new THREE.Points(g, mat);
      this.sparks.frustumCulled = false;
      this.sparks.visible = false;
      scene.add(this.sparks);
      this.mats.push(mat);
    }

    // ---------- SPRAY ----------
    const sprayN = Math.round(1500 * particleScale);
    {
      const pos = new Float32Array(sprayN * 3);
      const seed = new Float32Array(sprayN);
      for (let i = 0; i < sprayN; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * (L.spillwayWidth / 2 - 8);
        pos[i * 3 + 1] = L.sillY - 2 + Math.random() * 6;
        pos[i * 3 + 2] = 18 + Math.random() * 4;
        seed[i] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const mat = makePointsMaterial(
        /* glsl */ `
          uniform float uIntensity;
          varying float vA;
          ${SOFT_DISC}
          void main() {
            float a = disc(gl_PointCoord) * vA * uIntensity * 0.85;
            gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), a);
          }
        `,
        /* glsl */ `
          uniform float uTime;
          uniform float uPixelRatio;
          attribute float aSeed;
          varying float vA;
          void main() {
            float life = 1.1 + aSeed * 0.9;
            float age = fract(uTime * (1.0 / life) + aSeed * 13.0) * life;
            vec3 p = position;
            float launch = 16.0 + aSeed * 26.0;
            p.z += launch * age * (1.4 + aSeed);
            p.y = position.y + (10.0 + aSeed * 8.0) * age - 22.0 * age * age;
            p.x += sin(aSeed * 90.0 + uTime) * 2.0;
            vA = smoothstep(0.0, 0.1, age) * (1.0 - age / life);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (140.0 + aSeed * 420.0) * uPixelRatio / -mv.z;
          }
        `,
        {}
      );
      this.spray = new THREE.Points(g, mat);
      this.spray.frustumCulled = false;
      this.spray.visible = false;
      scene.add(this.spray);
      this.mats.push(mat);
    }

    for (const m of this.mats) m.uniforms.uPixelRatio.value = pixelRatio;

    // ---------- BIRDS ----------
    const birdGeo = new THREE.PlaneGeometry(7, 2.2);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x101315, side: THREE.DoubleSide });
    this.birds = new THREE.InstancedMesh(birdGeo, birdMat, 6);
    this.birds.visible = false;
    this.birds.frustumCulled = false;
    scene.add(this.birds);
  }

  update(s: BuildState, dt: number): void {
    this.t += dt;
    for (const m of this.mats) m.uniforms.uTime.value = this.t;

    (this.dust.material as THREE.ShaderMaterial).uniforms.uIntensity.value = s.dust;
    this.dust.visible = s.dust > 0.01;
    (this.sparks.material as THREE.ShaderMaterial).uniforms.uIntensity.value = s.sparks;
    this.sparks.visible = s.sparks > 0.01;
    (this.spray.material as THREE.ShaderMaterial).uniforms.uIntensity.value = s.flood;
    this.spray.visible = s.flood > 0.01;

    // birds cross the reveal — lazy arcs over the reservoir
    this.birds.visible = s.golden > 0.25;
    if (this.birds.visible) {
      for (let i = 0; i < 6; i++) {
        const ph = i * 1.13;
        const t = this.t * 0.05 + ph;
        const x = Math.sin(t) * (500 + i * 40);
        const z = -420 - i * 55 + Math.cos(t * 0.8) * 120;
        const y = 130 + i * 12 + Math.sin(this.t * 0.6 + ph) * 8;
        const flap = 0.55 + Math.abs(Math.sin(this.t * 7 + ph)) * 0.7;
        this.e.set(0, Math.atan2(Math.cos(t), -Math.sin(t)), 0);
        this.q.setFromEuler(this.e);
        this.m.compose(this.v.set(x, y, z), this.q, this.sc.set(1, flap, 1));
        this.birds.setMatrixAt(i, this.m);
      }
      this.birds.instanceMatrix.needsUpdate = true;
    }
  }
}
