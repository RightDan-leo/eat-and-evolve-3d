/**
 * 投放版本（逻辑层）。从 src/config/data/variants.json 加载。
 * 胜利版 / 失败版，对应不同 Titan 数值与结算文案。
 */
import data from '../../config/data/variants.json';

export type VariantId = 'win' | 'lose';

export interface VariantBoss {
  level: number | null;
  immune: boolean;
  maxHp: number;
  contactPlayerDamage: number;
  contactBossDamage: number;
}

export interface VariantSpec {
  id: VariantId;
  label: string;
  boss: VariantBoss;
  outcome: 'win' | 'lose';
  end: { title: string; subtitle: string; buttonLabel: string };
}

const RAW = data as unknown as {
  default: string;
  variants: Record<VariantId, Omit<VariantSpec, 'id'>>;
};

export const DEFAULT_VARIANT: VariantId = RAW.default === 'lose' ? 'lose' : 'win';

export function parseVariantId(raw: string | null | undefined): VariantId {
  if (raw === 'lose') return 'lose';
  if (raw === 'win') return 'win';
  return DEFAULT_VARIANT;
}

export function getVariant(id: VariantId): VariantSpec {
  const v = RAW.variants[id] ?? RAW.variants[DEFAULT_VARIANT];
  return { id, ...v };
}
