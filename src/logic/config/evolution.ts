/**
 * 形态进化配置（逻辑层）。从 src/config/data/evolution.json 加载。
 * 等级阈值 → 形态阶段；部分阶段为"分支点"，弹出元素/形态选择。
 */
import data from '../../config/data/evolution.json';

export interface BranchOption {
  id: string;
  name: string;
  element: string;
  body: number;
  accent: number;
  speedMul: number;
  reachMul: number;
}

export interface FormStage {
  level: number;
  name: string;
  body: number;
  accent: number;
  tier: number;
  branch?: BranchOption[];
}

const hex = (s: string): number => Number(s);

export const FORMS: FormStage[] = data.forms.map((f: any) => ({
  level: f.level,
  name: f.name,
  body: hex(f.body),
  accent: hex(f.accent),
  tier: f.tier,
  branch: (f.branch ?? []).length
    ? f.branch.map((b: any) => ({
        id: b.id,
        name: b.name,
        element: b.element,
        body: hex(b.body),
        accent: hex(b.accent),
        speedMul: b.speedMul,
        reachMul: b.reachMul,
      }))
    : undefined,
}));

/** 等级对应的形态下标 */
export function formIndexForLevel(level: number): number {
  let idx = 0;
  for (let i = 0; i < FORMS.length; i++) {
    if (level >= FORMS[i].level) idx = i;
  }
  return idx;
}
