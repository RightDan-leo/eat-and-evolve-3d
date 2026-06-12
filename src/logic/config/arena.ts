/**
 * 环形岛 / 刷怪 / 宝箱 / 环境 配置（逻辑层）。从 src/config/data/arena.json 加载。
 * 适配 3D 圆形岛：以「离中心距离」决定难度，中心最强。
 */
import data from '../../config/data/arena.json';

export const ARENA = {
  islandRadius: data.arena.islandRadius,
  coreRadius: data.arena.coreRadius,
  midRadius: data.arena.midRadius,
  difficulty: {
    edgeLevel: data.arena.difficulty.edgeLevel,
    centerLevel: data.arena.difficulty.centerLevel,
    jitter: data.arena.difficulty.jitter,
  },
};

export const SPAWN = {
  maxAlive: data.spawn.maxAlive,
  spawnRadiusMin: data.spawn.spawnRadiusMin,
  spawnRadiusMax: data.spawn.spawnRadiusMax,
  recycleRadius: data.spawn.recycleRadius,
  centerLeadMax: data.spawn.centerLeadMax,
  maxLeadAbovePlayer: data.spawn.maxLeadAbovePlayer,
  levelWeights: data.spawn.levelWeights as Array<{ offset: number; weight: number }>,
  starterPrey: {
    count: data.spawn.starterPrey.count,
    spread: data.spawn.starterPrey.spread,
    minRadius: data.spawn.starterPrey.minRadius,
  },
};

export const CHESTS = {
  count: data.chests.count,
  radius: data.chests.radius,
  baseExp: data.chests.baseExp,
  centerBonusExp: data.chests.centerBonusExp,
  respawnDelayMs: data.chests.respawnDelayMs,
  channelMs: data.chests.channelMs,
};

export const ENV = {
  trees: data.env.trees,
  rocks: data.env.rocks,
  mountains: data.env.mountains,
  beacon: data.env.beacon,
};

/** 中心强度系数 [0,1]：0=边缘，1=正中心。 */
export function centerFactor(x: number, z: number): number {
  const d = Math.hypot(x, z);
  return Math.max(0, Math.min(1, 1 - d / ARENA.islandRadius));
}
