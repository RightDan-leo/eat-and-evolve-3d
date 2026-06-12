---
target: src/main.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
related:
  - architecture.md
  - milestones/m0-spike.spec.md
  - milestones/m1-core-devour.spec.md
  - milestones/m2-evolution.spec.md
  - milestones/m3-world-enemies.spec.md
  - milestones/m4-endgame-cta.spec.md
  - milestones/m5-polish-ship.spec.md
---

# 龙噬进化岛 3D 版 — 游戏设计总纲

> 本作是 2D《龙噬进化岛 / eat-and-evolve》的 **3D 表现转化版**，定位为 **买量 Playable 广告**。
> 玩法流程以参考视频 `Puzzles & Chaos 吞噬广告参考.mp4` 为准（详见 `eat-and-evolve/docs/3D版吞噬-开发文档.md`），
> 相比 2D 版有三处流程调整：① 新增进化分支选择；② 相机从分级缩放升级为连续动态拉远；③ 终局从单 Boss 改为双 Titan。

## 游戏概述

### 一句话描述
俯视 3D「大吃小」吞噬进化：从弱小幼兽起步，吃掉等级 ≤ 自己的怪滚雪球升级、体型暴涨、相机随之拉远揭示更大世界，最终面对双巨怪 Titan 决战，按胜/负版本接「变强养成」CTA 跳商店。

### 游戏类型
3D 俯视（3/4 斜角）吞噬成长 / Playable 广告。

### 目标平台
- 移动端（浏览器 / 广告 SDK 内嵌单文件 HTML）— **主**
- PC（浏览器）— 兼容

## 核心玩法

### 游戏循环

```
开场弱小幼兽(Lv.5) → 摇杆自由移动 → 吃 ≤自身等级 的小怪(秒杀吞噬) → 经验/等级↑ → 体型变大 + 相机拉远
  → 阶段性弹出【进化分支选择】→ 形态进阶 → 反杀曾经的庞然大物 → 双 Titan 决战
  → 胜/负结算 → 「增强战力/养成英雄」CTA → 跳商店
```

### 操作方式

| 平台 | 操作 | 说明 |
|------|------|------|
| 移动端 | 触摸拖动 | 屏幕任意位置按下即出现摇杆（DRAG TO MOVE），拖动控制移动方向 |
| PC | 鼠标拖动 / WASD | 鼠标按下拖动等价摇杆；WASD 备用 |
| 通用 | 点击进化卡片 | 进化分支选择面板上点选元素/形态 |

### 核心机制
1. **3D 俯视 3/4 相机**：俯角 ~50–60°，地面 XZ 平面为玩法平面（非纯顶视）。
2. **摇杆自由移动**：任意点按下拖动 → 地面方向向量 → 玩家自由漫游（沿用 2D 手感，非通道约束）。
3. **大吃小 + 等级压制**：吃等级 ≤ 自己的怪秒杀吞噬；等级远高的怪体型巨大、危险（碰撞反伤/被吞）。
4. **体型 ↔ 镜头联动**：玩家随等级连续变大，相机在「高度 + 距离」上平滑拉远，世界"显得越来越小"——核心视觉爽点。
5. **吞噬反馈**：金色进化光环 + 肉块/粒子爆裂 + 等级跳字（迁移 2D `DevourSystem`）。
6. **进化分支选择**（参考独有，新增）：达到阶段阈值弹面板，主动选元素/形态方向，给养成掌控感。
7. **顶级 Titan 终局**：双巨怪（紫/红），可吃其一完成身份反转；按版本被另一只反杀或反杀之。
8. **胜/负双版本**：沿用 2D `variants.ts`（win/lose）；参考主打 **lose 养成 CTA**。
9. **结算 → 商店 CTA**：胜/负均引导下载。

## 游戏内容

### 场景列表

| 场景 | 用途 | Spec |
|------|------|------|
| BootScene | 引擎/渲染器初始化 | 内置（core/SceneManager） |
| PreloadScene | GLB 模型/贴图/音频预载 | 内置 |
| GameScene | 核心玩法编排（逻辑 tick → 表现同步） | [spec](scenes/GameScene.spec.md) |

### 实体列表

| 实体 | 说明 | Spec |
|------|------|------|
| Dragon（玩家） | 多阶进化的幼兽→巨龙，体型随等级变化 | [spec](entities/Dragon.spec.md) |
| Enemy（小怪/中怪） | 按分区/等级生成，relation 颜色，可被吞 | [spec](entities/Enemy.spec.md) |
| Titan（双 Boss） | 紫/红顶级巨怪，终局目标 | [spec](entities/Titan.spec.md) |

### 系统列表

| 系统 | 说明 | Spec |
|------|------|------|
| CombatSystem | 大吃小/HP/等级压制伤害/relation（移植 2D，去 Phaser） | [spec](systems/CombatSystem.spec.md) |
| EvolutionSystem | 形态阈值 + 分支选择（扩展 2D） | [spec](systems/EvolutionSystem.spec.md) |
| SpawnSystem | 分区刷怪/starterPrey/Titan（移植 2D） | [spec](systems/SpawnSystem.spec.md) |
| DevourSystem | 肉块爆裂 + 吸入特效（2D 逻辑 + 3D 重做表现） | [spec](systems/DevourSystem.spec.md) |
| CameraRig | 体型→相机距离/高度连续插值拉远 | [spec](systems/CameraRig.spec.md) |
| InputController | 摇杆 → 地面方向向量 | [spec](systems/InputController.spec.md) |

### 组件列表

| 组件 | 说明 | Spec |
|------|------|------|
| LabelLayer | CSS2D 头顶等级数字/感叹号/箭头 | [spec](components/LabelLayer.spec.md) |
| EvolutionChoicePanel | HTML/CSS 进化分支选择面板 | [spec](components/EvolutionChoicePanel.spec.md) |
| HudOverlay | HUD/引导箭头/结算/CTA 叠层 | [spec](components/HudOverlay.spec.md) |

## 美术风格

低面数（low-poly）卡通 3D：明亮草地环形岛、土路三岔、环山围合；角色为蓝色幼兽 → 元素幼龙 → 巨龙的多阶模型；Titan 为紫/红巨型猛兽。整体色彩高饱和、轮廓清晰，适配小屏与广告快速识别。

## 音频设计

| 类型 | 内容 | 说明 |
|------|------|------|
| BGM | 轻快冒险循环 | 迁移/复用 2D，WebAudio 内联 |
| SFX | 吞噬、升级、进化、Titan 登场、结算 | 短促打击感；体积优先 |

## 数值设计

### 核心数值（迁移自 2D `config/data/*.json`，3D 坐标重排）

| 参数 | 值 | 说明 |
|------|-----|------|
| 起始等级 | Lv.5 | 开场幼兽 |
| 形态阈值 | 多阶（沿用 2D evolution.json） | 触发模型 morph + 可触发分支选择 |
| relation 阈值 | 绿/黄/红（按等级差） | 绿=秒杀吞噬、黄=2-3 下、红=危险 |
| starterPrey | 玩家出生点附近若干绿怪 | 开场即时正反馈 |
| Titan 等级 | Lv.100 / Lv.190（示例） | 双顶级目标 |
| cameraDistanceByLevel | 单独可调曲线 | 体型↔相机距离/高度 |

### 难度曲线
越靠环形岛中心，怪等级越高、体型越大（压迫感）；玩家通过吃外圈滚雪球后才有能力推进中心；终局双 Titan 为难度顶点。

## 技术约束

- 目标帧率：中端 60 FPS、低端 ≥30 FPS；`pixelRatio` 钳制 ≤2。
- **产物：单文件 HTML、零外部请求、目标 ≤5MB**（Three.js min ~600KB + Draco + 压缩模型/贴图，`vite-plugin-singlefile` 内联）。
- 首屏加载：< 3 秒（广告场景）。
- 群怪用 InstancedMesh / 合批。

## 里程碑

| 阶段 | 目标 | 状态 |
|------|------|------|
| M0 技术验证 | 俯视相机 + GLB 幼兽 + 摇杆 + 相机随体型拉远 + 单文件体积量化 | draft |
| M1 核心吞噬 | 自由移动 + 吃小怪秒杀吞噬 + 等级跳字 + 变大 + 镜头联动 | draft |
| M2 进化系统 | 模型多阶进化 + 进化分支选择面板 + 吞噬特效迁移 | draft |
| M3 世界与敌人 | 环形岛 3D 环境 + 分区刷怪 + 体型压迫高级怪 + starterPrey | draft |
| M4 终局与转化 | 双 Titan 收尾 + win/lose 结算 + 养成 CTA + 跳商店 | draft |
| M5 投放打磨 | 竖屏适配 + 音效 + 性能 + Draco/贴图压缩 + 单文件 ≤5MB | draft |
