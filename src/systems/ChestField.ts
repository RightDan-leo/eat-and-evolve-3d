import * as THREE from 'three';
import { ARENA, CHESTS, centerFactor } from '../logic/config/arena';

interface Chest {
  group: THREE.Group;
  lid: THREE.Mesh;
  x: number;
  z: number;
  exp: number;
  open: boolean;
  respawnAt: number;
}

/**
 * 宝箱场（表现层）。散布于岛上，玩家靠近读条 channelMs 后开启给经验，
 * 越靠中心奖励越高；开启后延迟重生。配置见 arena.ts（CHESTS）。
 */
export class ChestField {
  private scene: THREE.Scene;
  private chests: Chest[] = [];
  private seed = 4242;
  private now = 0;
  /** 当前正在读条的宝箱与进度 [0,1] */
  private channeling: Chest | null = null;
  private channelT = 0;
  /** 开箱完成回调（给经验） */
  onOpen?: (exp: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  get channelProgress(): number {
    return this.channeling ? this.channelT / (CHESTS.channelMs / 1000) : 0;
  }

  get isChanneling(): boolean {
    return this.channeling !== null;
  }

  build(): void {
    for (let i = 0; i < CHESTS.count; i++) this.chests.push(this.makeChest());
  }

  private makeChest(): Chest {
    const ang = this.rnd() * Math.PI * 2;
    const r = ARENA.coreRadius * 0.4 + this.rnd() * (ARENA.islandRadius * 0.85 - ARENA.coreRadius * 0.4);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const exp = Math.round(CHESTS.baseExp + centerFactor(x, z) * CHESTS.centerBonusExp);

    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0x6a5210, emissiveIntensity: 0.5, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), baseMat);
    base.position.y = 0.35; base.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 0.85), goldMat);
    lid.position.y = 0.85;
    group.add(base, lid);
    group.position.set(x, 0, z);
    this.scene.add(group);
    return { group, lid, x, z, exp, open: false, respawnAt: 0 };
  }

  update(dt: number, playerPos: THREE.Vector3, playerRadius: number): void {
    this.now += dt;
    // 重生
    for (const c of this.chests) {
      if (c.open && this.now >= c.respawnAt) {
        c.open = false;
        c.group.visible = true;
        c.lid.rotation.x = 0;
      }
      // 漂浮发光
      if (!c.open) c.lid.position.y = 0.85 + Math.sin(this.now * 2 + c.x) * 0.04;
    }

    // 找到玩家范围内最近的可开宝箱
    const reach = playerRadius + CHESTS.radius;
    let target: Chest | null = null;
    let best = reach * reach;
    for (const c of this.chests) {
      if (c.open) continue;
      const dx = c.x - playerPos.x;
      const dz = c.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= best) { best = d2; target = c; }
    }

    if (target !== this.channeling) {
      this.channeling = target;
      this.channelT = 0;
    }
    if (this.channeling) {
      this.channelT += dt;
      // 开盖动画跟随进度
      this.channeling.lid.rotation.x = -this.channelProgress * 1.2;
      if (this.channelT >= CHESTS.channelMs / 1000) {
        const c = this.channeling;
        c.open = true;
        c.group.visible = false;
        c.respawnAt = this.now + CHESTS.respawnDelayMs / 1000;
        this.onOpen?.(c.exp);
        this.channeling = null;
        this.channelT = 0;
      }
    }
  }

  /** 返回当前读条宝箱的世界坐标（供 HUD/标签定位） */
  get channelPos(): THREE.Vector3 | null {
    return this.channeling ? new THREE.Vector3(this.channeling.x, 1.4, this.channeling.z) : null;
  }

  reset(): void {
    this.channeling = null;
    this.channelT = 0;
    for (const c of this.chests) {
      c.open = false;
      c.group.visible = true;
      c.lid.rotation.x = 0;
    }
  }

  dispose(): void {
    this.chests.forEach((c) => {
      c.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      this.scene.remove(c.group);
    });
    this.chests = [];
  }
}
