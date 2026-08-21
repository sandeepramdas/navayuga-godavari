/**
 * Water.ts — custom Godavari water shader (no stock THREE.Water):
 * layered directional waves perturbing normals, depth-toned colour, fresnel sky
 * reflectance, sun glints (bloom feeds on these in S8), and flood foam.
 * Three planes: upstream reservoir · cofferdam work area (drains in S3) · downstream river.
 */
import * as THREE from 'three';
import { L } from './layout';
import type { BuildState } from './BuildState';

function makeWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      uGolden: { value: 0 },
      uFoam: { value: 0 },
      uAlpha: { value: 1.0 },
      uFlow: { value: 1 }, // z flow direction sign
      uMaxZ: { value: 1e6 }, // fragments beyond this world-z are discarded
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWp;
      varying vec3 vView;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWp = wp.xyz;
        vView = cameraPosition - wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uGolden;
      uniform float uFoam;
      uniform float uAlpha;
      uniform float uFlow;
      uniform float uMaxZ;
      varying vec3 vWp;
      varying vec3 vView;

      float whash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(whash(i), whash(i + vec2(1, 0)), u.x),
                   mix(whash(i + vec2(0, 1)), whash(i + vec2(1, 1)), u.x), u.y);
      }

      // layered wave normal — two scales, two directions
      vec3 waveNormal(vec2 p, float t) {
        float e = 0.7;
        float s = 0.0;
        s += sin(p.x * 0.11 + t * 0.9) * 0.5;
        s += sin((p.x * 0.6 + p.y * 0.8) * 0.06 - t * 0.7) * 0.7;
        s += wnoise(p * 0.05 + vec2(0.0, t * 0.12 * uFlow)) * 1.6;
        s += wnoise(p * 0.21 + vec2(t * 0.07, t * 0.19 * uFlow)) * 0.8;
        float sx = s - (sin((p.x + e) * 0.11 + t * 0.9) * 0.5
                 + sin(((p.x + e) * 0.6 + p.y * 0.8) * 0.06 - t * 0.7) * 0.7
                 + wnoise((p + vec2(e, 0.0)) * 0.05 + vec2(0.0, t * 0.12 * uFlow)) * 1.6
                 + wnoise((p + vec2(e, 0.0)) * 0.21 + vec2(t * 0.07, t * 0.19 * uFlow)) * 0.8);
        float sy = s - (sin(p.x * 0.11 + t * 0.9) * 0.5
                 + sin((p.x * 0.6 + (p.y + e) * 0.8) * 0.06 - t * 0.7) * 0.7
                 + wnoise((p + vec2(0.0, e)) * 0.05 + vec2(0.0, t * 0.12 * uFlow)) * 1.6
                 + wnoise((p + vec2(0.0, e)) * 0.21 + vec2(t * 0.07, t * 0.19 * uFlow)) * 0.8);
        return normalize(vec3(sx * 0.9, 1.0, sy * 0.9));
      }

      void main() {
        if (vWp.z > uMaxZ) discard;
        vec3 V = normalize(vView);
        vec3 N = waveNormal(vWp.xz, uTime);

        // palette — day vs golden hour (kept dark enough to always read as water)
        vec3 deepDay = vec3(0.018, 0.088, 0.115);
        vec3 skyDay = vec3(0.28, 0.42, 0.56);
        vec3 deepGold = vec3(0.035, 0.075, 0.10);
        vec3 skyGold = vec3(0.34, 0.20, 0.12);
        vec3 deep = mix(deepDay, deepGold, uGolden);
        vec3 sky = mix(skyDay, skyGold, uGolden);

        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(deep, sky, clamp(fres * mix(0.6, 0.3, uGolden) + 0.04, 0.0, 1.0));

        // sun glints — restrained by day, blooms at golden hour
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), mix(260.0, 100.0, uGolden));
        col += spec * mix(vec3(0.5), vec3(2.6, 1.5, 0.6), uGolden) * (0.5 + 1.2 * uGolden);

        // flood foam — churned white water in a band below the spillway apron
        if (uFoam > 0.001) {
          float streak = wnoise(vec2(vWp.x * 0.09, vWp.z * 0.025 - uTime * 1.4));
          float chop = wnoise(vWp.xz * 0.4 + vec2(0.0, -uTime * 2.2));
          float nearGates = 1.0 - smoothstep(40.0, 300.0, vWp.z - 20.0);
          nearGates *= step(20.0, vWp.z);
          nearGates *= 1.0 - smoothstep(420.0, 600.0, abs(vWp.x));
          float foam = smoothstep(0.6, 0.98, streak * 0.6 + chop * 0.55) * uFoam * (0.04 + 0.96 * nearGates);
          col = mix(col, vec3(0.9, 0.94, 0.95), clamp(foam, 0.0, 1.0));
        }

        gl_FragColor = vec4(col, uAlpha);
        #include <fog_fragment>
      }
    `,
  });
}

class WaterPlane {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  constructor(scene: THREE.Scene, w: number, d: number, cz: number, flow: number) {
    this.mat = makeWaterMaterial();
    this.mat.uniforms.uFlow.value = flow;
    const geo = new THREE.PlaneGeometry(w, d, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(0, L.riverLevel, cz);
    scene.add(this.mesh);
  }
}

export class Water {
  private up: WaterPlane;
  private work: WaterPlane;
  private down: WaterPlane;
  private time = 0;

  constructor(scene: THREE.Scene) {
    // reservoir runs all the way to the spillway face; a shader z-clip pulls it
    // back to the upper cofferdam while the pit is dewatered
    this.up = new WaterPlane(scene, L.terrainW, 1500 - 6, (-1500 - 6) / 2, 1); // same flow field as the other planes — keeps the shared noise continuous across seams
        this.work = new WaterPlane(scene, L.terrainW, L.cofferDownZ - L.cofferUpZ, (L.cofferUpZ + L.cofferDownZ) / 2, 1);
    this.down = new WaterPlane(scene, L.terrainW, 1500 - L.cofferDownZ, (L.cofferDownZ + 1500) / 2, 1);
  }

  setSun(dir: THREE.Vector3): void {
    this.up.mat.uniforms.uSunDir.value.copy(dir);
    this.work.mat.uniforms.uSunDir.value.copy(dir);
    this.down.mat.uniforms.uSunDir.value.copy(dir);
  }

  update(s: BuildState, dt: number): void {
    this.time += dt;
    for (const p of [this.up, this.work, this.down]) {
      p.mat.uniforms.uTime.value = this.time;
      p.mat.uniforms.uGolden.value = s.golden;
      const hidden = s.xray;
      p.mat.uniforms.uAlpha.value = 1 - hidden * 0.95;
      p.mesh.visible = p.mat.uniforms.uAlpha.value > 0.02 && p.mesh.scale.x > 0.001;
    }
    // upstream reservoir fills to FRL in S8. The plane normally stops at the
    // upper cofferdam (the work plane owns the strip beyond); once the pool
    // overtops the cofferdam crest the reservoir reaches the dam face.
    this.up.mesh.position.y = s.waterUp;
    const submerged = THREE.MathUtils.smoothstep(s.waterUp, L.cofferHeight - 3, L.cofferHeight + 8);
    this.up.mat.uniforms.uMaxZ.value = THREE.MathUtils.lerp(L.cofferUpZ, -6, submerged);
    // work area drains as cofferdams close, then floods again for the release
    const floodRise = THREE.MathUtils.smoothstep(s.flood, 0.05, 0.5);
    const drained = THREE.MathUtils.lerp(L.riverLevel, -9, s.dewater);
    this.work.mesh.position.y = THREE.MathUtils.lerp(drained, L.riverLevel + 1.6, floodRise);
    this.work.mesh.visible = (s.dewater < 0.985 || floodRise > 0.02) && s.xray < 0.9;
    // the release side of the work plane must not poke above the reservoir upstream
    this.work.mat.uniforms.uMaxZ.value = 1e6;
    // downstream: swells + churns during the S8 release
    this.down.mesh.position.y = L.riverLevel + s.flood * 2.2;
    this.down.mat.uniforms.uFoam.value = s.flood;
    this.work.mat.uniforms.uFoam.value = Math.max(s.flood, 0);
  }
}
