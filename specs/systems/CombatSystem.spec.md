---
target: src/logic/systems/CombatSystem.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: logic
related: [../entities/Dragon.spec.md, ../entities/Enemy.spec.md]
---

# CombatSystem（逻辑层 · 移植自 2D）

## 职责
判定「大吃小」与等级压制伤害，输出命中/击败/经验事件。**纯 TS，零 three/Phaser/DOM。**

## 输入
- 玩家：位置(XZ)、半径、等级
- 敌人列表：位置(XZ)、半径、等级
- relation 阈值与伤害规则（来自 `config/data`）

## 核心规则（与 2D 保持一致）
- **relation 颜色**：按 `enemyLv - playerLv` 落入 绿 / 黄 / 红。
- **绿**（≤ 玩家）：碰撞秒杀吞噬，**无反伤**。
- **黄**（接近）：2–3 下击杀，互相按 maxHP 百分比扣血。
- **红**（远高）：玩家几乎打不动（10+ 下），碰撞对玩家高反伤，体型巨大、危险。
- 伤害按防御方 maxHP 百分比计算，保证"命中次数"稳定。

## 输出（纯数据事件）
- `hit{attacker, target, dmg}`
- `defeated{enemyId}` → 触发吞噬/经验
- `expGain{amount}`
- `playerDamaged{dmg, fromRelation}`

## 接口（示意）
```ts
step(state: CombatState): CombatEvents
relationOf(playerLv: number, enemyLv: number): 'green'|'yellow'|'red'
```

## 移植注意
删除 2D 中所有 Phaser body / 精灵引用；碰撞改为半径圆叠加判定（XZ 平面），由编排层喂入位置。

## 验收
- [ ] 绿怪秒杀无反伤；红怪高反伤
- [ ] relation 颜色与 2D 一致
- [ ] 模块无 three/Phaser/DOM import
