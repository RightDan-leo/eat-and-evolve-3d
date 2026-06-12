import { COMBAT, type CombatRelation } from '../config/combat';

/**
 * CombatSystem（逻辑层 · 移植自 2D）。
 * 判定大吃小关系并计算伤害数值，**不修改任何实体、零 three/DOM 依赖**。
 * 编排层负责把返回的伤害应用到实体 hp 上。详见 specs/systems/CombatSystem.spec.md。
 */

export interface EnemyCombatInfo {
  id: string;
  level: number;
  hp: number;
  maxHp: number;
  /** 怪的接触基础伤害（用于反伤） */
  contactDamage: number;
  /** starter prey：强制 dominant（开场必秒杀） */
  prey?: boolean;
}

export interface ContactOutcome {
  relation: CombatRelation;
  /** 本次对敌人造成的伤害 */
  dmgToEnemy: number;
  /** 本次对玩家造成的反伤 */
  dmgToPlayer: number;
  /** 敌人是否被击败（基于传入 hp 预判） */
  enemyDefeated: boolean;
}

export class CombatSystem {
  private nowSec = 0;
  /** 每个敌人的接触冷却到期时刻 */
  private contactCd = new Map<string, number>();

  update(dtSec: number): void {
    this.nowSec += dtSec;
  }

  /** 等级差 → 关系 */
  relationOf(playerLevel: number, enemyLevel: number): CombatRelation {
    const delta = playerLevel - enemyLevel;
    if (delta >= COMBAT.executeDelta) return 'dominant';
    if (delta === 1) return 'advantage';
    if (delta === 0) return 'even';
    if (delta === -1) return 'disadvantage';
    return 'hopeless';
  }

  /** relation → 头顶/轮廓颜色 */
  colorOf(playerLevel: number, enemyLevel: number): number {
    return COMBAT.relationColors[this.relationOf(playerLevel, enemyLevel)];
  }

  /** 玩家对目标伤害：dominant 处决；否则按 maxHp 百分比 */
  private playerDamageTo(relation: CombatRelation, enemy: EnemyCombatInfo): number {
    if (relation === 'dominant') return Math.max(1, enemy.hp);
    return Math.max(1, Math.round(enemy.maxHp * COMBAT.playerDamageFractions[relation]));
  }

  /**
   * 解析一次玩家↔敌人接触。带接触冷却，冷却中返回 null。
   * 不修改实体，仅返回应施加的伤害与结果。
   */
  resolveContact(playerLevel: number, enemy: EnemyCombatInfo): ContactOutcome | null {
    const until = this.contactCd.get(enemy.id) ?? 0;
    if (until > this.nowSec) return null;
    this.contactCd.set(enemy.id, this.nowSec + COMBAT.contactCooldown);

    const relation = enemy.prey ? 'dominant' : this.relationOf(playerLevel, enemy.level);
    const dmgToEnemy = this.playerDamageTo(relation, enemy);
    const dmgToPlayer = Math.max(
      0,
      Math.round(enemy.contactDamage * COMBAT.counterDamageFactors[relation]),
    );

    return {
      relation,
      dmgToEnemy,
      dmgToPlayer,
      enemyDefeated: enemy.hp - dmgToEnemy <= 0,
    };
  }

  /** 敌人被移除时清理其冷却记录 */
  forget(enemyId: string): void {
    this.contactCd.delete(enemyId);
  }

  reset(): void {
    this.nowSec = 0;
    this.contactCd.clear();
  }
}
