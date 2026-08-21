/**
 * Terrain.ts — displaced valley plane with a custom lit shader:
 * height/slope-based colouring (silt floor → rock slopes → scrub banks),
 * aerial-perspective fog, and a blueprint X-ray mode for the diaphragm-wall beat.
 */
import * as THREE from 'three';
import { L, terrainHeight } from './layout';
import type { BuildState } from './BuildState';

export class Terrain {
  readonly mesh: THREE.Mesh;
  private uniforms: {
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uAmbient: { value: THREE.Color };
    uXray: { value: number };
  };

  constructor(scene: THREE.Scene, segments: number) {
    const geo = new THREE.PlaneGeometry(L.terrainW, L.terrainD, segments, Math.round(segments * 0.7));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.96, 0.88) },
      uAmbient: { value: new THREE.Color(0.35, 0.42, 0.5) },
      uXray: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, ...THREE.UniformsLib.fog },
      fog: true,
      transparent: true,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vWp;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWp = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uAmbient;
        uniform float uXray;
        varying vec3 vNormal;
        varying vec3 vWp;

        float thash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(thash(i), thash(i + vec2(1, 0)), u.x),
                     mix(thash(i + vec2(0, 1)), thash(i + vec2(1, 1)), u.x), u.y);
        }

        void main() {
          vec3 n = normalize(vNormal);
          float slope = 1.0 - n.y;
          float h = vWp.y;

          // material zones
          vec3 silt  = vec3(0.4, 0.33, 0.24);
          vec3 rock  = vec3(0.31, 0.29, 0.27);
          vec3 scrub = vec3(0.21, 0.28, 0.17);
          vec3 col = silt;
          col = mix(col, scrub, smoothstep(10.0, 55.0, h) * 0.85);
          col = mix(col, rock, smoothstep(0.12, 0.4, slope));
          float n1 = tnoise(vWp.xz * 0.012);
          float n2 = tnoise(vWp.xz * 0.11);
          col *= 0.74 + 0.42 * (n1 * 0.65 + n2 * 0.35);
          // wet band along the channel shoreline
          col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 12.0, h)) * (1.0 - smoothstep(200.0, 700.0, abs(vWp.x)));

          // lighting — half-lambert sun + hemisphere ambient
          // (multipliers compensate the 0.6 tone-mapping exposure the Sky demands)
          float ndl = dot(n, uSunDir) * 0.5 + 0.5;
          vec3 lit = col * (uAmbient * 0.9 + uSunColor * ndl * ndl * 2.2);

          // blueprint X-ray: dark translucent field with cyan survey grid
          float gx = abs(fract(vWp.x / 50.0) - 0.5);
          float gz = abs(fract(vWp.z / 50.0) - 0.5);
          float grid = 1.0 - smoothstep(0.0, 0.045, min(gx, gz));
          vec3 xrayCol = vec3(0.012, 0.075, 0.13) + vec3(0.22, 0.78, 1.0) * grid * 0.9;
          vec3 outCol = mix(lit, xrayCol, uXray);
          float alpha = mix(1.0, 0.6, uXray);

          gl_FragColor = vec4(outCol, alpha);
          #include <fog_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false; // custom shader; AO impression baked into colour zones
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
  }

  setSun(dir: THREE.Vector3, color: THREE.Color, ambient: THREE.Color): void {
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uSunColor.value.copy(color);
    this.uniforms.uAmbient.value.copy(ambient);
  }

  update(s: BuildState): void {
    this.uniforms.uXray.value = s.xray;
  }
}
