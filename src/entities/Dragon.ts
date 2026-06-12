import * as THREE from 'three';
import { createHatchling, buildCreature } from './Hatchling';
import { SIZE_BY_LEVEL, sampleByLevel } from '../config/game.config';
import {
  MIN_LEVEL,
  MAX_LEVEL,
  expToNext,
  maxHpAt,
} from '../logic/config/progression';

/** 玩家实体（表现层）：包装模型 + 等级/HP/经验/体型。详见 specs/entities/Dragon.spec.md */
export class Dragon {
  readonly object = new THREE.Group();
  private inner: THREE.Object3D | null = null;
  modelSource = '...';

  level = MIN_LEVEL;
  exp = 0;
  hp: number;
  maxHp: number;
  alive = true;

  /** 程序化幼兽在 scale=1 时的近似碰撞半径 */
  private baseRadius = 0.7;
  private curScale = 1;
  private bobPhase = Math.random() * 10;
  /** 进化/吸收的临时体型脉冲（叠加在 curScale 上，自动衰减） */
  private punch = 0;
  private isGlb = false;

  constructor() {
    this.maxHp = maxHpAt(this.level);
    this.hp = this.maxHp;
    this.curScale = sampleByLevel(SIZE_BY_LEVEL, this.level, 'scale');
    this.object.scale.setScalar(this.curScale);
  }

  static async create(glbUrl?: string): Promise<Dragon> {
    const d = new Dragon();
    d.inner = await createHatchling(glbUrl);
    d.modelSource = (d.inner.userData.source as string) ?? 'unknown';
    d.isGlb = d.modelSource === 'glb';
    d.object.add(d.inner);
    return d;
  }

  /** 形态进化：用新形态/分支配色重建模型（GLB 资源暂仅做体型 punch）。 */
  applyForm(body: number, accent: number, tier: number): void {
    if (!this.isGlb) {
      if (this.inner) this.object.remove(this.inner);
      this.inner = buildCreature({ body, accent, tier });
      this.object.add(this.inner);
    }
    this.punch = Math.max(this.punch, 0.35);
  }

  /** 吸收肉块时的小脉冲 */
  absorbPulse(amount = 0.12): void {
    this.punch = Math.min(0.5, this.punch + amount);
  }

  /** 当前世界碰撞半径 */
  get radius(): number {
    return this.baseRadius * this.curScale;
  }

  /** 头顶标签世界偏移（随体型升高） */
  get labelOffsetY(): number {
    return this.baseRadius * 2.2 * this.curScale + 0.4;
  }

  /** 累计经验，返回本次提升的等级数 */
  addExp(amount: number): number {
    if (!this.alive) return 0;
    this.exp += amount;
    let gained = 0;
    while (this.level < MAX_LEVEL && this.exp >= expToNext(this.level)) {
      this.exp -= expToNext(this.level);
      this.level++;
      gained++;
    }
    if (gained > 0) {
      this.maxHp = maxHpAt(this.level);
      this.hp = this.maxHp; // 升级回满血（吞噬变强的爽点）
    }
    return gained;
  }

  /** 受伤，返回是否死亡 */
  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return !this.alive;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return !this.alive;
  }

  /** 每帧：体型向目标曲线平滑 + 漂浮呼吸 + punch 衰减 */
  update(dt: number): void {
    const want = sampleByLevel(SIZE_BY_LEVEL, this.level, 'scale');
    this.curScale += (want - this.curScale) * (1 - Math.exp(-3 * dt));
    this.punch *= Math.exp(-8 * dt);
    if (this.punch < 0.002) this.punch = 0;
    this.object.scale.setScalar(this.curScale * (1 + this.punch));
    if (this.inner) {
      this.bobPhase += dt;
      this.inner.position.y = Math.sin(this.bobPhase * 4) * 0.05;
    }
  }

  /** 朝移动方向转身 */
  faceDir(dirX: number, dirZ: number, dt: number): void {
    const yaw = Math.atan2(dirX, dirZ);
    let d = yaw - this.object.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.object.rotation.y += d * (1 - Math.exp(-10 * dt));
  }

  get scale(): number {
    return this.curScale;
  }

  reset(): void {
    this.level = MIN_LEVEL;
    this.exp = 0;
    this.maxHp = maxHpAt(this.level);
    this.hp = this.maxHp;
    this.alive = true;
    this.curScale = sampleByLevel(SIZE_BY_LEVEL, this.level, 'scale');
    this.punch = 0;
    this.object.scale.setScalar(this.curScale);
    this.object.position.set(0, 0, 0);
    this.object.rotation.set(0, 0, 0);
  }
}
