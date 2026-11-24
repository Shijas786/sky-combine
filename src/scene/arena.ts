import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const SKY = 0x00aeef;
export const HOSTILE = 0xff3d6e;
export const GOLD = 0xffd166;

export interface Target {
  group: THREE.Group;
  radius: number;
  kind: string;
  age: number;
  dying: number;
  core: THREE.Mesh;
  ring: THREE.Mesh;
}

interface Particle {
  v: THREE.Vector3;
  life: number;
  max: number;
}

const PARTICLES = 600;

export class Arena {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  readonly targets: Target[] = [];
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private raycaster = new THREE.Raycaster();
  private grid: THREE.Mesh;
  private gridUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(SKY) }, uPulse: { value: 0 } };
  private clouds: THREE.Points;
  private rings: THREE.Mesh[] = [];
  private pGeo = new THREE.BufferGeometry();
  private pPos = new Float32Array(PARTICLES * 3);
  private pCol = new Float32Array(PARTICLES * 3);
  private pData: Particle[] = [];
  private pNext = 0;
  private shakeAmt = 0;
  private mood = new THREE.Color(SKY);
  private moodTarget = new THREE.Color(SKY);
  private time = 0;
  private drift = 1;
  private coreGeo = new THREE.IcosahedronGeometry(1, 1);
  private ringGeo = new THREE.TorusGeometry(1.5, 0.05, 8, 48);

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0x030611);
    this.scene.fog = new THREE.FogExp2(0x030611, 0.018);
    this.camera.position.set(0, 2.2, 12);
    this.camera.lookAt(0, 2.2, 0);

    this.scene.add(new THREE.AmbientLight(0x4466aa, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 10, 8);
    this.scene.add(key);

    this.grid = this.buildGrid();
    this.scene.add(this.grid);
    this.clouds = this.buildClouds();
    this.scene.add(this.clouds);
    this.buildGates();

    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    for (let i = 0; i < PARTICLES; i++) {
      this.pData.push({ v: new THREE.Vector3(), life: 0, max: 1 });
      this.pPos[i * 3 + 1] = -999;
    }
    const pMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(this.pGeo, pMat);
    points.frustumCulled = false;
    this.scene.add(points);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.7, 0.18);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private buildGrid(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.gridUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; uniform float uPulse; varying vec3 vPos;
        float line(float v, float w){ float f = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(f / w, 1.0); }
        void main(){
          vec2 p = vPos.xy; p.y += uTime * 3.0;
          float g = max(line(p.x / 2.0, 1.2), line(p.y / 2.0, 1.2));
          float d = length(vPos.xy);
          float wave = smoothstep(2.5, 0.0, abs(d - mod(uTime * 14.0, 90.0))) * 0.6;
          float fade = smoothstep(95.0, 8.0, d);
          vec3 c = uColor * (g * (0.55 + uPulse) + wave * g * 2.0) + uColor * 0.035;
          gl_FragColor = vec4(c * fade, fade * (g * 0.9 + 0.12));
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -2.5;
    return mesh;
  }

  private buildClouds(): THREE.Points {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 40 - 4;
      pos[i * 3 + 2] = -Math.random() * 120 + 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(160,220,255,0.35)');
    grad.addColorStop(1, 'rgba(160,220,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({
      size: 0.9, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9fdcff,
    });
    return new THREE.Points(geo, mat);
  }

  private buildGates(): void {
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.TorusGeometry(15 + i * 0.6, 0.07, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.5 - i * 0.05 });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(0, 3, -14 - i * 13);
      ring.rotation.z = i * 0.26;
      this.rings.push(ring);
      this.scene.add(ring);
    }
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Half-extent of the visible play plane at z = 0. */
  bounds(): { x: number; y: number; cy: number } {
    const dist = this.camera.position.z;
    const y = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist;
    return { x: y * this.camera.aspect, y, cy: this.camera.position.y };
  }

  spawn(kind: string, pos: THREE.Vector3, radius: number, color: number): Target {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      this.coreGeo,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.4, flatShading: true }),
    );
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    group.add(core, ring);
    group.position.copy(pos);
    group.scale.setScalar(0.001);
    this.scene.add(group);
    const target: Target = { group, radius, kind, age: 0, dying: 0, core, ring };
    this.targets.push(target);
    return target;
  }

  remove(target: Target, burst = false): void {
    const i = this.targets.indexOf(target);
    if (i < 0) return;
    this.targets.splice(i, 1);
    if (burst) {
      const color = (target.core.material as THREE.MeshStandardMaterial).color.getHex();
      this.burst(target.group.position, color, 46);
      this.shake(0.22);
    }
    this.scene.remove(target.group);
    (target.core.material as THREE.Material).dispose();
    (target.ring.material as THREE.Material).dispose();
  }

  clearTargets(): void {
    [...this.targets].forEach((t) => this.remove(t));
  }

  /** Nearest live target under the pointer (ndc -1..1), with a little aim forgiveness. */
  pick(ndcX: number, ndcY: number, slack = 1.12): Target | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const ray = this.raycaster.ray;
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      const d = ray.distanceToPoint(t.group.position);
      if (d <= t.radius * slack && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  /** World point on the z = 0 play plane under the pointer. */
  pointAt(ndcX: number, ndcY: number): THREE.Vector3 {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const out = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), out);
    return out;
  }

  project(pos: THREE.Vector3): { x: number; y: number } {
    const v = pos.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  burst(pos: THREE.Vector3, color: number, count = 30, speed = 9): void {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.pNext;
      this.pNext = (this.pNext + 1) % PARTICLES;
      const p = this.pData[i];
      p.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
      p.life = p.max = 0.45 + Math.random() * 0.5;
      this.pPos.set([pos.x, pos.y, pos.z], i * 3);
      const k = 0.6 + Math.random() * 0.8;
      this.pCol.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  pulse(amount = 1): void {
    this.gridUniforms.uPulse.value = Math.max(this.gridUniforms.uPulse.value, amount);
  }

  setMood(color: number, drift = 1): void {
    this.moodTarget.set(color);
    this.drift = drift;
  }

  update(dt: number): void {
    this.time += dt;
    this.gridUniforms.uTime.value += dt * this.drift;
    this.gridUniforms.uPulse.value *= Math.exp(-dt * 4);
    this.mood.lerp(this.moodTarget, 1 - Math.exp(-dt * 5));
    this.gridUniforms.uColor.value.copy(this.mood);

    const cp = this.clouds.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      let z = cp.getZ(i) + dt * 5 * this.drift;
      if (z > 14) z -= 134;
      cp.setZ(i, z);
    }
    cp.needsUpdate = true;

    this.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.08 + i * 0.02) * (i % 2 ? -1 : 1) * this.drift;
      (r.material as THREE.MeshBasicMaterial).color.copy(this.mood);
    });

    for (const t of this.targets) {
      t.age += dt;
      const grow = Math.min(1, t.age / 0.14);
      const s = t.radius * (1 - Math.pow(1 - grow, 3)) * (1 + Math.sin(t.age * 7) * 0.03);
      t.group.scale.setScalar(Math.max(0.001, s));
      t.core.rotation.x += dt * 1.6;
      t.core.rotation.y += dt * 2.3;
      t.ring.rotation.z -= dt * 1.4;
      t.ring.lookAt(this.camera.position);
    }

    for (let i = 0; i < PARTICLES; i++) {
      const p = this.pData[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      const o = i * 3;
      if (p.life <= 0) {
        this.pPos[o + 1] = -999;
        continue;
      }
      p.v.multiplyScalar(Math.exp(-dt * 2.4));
      p.v.y -= dt * 3;
      this.pPos[o] += p.v.x * dt;
      this.pPos[o + 1] += p.v.y * dt;
      this.pPos[o + 2] += p.v.z * dt;
      const f = Math.exp(-dt * 3);
      this.pCol[o] *= f;
      this.pCol[o + 1] *= f;
      this.pCol[o + 2] *= f;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;

    this.shakeAmt *= Math.exp(-dt * 9);
    const sway = Math.sin(this.time * 0.35) * 0.25;
    this.camera.position.set(
      sway + (Math.random() - 0.5) * this.shakeAmt,
      2.2 + Math.cos(this.time * 0.27) * 0.12 + (Math.random() - 0.5) * this.shakeAmt,
      12,
    );
    this.camera.lookAt(sway * 0.4, 2.2, 0);
    this.composer.render();
  }
}
