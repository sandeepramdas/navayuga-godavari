/**
 * PostFX.ts — EffectComposer chain: render → UnrealBloom (gate steel, sun
 * glints, spray) → OutputPass (ACES + sRGB) → film grain + vignette (in sRGB).
 * Quality tiers: high = full chain · med = bloom only · low/off = direct render.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 61.0) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float g = (grain(vUv * vec2(1920.0, 1080.0)) - 0.5) * uGrain;
      c.rgb += g;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.42, 0.85, d) * uVignette;
      gl_FragColor = c;
    }
  `,
};

export class PostFX {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grain: ShaderPass;
  private enabled = true;
  private t = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    opts: { bloom: boolean; grain: boolean }
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.65, 0.86);
    this.bloom.enabled = opts.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grain = new ShaderPass(GrainVignetteShader);
    this.grain.enabled = opts.grain;
    this.composer.addPass(this.grain);
    this.enabled = opts.bloom || opts.grain;
    this.setSize(innerWidth, innerHeight);
  }

  setQuality(opts: { bloom: boolean; grain: boolean }): void {
    this.bloom.enabled = opts.bloom;
    this.grain.enabled = opts.grain;
    this.enabled = opts.bloom || opts.grain;
  }

  /** bloom swells for the golden-hour release */
  setGolden(t: number): void {
    this.bloom.strength = 0.32 + t * 0.33;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(scene: THREE.Scene, dt: number): void {
    if (this.enabled) {
      this.t += dt;
      (this.grain.uniforms as typeof GrainVignetteShader.uniforms).uTime.value = this.t % 10;
      this.composer.render(dt);
    } else {
      this.renderer.render(scene, this.camera);
    }
  }
}
