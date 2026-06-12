import { FORMS, formIndexForLevel, type FormStage, type BranchOption } from '../config/evolution';

/**
 * EvolutionSystem（逻辑层）。根据等级推进形态阶段，产出"进入新形态 / 需要分支选择"事件。
 * 不碰画面、零 three/DOM。详见 specs/systems/EvolutionSystem.spec.md。
 */

export interface EvoEvents {
  /** 进入了新形态（下标） */
  formUp?: number;
  /** 该形态是分支点，需玩家选择 */
  branchOffer?: BranchOption[];
}

export class EvolutionSystem {
  private formIdx = 0;
  /** 已做出分支选择的形态下标集合 */
  private chosen = new Set<number>();
  private branch: BranchOption | null = null;

  /** 当前形态 */
  get form(): FormStage {
    return FORMS[this.formIdx];
  }

  get currentIndex(): number {
    return this.formIdx;
  }

  /** 已选择的分支（影响数值/配色），未选则 null */
  get activeBranch(): BranchOption | null {
    return this.branch;
  }

  /** 移动速度倍率（来自分支） */
  get speedMul(): number {
    return this.branch?.speedMul ?? 1;
  }

  /** 吞噬范围倍率（来自分支） */
  get reachMul(): number {
    return this.branch?.reachMul ?? 1;
  }

  /** 根据当前等级推进形态，返回事件 */
  step(level: number): EvoEvents {
    const idx = formIndexForLevel(level);
    if (idx <= this.formIdx) return {};
    this.formIdx = idx;
    const ev: EvoEvents = { formUp: idx };
    const form = FORMS[idx];
    if (form.branch && !this.chosen.has(idx)) {
      ev.branchOffer = form.branch;
    }
    return ev;
  }

  /** 应用分支选择 */
  applyBranch(optionId: string): BranchOption | null {
    const form = FORMS[this.formIdx];
    if (!form.branch) return null;
    const opt = form.branch.find((o) => o.id === optionId) ?? form.branch[0];
    this.chosen.add(this.formIdx);
    this.branch = opt;
    return opt;
  }

  reset(): void {
    this.formIdx = 0;
    this.chosen.clear();
    this.branch = null;
  }
}
