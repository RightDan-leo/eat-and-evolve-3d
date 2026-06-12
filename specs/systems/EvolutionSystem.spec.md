---
target: src/logic/systems/EvolutionSystem.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: logic
related: [../components/EvolutionChoicePanel.spec.md, ../entities/Dragon.spec.md]
---

# EvolutionSystem（逻辑层 · 扩展自 2D）

## 职责
按经验/等级推进形态阈值，产出"升级 / 到达形态阈值 / 可选分支"事件；接收分支选择结果并应用到玩家数值/形态。**纯 TS。**

## 输入
- 当前经验、等级
- 形态阈值表（沿用 2D `evolution.json`，重排）
- 分支选项表（新增：哪些阈值弹选择、各选项的皮+数值差异）

## 核心规则
- 经验达阈值 → `levelUp` 事件。
- 到达**形态阈值** → `formUp{ stage }` 事件（驱动模型 morph）。
- 部分形态阈值标记为**分支点** → `branchOffer{ options }`，暂停推进等待编排层回填。
- 收到 `applyBranch{ choiceId }` → 应用该选项（换皮 + 至少一项数值/形态影响），恢复推进。

## 输出
- `levelUp{ level }`、`formUp{ stage }`、`branchOffer{ options }`

## 接口（示意）
```ts
step(exp: number): EvoEvents
applyBranch(choiceId: string): void
```

## 与 2D 差异
2D 为线性自动进化；本作在分支点暂停并由 `EvolutionChoicePanel` 提供主动抉择，结果回填后继续。

## 验收
- [ ] 阈值推进正确触发 formUp
- [ ] 分支点正确产出 branchOffer 并等待回填
- [ ] 分支选择有真实差异（非假选择）
- [ ] 无 three/Phaser/DOM import
