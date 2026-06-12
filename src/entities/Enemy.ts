import * as THREE from 'three';
import { enemyScaleRatio } from '../config/game.config';
import {
  enemyMaxHpAt,
  enemyContactDamageAt,
} from '../logic/config/progression';
import { ENEMY_KINDS, type EnemyShape, type EnemyKindConfig } from '../logic/config/enemies';

let _idSeq = 0;

/** 敌人实体（表现层）：按 kind 造型低面数体 + relation 轮廓环 + 相对玩家的等级差体型。 */
export class Enemy {
  readonly id: string;
  readonly object = new THREE.Group();
  level: number;
  hp: number;
  maxHp: number;
  contactDamage: number;
  alive = true;
  prey: boolean;
  readonly kind: EnemyShape;
  readonly kindCfg: EnemyKindConfig;

  private body: THREE.Mesh;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  /** scale=1 时近似碰撞半径 */
  private baseRadius = 0.7;
  private curScale = 1;
  private spinPhase = Math.random() * 10;
  /** 游荡方向（非追逐怪缓慢漂移） */
  private wanderAng = Math.random() * Math.PI * 2;

  constructor(level: number, opts: { prey?: boolean; kind?: EnemyShape } = {}) {
    this.id = `e${_idSeq++}`;
    this.level = level;
    this.maxHp = enemyMaxHpAt(level);
    this.hp = this.maxHp;
    this.contactDamage = enemyContactDamageAt(level);
    this.prey = opts.prey ?? false;
    this.kind = opts.kind ?? 'critter';
    this.kindCfg = ENEMY_KINDS[this.kind];

    // 按 kind 造型的低面数身体
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.kindCfg.body,
      roughness: 0.6,
      flatShading: true,
    });
    this.body = new THREE.Mesh(this.buildGeometry(this.kind), bodyMat);
    this.body.scale.set(1, 0.85, 1);
    this.body.position.y = 0.5;
    this.body.castShadow = true;
    this.object.add(this.body);

    // 凶猛种类加角
    if (this.kind === 'brute' || this.kind === 'wyrm') {
      const accMat = new THREE.MeshStandardMaterial({ color: this.kindCfg.accent, flatShading: true });
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), accMat);
        horn.position.set(0.18 * sx, 0.86, 0.18);
        horn.rotation.x = -0.4;
        this.object.add(horn);
      }
    }

    // 眼睛
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x101418 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
      eye.position.set(0.15 * sx, 0.58, 0.45);
      this.object.add(eye);
    }

    // relation 轮廓环（贴地，随体型等比缩放，不被身体遮挡）
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x4dff7a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 28), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.object.add(this.ring);
  }

  private buildGeometry(shape: EnemyShape): THREE.BufferGeometry {
    switch (shape) {
      case 'blob': return new THREE.SphereGeometry(0.5, 8, 6);
      case 'critter': return new THREE.IcosahedronGeometry(0.55, 1);
      case 'beast': return new THREE.DodecahedronGeometry(0.6, 0);
      case 'brute': return new THREE.IcosahedronGeometry(0.7, 0);
      case 'wyrm': return new THREE.ConeGeometry(0.5, 1.2, 6);
      default: return new THREE.IcosahedronGeometry(0.55, 1);
    }
  }

  get radius(): number {
    return this.baseRadius * this.curScale;
  }

  get labelOffsetY(): number {
    return this.baseRadius * 2.0 * this.curScale + 0.3;
  }

  /** 依据玩家体型与等级差设置自身体型 */
  applySizing(playerScale: number, playerLevel: number): void {
    const ratio = enemyScaleRatio(this.level - playerLevel);
    this.curScale = playerScale * ratio;
    this.object.scale.setScalar(this.curScale);
  }

  setRelationColor(color: number): void {
    this.ringMat.color.setHex(color);
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return true;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return !this.alive;
  }

  update(dt: number, playerPos?: THREE.Vector3, islandRadius = 110): void {
    this.spinPhase += dt;
    this.body.rotation.y = Math.sin(this.spinPhase * 1.5) * 0.15;

    const cfg = this.kindCfg;
    const p = this.object.position;
    if (cfg.chaser && playerPos) {
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1 && dist < cfg.aggro) {
        const sp = cfg.speed * dt;
        p.x += (dx / dist) * sp;
        p.z += (dz / dist) * sp;
        this.object.rotation.y = Math.atan2(dx, dz);
      }
    } else if (!cfg.chaser && cfg.shape !== 'wyrm') {
      // 弱怪缓慢游荡
      this.wanderAng += (Math.random() - 0.5) * dt;
      p.x += Math.cos(this.wanderAng) * 1.2 * dt;
      p.z += Math.sin(this.wanderAng) * 1.2 * dt;
    }
    const d = Math.hypot(p.x, p.z);
    if (d > islandRadius - 3) {
      const s = (islandRadius - 3) / d;
      p.x *= s; p.z *= s;
    }
  }

  dispose(): void {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
