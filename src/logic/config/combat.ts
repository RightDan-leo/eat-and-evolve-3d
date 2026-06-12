/**
 * 战斗数值（逻辑层）。从 src/config/data/combat.json 加载（可在配置编辑器中调整）。
 * 纯数据，零 three/DOM 依赖。
 */
import combatData from '../../config/data/combat.json';

export type CombatRelation =
  | 'dominant'
  | 'advantage'
  | 'even'
  | 'disadvantage'
  | 'hopeless';

const hex = (s: string): number => Number(s);

export const COMBAT = {
  executeDelta: combatData.executeDelta,
  hopelessDelta: combatData.hopelessDelta,
  contactCooldown: combatData.contactCooldown,
  playerDamageFractions: combatData.playerDamageFractions as Record<CombatRelation, number>,
  counterDamageFactors: combatData.counterDamageFactors as Record<CombatRelation, number>,
  relationColors: {
    dominant: hex(combatData.relationColors.dominant),
    advantage: hex(combatData.relationColors.advantage),
    even: hex(combatData.relationColors.even),
    disadvantage: hex(combatData.relationColors.disadvantage),
    hopeless: hex(combatData.relationColors.hopeless),
  } as Record<CombatRelation, number>,
};

/** relation 是否为"可安全吞噬"（绿） */
export function isDevourable(relation: CombatRelation): boolean {
  return relation === 'dominant' || relation === 'advantage' || relation === 'even';
}
