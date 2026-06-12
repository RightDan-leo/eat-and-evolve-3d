/**
 * 敌人种类配置（逻辑层）。从 src/config/data/enemies.json 加载。
 * 不同等级段对应不同 kind：造型/配色/行为（追逐、速度、仇恨半径）。
 */
import data from '../../config/data/enemies.json';

export type EnemyShape = 'blob' | 'critter' | 'beast' | 'brute' | 'wyrm';

export interface EnemyKindConfig {
  shape: EnemyShape;
  body: number;
  accent: number;
  sizeFactor: number;
  chaser: boolean;
  speed: number;
  aggro: number;
}

const hex = (s: string): number => Number(s);

export const ENEMY_KINDS: Record<EnemyShape, EnemyKindConfig> = (() => {
  const out = {} as Record<EnemyShape, EnemyKindConfig>;
  (Object.keys(data.kinds) as EnemyShape[]).forEach((k) => {
    const raw = (data.kinds as Record<string, any>)[k];
    out[k] = {
      shape: raw.shape as EnemyShape,
      body: hex(raw.body),
      accent: hex(raw.accent),
      sizeFactor: raw.sizeFactor,
      chaser: raw.chaser,
      speed: raw.speed,
      aggro: raw.aggro,
    };
  });
  return out;
})();

/** 追逐放弃距离（离玩家超过则回归游荡） */
export const CHASE_GIVE_UP = data.chaseGiveUp;

const LEVEL_TO_KIND = data.levelToKind as EnemyShape[];

export function kindForLevel(level: number): EnemyShape {
  const idx = Math.max(0, Math.min(LEVEL_TO_KIND.length - 1, level - 1));
  return LEVEL_TO_KIND[idx];
}

/** 敌人体型相对玩家的缩放配置（diff = enemyLevel - playerLevel） */
export const ENEMY_SIZE = {
  sameOrLowerMaxRatio: data.size.sameOrLowerMaxRatio,
  higherMinRatio: data.size.higherMinRatio,
  scaleByDiff: data.size.scaleByDiff as ReadonlyArray<{ diff: number; scale: number }>,
};
