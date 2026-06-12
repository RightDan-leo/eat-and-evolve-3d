import { ARENA, SPAWN, centerFactor } from '../config/arena';
import { kindForLevel, type EnemyShape } from '../config/enemies';
import { MAX_LEVEL } from '../config/progression';

/**
 * SpawnSystem（逻辑层）。负责"刷什么怪/什么等级/在哪"的决策，纯计算 + 注入 rng，
 * 零 three/DOM。实体创建与入场由表现层（GameScene）执行。移植自 2D balance.ts 刷怪逻辑。
 */

export interface SpawnRequest {
  level: number;
  kind: EnemyShape;
  x: number;
  z: number;
  prey: boolean;
}

type Rng = () => number;

/** 离中心越近等级越高（按位置分区难度） */
export function levelForPosition(x: number, z: number): number {
  const t = centerFactor(x, z);
  const base = ARENA.difficulty.edgeLevel + t * (ARENA.difficulty.centerLevel - ARENA.difficulty.edgeLevel);
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(base)));
}

function pickOffset(rng: Rng): number {
  const total = SPAWN.levelWeights.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  for (const w of SPAWN.levelWeights) {
    r -= w.weight;
    if (r <= 0) return w.offset;
  }
  return 0;
}

/**
 * 刷怪等级：以玩家等级为中心抽样（偏向略低=可吃），越靠中心略强，
 * 硬性限制不超过 玩家+maxLeadAbovePlayer。
 */
export function spawnLevelNearPlayer(playerLevel: number, x: number, z: number, rng: Rng): number {
  const offset = pickOffset(rng);
  const centerLead = Math.round(centerFactor(x, z) * SPAWN.centerLeadMax);
  const jitter = Math.round((rng() * 2 - 1) * ARENA.difficulty.jitter);
  const cap = Math.min(MAX_LEVEL, playerLevel + SPAWN.maxLeadAbovePlayer);
  return Math.max(1, Math.min(cap, playerLevel + offset + centerLead + jitter));
}

/** 在玩家周围环带内取一个落点（钳制在岛内） */
export function spawnPositionAround(px: number, pz: number, near: boolean, rng: Rng): { x: number; z: number } {
  const ang = rng() * Math.PI * 2;
  const r = near
    ? SPAWN.spawnRadiusMin + rng() * 8
    : SPAWN.spawnRadiusMin + rng() * (SPAWN.spawnRadiusMax - SPAWN.spawnRadiusMin);
  let x = px + Math.cos(ang) * r;
  let z = pz + Math.sin(ang) * r;
  const d = Math.hypot(x, z);
  if (d > ARENA.islandRadius - 4) {
    const s = (ARENA.islandRadius - 4) / d;
    x *= s; z *= s;
  }
  return { x, z };
}

/** 生成一次刷怪请求 */
export function makeSpawnRequest(playerLevel: number, px: number, pz: number, near: boolean, rng: Rng): SpawnRequest {
  const { x, z } = spawnPositionAround(px, pz, near, rng);
  const level = spawnLevelNearPlayer(playerLevel, x, z, rng);
  const prey = near && level <= playerLevel;
  return { level, kind: kindForLevel(level), x, z, prey };
}

/** 开局在玩家出生点周围布置的弱猎物 */
export function starterPreyRequests(playerLevel: number, px: number, pz: number, rng: Rng): SpawnRequest[] {
  const out: SpawnRequest[] = [];
  for (let i = 0; i < SPAWN.starterPrey.count; i++) {
    const ang = (i / SPAWN.starterPrey.count) * Math.PI * 2 + rng() * 0.5;
    const r = SPAWN.starterPrey.minRadius + rng() * SPAWN.starterPrey.spread;
    const level = Math.max(1, playerLevel - 1);
    let x = px + Math.cos(ang) * r;
    let z = pz + Math.sin(ang) * r;
    const d = Math.hypot(x, z);
    if (d > ARENA.islandRadius - 4) {
      const s = (ARENA.islandRadius - 4) / d;
      x *= s; z *= s;
    }
    out.push({ level, kind: kindForLevel(level), x, z, prey: true });
  }
  return out;
}
