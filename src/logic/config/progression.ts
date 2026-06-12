/**
 * 成长曲线（逻辑层）。参数从 src/config/data/progression.json 加载。
 * 纯数据/纯函数，零 three/DOM 依赖。
 */
import data from '../../config/data/progression.json';

export const MIN_LEVEL = data.minLevel;
export const MAX_LEVEL = data.maxLevel;

/** 从 level 升到 level+1 所需经验 */
export function expToNext(level: number): number {
  return Math.round(data.expToNext.base + level * data.expToNext.perLevel);
}

/** 吞噬一个 enemyLevel 的怪获得的经验（吃同级/略高收益更高） */
export function expReward(playerLevel: number, enemyLevel: number): number {
  const diff = enemyLevel - playerLevel;
  const r = data.expReward;
  const bonus = diff >= 0
    ? 1 + diff * r.highBonusPerDiff
    : Math.max(r.minLowFactor, 1 + diff * r.lowPenaltyPerDiff);
  return Math.max(1, Math.round((r.base + enemyLevel * r.perEnemyLevel) * bonus));
}

/** 玩家某等级的最大生命 */
export function maxHpAt(level: number): number {
  return Math.round(data.playerHp.base + level * data.playerHp.perLevel);
}

/** 敌人某等级的最大生命 */
export function enemyMaxHpAt(level: number): number {
  return Math.round(data.enemyHp.base + level * data.enemyHp.perLevel);
}

/** 敌人某等级的接触伤害（用于红怪反伤） */
export function enemyContactDamageAt(level: number): number {
  return Math.round(data.enemyContactDamage.base + level * data.enemyContactDamage.perLevel);
}
