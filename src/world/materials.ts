/**
 * materials.ts — PBR material factories with shader-level detail:
 * concrete gets procedural lift-band shading, noise roughness and vertical
 * water-staining; steel gets painted/bare two-tone treatment via separate mats.
 * All concrete variants share one `uAge` grade (fresh pours read cooler/lighter).
 */
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
  float mhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mhash(i), mhash(i + vec2(1, 0)), u.x),
               mix(mhash(i + vec2(0, 1)), mhash(i + vec2(1, 1)), u.x), u.y);
  }
`;

export interface ConcreteOpts {
  liftHeight?: number; // horizontal pour-band spacing
  stain?: number; // 0..1 vertical weathering strength
  tint?: number; // hex
}

/** Concrete with lift bands + weathering, driven in world space (works for InstancedMesh). */
export function makeConcrete(opts: ConcreteOpts = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.tint ?? 0xa19b91,
    roughness: 0.92,
    metalness: 0.0,
  });
  const liftH = opts.liftHeight ?? 3.0;
  const stain = opts.stain ?? 0.45;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldPos;'
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         #ifdef USE_INSTANCING
           vWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
         #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vWorldPos;\n${NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // pour lift bands — thin darker seams every liftH metres
          float lift = fract(vWorldPos.y / ${liftH.toFixed(2)});
          float seam = smoothstep(0.0, 0.05, lift) * smoothstep(1.0, 0.95, lift);
          diffuseColor.rgb *= mix(0.82, 1.0, seam);
          // large-scale patchiness between pours ('patch' is reserved in GLSL ES 3)
          float pourPatch = mnoise(vec2(floor(vWorldPos.y / ${liftH.toFixed(2)}) * 3.1, vWorldPos.x * 0.02));
          diffuseColor.rgb *= 0.94 + 0.09 * pourPatch;
          // fine surface noise
          float fine = mnoise(vWorldPos.xz * 0.8 + vWorldPos.yy * 0.6);
          diffuseColor.rgb *= 0.96 + 0.07 * fine;
          // vertical water staining, heavier low down
          float stainMask = (1.0 - smoothstep(0.0, 34.0, vWorldPos.y)) * ${stain.toFixed(2)};
          float streak = mnoise(vec2(vWorldPos.x * 0.35, vWorldPos.z * 0.35));
          diffuseColor.rgb *= 1.0 - stainMask * (0.35 + 0.4 * streak);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(roughnessFactor - 0.08 + 0.16 * mnoise(vWorldPos.xz * 0.5), 0.6, 1.0);`
      );
  };
  return mat;
}

/** Safety-orange painted gate skin. */
export function makeOrangeSteel(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xd85510,
    roughness: 0.48,
    metalness: 0.25,
  });
}

/** Bare structural steel (arms, trunnions, cranes). */
export function makeSteel(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x757a80,
    roughness: 0.38,
    metalness: 0.95,
  });
}

/** Rockfill / embankment earthworks with banded zoning support. */
export function makeRockfill(core = false): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: core ? 0x8a6a4e : 0x6f6a62,
    roughness: 1.0,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide, // clipped lifts must not read hollow
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWp;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float n = mnoise(vWp.xz * 0.24) * 0.6 + mnoise(vWp.xz * 1.4) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.34 * n;
          // riprap crown — lighter armour rock near the top
          float crown = smoothstep(34.0, 46.0, vWp.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.57), crown * 0.55);
        }`
      );
  };
  return mat;
}
