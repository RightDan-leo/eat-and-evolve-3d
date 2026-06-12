import * as THREE from 'three';
import { buildCreature } from './Hatchling';
import type { TitanDef } from '../logic/config/endgame';

/** 双子泰坦实体（表现层）。巨型程序化龙 + 头顶血条环；可被吞噬（紫）或不可（红）。 */
export class Titan {
  readonly object = new THREE.Group();
  readonly def: TitanDef;
  hp: number;
  maxHp: number;
  contactDamage: number;
  alive = true;
  immune: boolean;

  private inner: THREE.Group;
  private bobPhase = Math.random() * 10;

  constructor(def: TitanDef, opts: { maxHp: number; contactDamage: number; immune: boolean }) {
    this.def = def;
    this.maxHp = opts.maxHp;
    this.hp = opts.maxHp;
    this.contactDamage = opts.contactDamage;
    this.immune = opts.immune;

    this.inner = buildCreature({ body: def.body, accent: def.accent, tier: 4 });
    this.object.add(this.inner);
    this.object.scale.setScalar(def.scale);

    // 邪能光环
    const auraMat = new THREE.MeshBasicMaterial({ color: def.body, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 32), auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    this.inner.add(aura);
  }

  get radius(): number {
    return 0.7 * this.def.scale;
  }

  get labelOffsetY(): number {
    return 1.6 * this.def.scale + 0.5;
  }

  takeDamage(amount: number): boolean {
    if (this.immune || !this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return !this.alive;
  }

  update(dt: number): void {
    this.bobPhase += dt;
    this.inner.position.y = Math.sin(this.bobPhase * 2) * 0.08;
    this.inner.rotation.y += dt * 0.2;
  }

  dispose(): void {
    this.object.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  }
}
