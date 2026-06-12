import * as THREE from 'three';
import { FX_CONFIG } from '../config/game.config';

interface Chunk {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  state: 'burst' | 'home';
  t: number;
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  maxR: number;
}

/**
 * 吞噬/进化特效（表现层 · DevourFx）。
 * 击败怪 → 肉块迸射后吸入玩家（吸收脉冲）；进化 → 金色光环扩散。
 * 命中/吸收的数值在逻辑层，本模块只做表现。详见 specs/systems/DevourSystem.spec.md。
 */
export class FxSystem {
  private scene: THREE.Scene;
  private chunks: Chunk[] = [];
  private rings: Ring[] = [];
  private chunkGeo = new THREE.IcosahedronGeometry(0.12, 0);
  /** 吸收回调：肉块到达玩家时触发（用于体型脉冲） */
  onAbsorb?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 在 pos 处迸出肉块，随后吸入由 getTarget() 返回的位置 */
  devourBurst(pos: THREE.Vector3, color = FX_CONFIG.devour.chunkColor): void {
    const cfg = FX_CONFIG.devour;
    for (let i = 0; i < cfg.chunkCount; i++) {
      const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
      const mesh = new THREE.Mesh(this.chunkGeo, mat);
      mesh.position.copy(pos);
      const ang = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 3;
      mesh.position.y += 0.4;
      this.scene.add(mesh);
      this.chunks.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(ang) * cfg.burstSpeed, up, Math.sin(ang) * cfg.burstSpeed),
        state: 'burst',
        t: 0,
      });
    }
  }

  /** 进化金环 */
  evolutionRing(pos: THREE.Vector3, baseRadius: number): void {
    const cfg = FX_CONFIG.evolution;
    const mat = new THREE.MeshBasicMaterial({
      color: cfg.ringColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 32), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.1, pos.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, mat, age: 0, life: cfg.ringDuration, maxR: baseRadius * cfg.ringMaxRadius });
  }

  update(dt: number, target: THREE.Vector3): void {
    const cfg = FX_CONFIG.devour;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      c.t += dt;
      if (c.state === 'burst') {
        c.vel.y -= 20 * dt; // 重力
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += dt * 6;
        c.mesh.rotation.y += dt * 5;
        if (c.t >= cfg.burstHold) c.state = 'home';
      } else {
        const dir = target.clone().sub(c.mesh.position);
        const d = dir.length();
        if (d < 0.5) {
          this.scene.remove(c.mesh);
          (c.mesh.material as THREE.Material).dispose();
          this.chunks.splice(i, 1);
          this.onAbsorb?.();
          continue;
        }
        dir.normalize();
        c.mesh.position.addScaledVector(dir, cfg.homeSpeed * dt);
        const s = Math.max(0.3, Math.min(1, d / 4));
        c.mesh.scale.setScalar(s);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = r.age / r.life;
      const radius = 0.6 + k * r.maxR;
      r.mesh.scale.setScalar(radius / 0.75);
      r.mat.opacity = Math.max(0, 0.9 * (1 - k));
      if (r.age >= r.life) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.chunks.forEach((c) => { this.scene.remove(c.mesh); (c.mesh.material as THREE.Material).dispose(); });
    this.rings.forEach((r) => { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mat.dispose(); });
    this.chunks = [];
    this.rings = [];
    this.chunkGeo.dispose();
  }
}
