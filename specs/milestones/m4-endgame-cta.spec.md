---
milestone: M4
title: 终局与转化（双 Titan + win/lose + 养成 CTA）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M4：终局与转化

## 目标

实现终局闭环：双 Titan（紫/红）登场演出 → 吃掉其一完成身份反转 → 按版本被另一只反杀（lose）或反杀之（win）→ 结算屏 → 「增强战力/养成英雄」CTA → 跳商店。

## 验收标准

- [ ] 玩家达阈值后，Director 编排**双 Titan 登场**：相机平移聚焦 → 文本/演出 → 回到玩家 + 箭头引导
- [ ] Titan 体型巨大；登场时其余非 Titan 怪缩小（突出 Titan 重要性，沿用 2D 共有逻辑）
- [ ] 吃掉紫 Titan → 玩家体型暴涨、等级跳升、相机完全拉远（整岛入画）
- [ ] **lose 版**：逼近红 Titan → 被压制/吞掉 → LOSE 结算（纹章 + 养成引导）
- [ ] **win 版**：反杀红 Titan → WIN 结算（沿用 `variants.ts`）
- [ ] 结算屏 → 「Tap to Continue」→ 跳商店（CTA）

## 涉及模块

### 新增模块

| 模块 | Spec | 代码路径 | 说明 |
|------|------|----------|------|
| Titan | [spec](../entities/Titan.spec.md) | `src/entities/Titan.ts` | 双 Boss 3D 视图 |
| Director | [spec](../scenes/GameScene.spec.md) | `src/systems/Director.ts` | 登场/结算/CTA 编排 |
| HudOverlay | [spec](../components/HudOverlay.spec.md) | `src/components/HudOverlay.ts` | 结算 + CTA 叠层 |

### 修改模块

| 模块 | Spec | 变更内容 |
|------|------|----------|
| 变体 variants | [spec](../game-design.spec.md) | 沿用 2D win/lose，运行时单构建选变体 |
| CameraRig | [spec](../systems/CameraRig.spec.md) | 终局完全拉远整岛入画 |

## 开发顺序

1. Titan 视图 + 登场演出（其余怪缩小）
2. 吃紫 Titan 反转 + 相机全拉远
3. win/lose 分支结算
4. CTA 跳商店

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| Titan 等级 | Lv.100 / Lv.190（示例） | 双顶级 |
| 登场延迟 | 1s（满级触发时） | 避免与进化/缩放动画重叠 |
| storeUrl | 商店链接 | CTA 跳转 |

## 备注
win/lose 共享全部核心玩法，仅终局难度与结局不同（沿用 2D 变体架构）。
