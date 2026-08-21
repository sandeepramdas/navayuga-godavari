/**
 * SceneDirector.ts — owns renderer, world, camera rig and the ONE master GSAP
 * timeline. ScrollTrigger only writes a target progress; a damped follower in
 * the render loop drives `tl.progress()` so the scrub stays buttery on jittery
 * trackpads. All construction animation is uniform-driven through BuildState.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

import { CameraRig } from './CameraRig';
import { PostFX } from './PostFX';
import { detectTier, settingsFor, FpsGovernor, type QualitySettings, type Tier } from './Quality';
import { hudStore } from './store';
import { createBuildState, type BuildState } from '../world/BuildState';
import { Environment } from '../world/Environment';
import { Terrain } from '../world/Terrain';
import { Water } from '../world/Water';
import { Spillway } from '../world/Spillway';
import { Gates } from '../world/Gates';
import { DiaphragmWall } from '../world/DiaphragmWall';
import { Cofferdams } from '../world/Cofferdams';
import { ECRFDam } from '../world/ECRFDam';
import { Powerhouse } from '../world/Powerhouse';
import { Cranes } from '../world/Cranes';
import { Particles } from '../world/Particles';
import { sections } from '../data/projectData';
import { L } from '../world/layout';

gsap.registerPlugin(ScrollTrigger);

const DUR = 100; // master timeline length in abstract seconds

interface CamKey {
  /** absolute position on the master timeline, 0..1 */
  at: number;
  dur: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  drift?: number;
  ease?: string;
}

/** camera choreography — S1 top-down river → … → S8 crane-up reveal */
const CAM_KEYS: CamKey[] = [
  { at: 0.0, dur: 0.1, pos: [130, 430, 330], look: [-40, 0, -220], fov: 52 }, // S1 high drift over the river
  { at: 0.1, dur: 0.09, pos: [-360, 130, 40], look: [-80, -45, -260], fov: 44, drift: 0.4 }, // S2 sweep down to the wall line
  { at: 0.22, dur: 0.09, pos: [-500, 190, 540], look: [0, 0, -40], fov: 50 }, // S3 wide establishing
  { at: 0.34, dur: 0.08, pos: [-390, 100, 340], look: [0, 26, 0], fov: 46 }, // S4 into the pier field…
  { at: 0.42, dur: 0.08, pos: [330, 150, 380], look: [0, 30, 0], fov: 46 }, // …slow orbit across
  { at: 0.5, dur: 0.05, pos: [-440, 42, 165], look: [-300, 27, 12], fov: 34, drift: 0.5 }, // S5 gate line, long lens
  { at: 0.55, dur: 0.07, pos: [440, 46, 165], look: [330, 27, 12], fov: 34, drift: 0.5, ease: 'none' }, // truck past the battery
  { at: 0.62, dur: 0.1, pos: [700, 240, 460], look: [850, 14, -30], fov: 48 }, // S6 boom over the ECRF
  { at: 0.74, dur: 0.08, pos: [-450, 74, 340], look: [-620, 28, 145], fov: 38, drift: 0.6 }, // S7 powerhouse focus
  { at: 0.84, dur: 0.07, pos: [-140, 70, 520], look: [0, 26, 40], fov: 48 }, // S8 settle low…
  { at: 0.92, dur: 0.08, pos: [30, 170, 640], look: [0, 38, -60], fov: 48 }, // …then crane up & pull back on the full battery
];

export class SceneDirector {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private rig: CameraRig;
  private postfx: PostFX;
  private q: QualitySettings;
  private governor: FpsGovernor;
  private clock = new THREE.Clock();
  private state: BuildState;
  private tl: gsap.core.Timeline;
  private target = 0;
  private progress = 0;
  private pinStart = 0;
  private pinEnd = 1;
  private ndc = new THREE.Vector2(-2, -2);
  private groundHit = new THREE.Vector3();

  private env: Environment;
  private terrain: Terrain;
  private water: Water;
  private spillway: Spillway;
  private gates: Gates;
  private dwall: DiaphragmWall;
  private coffers: Cofferdams;
  private ecrf: ECRFDam;
  private powerhouse: Powerhouse;
  private cranes: Cranes;
  private particles: Particles;

  constructor(container: HTMLElement, private lenis: Lenis | null, onReady: () => void) {
    this.q = settingsFor(detectTier());

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(this.q.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.52; // physical Sky needs low exposure; graded up at golden hour
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x04121c); // the void behind the X-ray beat
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.state = createBuildState();

    // world
    this.env = new Environment(this.scene, this.renderer, this.q.shadowMapSize);
    this.terrain = new Terrain(this.scene, this.q.terrainSegments);
    this.water = new Water(this.scene);
    this.spillway = new Spillway(this.scene);
    this.gates = new Gates(this.scene, (i) => this.spillway.bayX(i));
    this.dwall = new DiaphragmWall(this.scene);
    this.coffers = new Cofferdams(this.scene);
    this.ecrf = new ECRFDam(this.scene, this.renderer);
    this.powerhouse = new Powerhouse(this.scene);
    this.cranes = new Cranes(this.scene);
    this.particles = new Particles(this.scene, this.q.particleScale, this.q.pixelRatio, this.gates.trunnions);

    this.postfx = new PostFX(this.renderer, this.scene, this.rig.camera, {
      bloom: this.q.bloom,
      grain: this.q.grain,
    });

    this.governor = new FpsGovernor(this.q.tier, (t) => this.degrade(t));

    this.tl = this.buildTimeline();
    this.setupScroll();
    this.bindPointer();

    addEventListener('resize', this.onResize);

    // pre-compile shaders, then release the loader
    this.renderer.compile(this.scene, this.rig.camera);
    this.renderLoop(0);
    requestAnimationFrame(() => onReady());
    this.clock.start();
    gsap.ticker.add(this.tick);
  }

  // ---------------- timeline ----------------

  private buildTimeline(): gsap.core.Timeline {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const s = this.state;
    const at = (p: number): number => p * DUR;
    const span = (a: number, b: number): number => (b - a) * DUR;

    // -- S2 · diaphragm wall (blueprint X-ray)
    tl.to(s, { xray: 1, duration: span(0.1, 0.125), ease: 'power2.inOut' }, at(0.1));
    tl.to(s, { wall: 1, duration: span(0.125, 0.185) }, at(0.125));
    // flood setback flicker, then re-seat
    tl.to(s, { setback: 1, duration: span(0.185, 0.198), ease: 'power2.in' }, at(0.185));
    tl.to(s, { setback: 0, duration: span(0.198, 0.215), ease: 'power2.out' }, at(0.198));
    tl.to(s, { xray: 0, duration: span(0.215, 0.24), ease: 'power2.inOut' }, at(0.215));

    // -- S3 · cofferdams & dewatering
    tl.to(s, { coffer: 1, duration: span(0.22, 0.29) }, at(0.22));
    tl.to(s, { dewater: 1, duration: span(0.27, 0.34), ease: 'power2.inOut' }, at(0.27));

    // -- S4 · piers (+cranes, dust, deck)
    tl.to(s, { cranes: 1, duration: span(0.34, 0.37) }, at(0.34));
    tl.to(s, { dust: 0.85, duration: span(0.34, 0.38), ease: 'power1.inOut' }, at(0.34));
    tl.to(s, { piers: 1, duration: span(0.35, 0.47), ease: 'power2.inOut' }, at(0.35));
    tl.to(s, { deck: 1, duration: span(0.46, 0.5) }, at(0.46));

    // -- S5 · radial gates (+sparks)
    tl.to(s, { gates: 1, duration: span(0.51, 0.61), ease: 'power2.inOut' }, at(0.51));
    tl.to(s, { sparks: 1, duration: span(0.52, 0.55), ease: 'power1.in' }, at(0.52));
    tl.to(s, { sparks: 0, duration: span(0.59, 0.62), ease: 'power1.out' }, at(0.59));

    // -- S6 · ECRF dam
    tl.to(s, { ecrf: 1, duration: span(0.63, 0.74), ease: 'power1.inOut' }, at(0.63));
    tl.to(s, { dust: 0.35, duration: span(0.62, 0.68), ease: 'none' }, at(0.62));

    // -- S7 · powerhouse, cranes strike
    tl.to(s, { power: 1, duration: span(0.75, 0.83), ease: 'power2.inOut' }, at(0.75));
    tl.to(s, { dust: 0, duration: span(0.74, 0.78), ease: 'none' }, at(0.74));
    tl.to(s, { cranes: 0, duration: span(0.8, 0.84) }, at(0.8));

    // -- S8 · golden hour, reservoir fills, gates open, flood
    tl.to(s, { golden: 1, duration: span(0.84, 0.93), ease: 'power1.inOut' }, at(0.84));
    tl.to(s, { waterUp: L.frlLevel, duration: span(0.84, 0.91), ease: 'power1.inOut' }, at(0.84));
    tl.to(s, { gateOpen: 1, duration: span(0.9, 0.97), ease: 'power3.inOut' }, at(0.9));
    tl.to(s, { flood: 1, duration: span(0.91, 0.98), ease: 'power2.inOut' }, at(0.91));

    // -- camera choreography
    for (const k of CAM_KEYS) {
      const ease = k.ease ?? 'power2.inOut';
      tl.to(this.rig.pos, { x: k.pos[0], y: k.pos[1], z: k.pos[2], duration: k.dur * DUR, ease }, at(k.at));
      tl.to(this.rig.look, { x: k.look[0], y: k.look[1], z: k.look[2], duration: k.dur * DUR, ease }, at(k.at));
      tl.to(this.rig, { fov: k.fov, drift: k.drift ?? 1, duration: k.dur * DUR, ease }, at(k.at));
    }

    return tl;
  }

  // ---------------- scroll ----------------

  private setupScroll(): void {
    const st = ScrollTrigger.create({
      trigger: '#experience',
      start: 'top top',
      end: '+=800%',
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      scrub: true,
      onUpdate: (self) => {
        this.target = self.progress;
        this.rig.kick(self.getVelocity() / 4000);
      },
      onRefresh: (self) => {
        this.pinStart = self.start;
        this.pinEnd = self.end;
      },
      onToggle: (self) => {
        hudStore.set({ active: self.isActive });
        document.getElementById('build-progress')?.classList.toggle('on', self.isActive);
      },
    });
    this.pinStart = st.start;
    this.pinEnd = st.end;
  }

  /** scroll the page so the master timeline lands at progress p */
  scrollToProgress(p: number, opts: { immediate?: boolean; duration?: number } = {}): void {
    const y = this.pinStart + p * (this.pinEnd - this.pinStart);
    if (this.lenis) {
      this.lenis.scrollTo(y, opts.immediate ? { immediate: true } : { duration: opts.duration ?? 1.6 });
    } else {
      scrollTo({ top: y, behavior: opts.immediate ? 'auto' : 'smooth' });
    }
    if (opts.immediate) {
      this.target = p;
      this.progress = p;
    }
  }

  /** scroll so the timeline lands early inside section i */
  jumpToSection(i: number): void {
    this.scrollToProgress(sections[i].range[0] + 0.015);
  }

  skipToEnd(): void {
    this.scrollToProgress(0.999, { duration: 2.2 });
  }

  // ---------------- pointer crosshair ----------------

  private bindPointer(): void {
    if (!matchMedia('(pointer: fine)').matches) return;
    document.body.classList.add('xh-on');
    const el = document.getElementById('crosshair');
    const ex = document.getElementById('ch-x');
    const ez = document.getElementById('ch-z');
    if (!el || !ex || !ez) return;
    let raf = 0;
    addEventListener('pointermove', (e) => {
      this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          // analytic ray ∩ water plane — no Raycaster, no allocation
          const cam = this.rig.camera;
          this.groundHit.set(this.ndc.x, this.ndc.y, 0.5).unproject(cam).sub(cam.position).normalize();
          const t = (L.riverLevel - cam.position.y) / this.groundHit.y;
          if (t > 0 && t < 6000) {
            const wx = cam.position.x + this.groundHit.x * t;
            const wz = cam.position.z + this.groundHit.z * t;
            ex.textContent = `E ${String(Math.round(300000 + wx)).padStart(6, '0')}`;
            ez.textContent = `N ${String(Math.round(1900000 - wz)).padStart(7, '0')}`;
          }
        });
      }
    });
  }

  // ---------------- quality ----------------

  private degrade(tier: Tier): void {
    this.q = settingsFor(tier);
    this.renderer.setPixelRatio(this.q.pixelRatio);
    this.postfx.setQuality({ bloom: this.q.bloom, grain: this.q.grain });
    this.postfx.setSize(innerWidth, innerHeight);
  }

  private onResize = (): void => {
    this.rig.resize(innerWidth / innerHeight);
    this.renderer.setSize(innerWidth, innerHeight);
    this.postfx.setSize(innerWidth, innerHeight);
    ScrollTrigger.refresh();
  };

  // ---------------- render loop ----------------

  private tick = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // render only while the hero/experience zone is on screen
    const y = scrollY;
    if (y > this.pinEnd + innerHeight * 1.2) return;

    // damped scrub follower
    this.progress += (this.target - this.progress) * (1 - Math.pow(0.001, dt));
    if (Math.abs(this.target - this.progress) < 0.0004) this.progress = this.target;
    this.tl.progress(this.progress);

    // HUD state
    let sec = -1;
    let secP = 0;
    if (this.progress > 0.0001) {
      for (let i = 0; i < sections.length; i++) {
        const [a, b] = sections[i].range;
        if (this.progress >= a && this.progress <= b) {
          sec = i;
          secP = (this.progress - a) / (b - a);
          break;
        }
      }
      if (sec === -1) sec = sections.length - 1;
    }
    hudStore.set({ progress: this.progress, section: sec, sectionProgress: secP });

    // steady camera while stat cards are counting
    this.rig.drift = Math.min(this.rig.drift, sec >= 0 && secP > 0.25 && secP < 0.75 ? 0.35 : 1);

    // world updates
    this.env.update(this.state);
    this.terrain.setSun(this.env.sunDir, this.env.sunColor, this.env.ambColor);
    this.terrain.update(this.state);
    this.water.setSun(this.env.sunDir);
    this.water.update(this.state, dt);
    this.spillway.update(this.state);
    this.gates.update(this.state);
    this.dwall.update(this.state);
    this.coffers.update(this.state);
    this.ecrf.update(this.state);
    this.powerhouse.update(this.state);
    this.cranes.update(this.state, dt);
    this.particles.update(this.state, dt);

    this.renderer.toneMappingExposure = 0.52 + this.state.golden * 0.2;
    this.postfx.setGolden(this.state.golden);

    this.rig.update(dt);
    this.governor.tick(dt);
    this.postfx.render(this.scene, dt);
  };

  private renderLoop(_t: number): void {
    // first frame drawn synchronously so the loader lifts onto a live scene
    this.postfx.render(this.scene, 0.016);
  }
}
