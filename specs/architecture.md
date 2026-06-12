# 架构红线（吞噬进化岛 3D）

> 本文是「2D 吞噬版 → 3D」转化的**单一事实来源**。
> 核心思想：**玩法逻辑与引擎彻底解耦**——把 2D 版（`eat-and-evolve`）已验证的玩法逻辑作为「纯 TS 逻辑层」原样移植，
> 用 Three.js 重写「表现层」，中间用「编排层」接线。**严禁在逻辑层出现任何 Three.js / Phaser / DOM 依赖。**

## 0. 为什么这样分层

2D 版把玩法（大吃小、进化、刷怪、吞噬特效）与 Phaser 表现混在一起，迁移 3D 时若照搬会被迫重写一切。
本工程把「能跑通的玩法数值与判定」抽成无引擎依赖的纯函数/纯数据，**渲染层可替换**（今天 Three.js，明天换引擎也只动表现层）。

## 1. 三层结构与改动边界

```
┌─────────────────────────────────────────────────────────────┐
│ 逻辑层 LOGIC（纯 TS，零 three / 零 Phaser / 零 DOM）—— 从 2D 版移植 │
│   - config/data/*.json      数值唯一事实来源（等级/形态/relation/刷怪/Titan/相机曲线）│
│   - config/forms.ts         形态阈值与每阶数值派生                                   │
│   - config/variants.ts      win/lose 变体（沿用 2D）                                 │
│   - systems/CombatSystem    大吃小 / HP / 等级压制伤害 / relation 颜色（移植）         │
│   - systems/EvolutionSystem 形态阈值推进 + 分支选择结果应用（扩展）                    │
│   - systems/SpawnSystem     分区/等级刷怪 + starterPrey + Titan 缩放（移植）           │
│   - 输出：纯数据与事件（坐标、命中、击败、升级、进化、分支可选项、刷怪），不碰画面        │
└─────────────────────────────────────────────────────────────┘
                          ▲ 只读引用（表现层读逻辑层，逻辑层不反向依赖）
┌─────────────────────────────────────────────────────────────┐
│ 表现层 VIEW（Three.js，全新写）                                │
│   - core/SceneManager · BaseScene · ModelUtils（脚手架自带；M5 加 Draco）│
│   - entities/Dragon · Enemy · Titan（3D 视图：模型/morph/体型）          │
│   - systems/CameraRig（体型→距离/高度连续拉远）                          │
│   - systems/DevourFx（肉块爆裂 + 吸入，3D 重做）· EnvBuilder（环形岛/土路/树/山）│
│   - components/LabelLayer（CSS2D 头顶等级）· HudOverlay · EvolutionChoicePanel（HTML/CSS）│
│   - 渲染对象只读逻辑层状态，把输入意图回传编排层                          │
└─────────────────────────────────────────────────────────────┘
                          ▲ 注入/接线
┌─────────────────────────────────────────────────────────────┐
│ 编排层 ORCHESTRATION                                          │
│   - scenes/GameScene     主循环：逻辑 tick → 表现同步          │
│   - systems/InputController  摇杆/拖动 → 地面方向向量 → 玩家位移 │
│   - systems/Director     进化分支弹窗时机 / Titan 登场 / 结算 / CTA 流程 │
└─────────────────────────────────────────────────────────────┘
```

## 2. 逻辑层移植清单（从 `eat-and-evolve` 去 Phaser）

| 2D 源 | 3D 去向 | 改动 |
|-------|---------|------|
| `CombatSystem` | `logic/systems/CombatSystem.ts` | 删 Phaser body/精灵引用，输入输出改纯数据（位置/半径/等级） |
| `EvolutionSystem` + `evolution.json` | `logic/systems/EvolutionSystem.ts` | 保留阈值推进；**新增分支选择**：阈值处产出可选项，由编排层弹窗、回填结果 |
| `SpawnSystem` | `logic/systems/SpawnSystem.ts` | 坐标由 2D 像素改为 3D XZ；分区/starterPrey/Titan 缩放规则保留 |
| `variants.ts`（win/lose） | `logic/config/variants.ts` | 原样沿用；运行时单构建选变体 |
| `config/data/*.json` | `logic/config/data/*.json` | 环形岛布局重排为 XZ 坐标；新增 `cameraDistanceByLevel` 曲线 |

> `DevourSystem` 的**命中/吸收数值**属逻辑层；**肉块/粒子表现**在表现层 `DevourFx` 全新写。

## 3. 数据流（每帧）

```
InputController（摇杆 → dir 向量）
   → GameScene.tick：
       CombatSystem.step(玩家/敌人位置、等级)  → 命中/击败/经验事件
       EvolutionSystem.step(经验/等级)         → 升级/到达阈值（可选分支）事件
       SpawnSystem.step(玩家位置)              → 新刷怪/Titan 事件
   → 表现同步：Dragon/Enemy/Titan mesh 位置&体型插值；LabelLayer 更新等级
   → CameraRig.follow(玩家体型) 连续拉远
   → DevourFx 播放命中/吞噬粒子
   → Director 处理分支弹窗 / Titan 登场演出 / 结算 / CTA
```

## 4. 红线规则（CI/评审检查点）

1. `logic/**` **禁止** `import 'three'`、`import 'phaser'`、`document`、`window`。
2. 表现层只**读** logic 状态，不得把渲染对象塞回 logic。
3. 所有可调数值进 `logic/config/data/*.json`，禁止散落魔法数（相机曲线、relation 阈值、Titan 等级、starterPrey 等必须可配）。
4. 群体敌人渲染必须走 InstancedMesh / 合批，禁止逐个 new Mesh 进主循环。
5. 产物体积是硬约束：任何新增模型/贴图 PR 需评估对 ≤5MB 单文件的影响。

## 5. 与 2D 版的差异（3D 新增/改造）

- **CameraRig**：2D 是 `zoomByLevel` 分级；3D 改为体型→距离/高度**连续插值**拉远（核心手感）。
- **EvolutionChoicePanel**：2D 线性自动进化；3D 在阈值处**弹分支选择**（元素/形态），结果回填 EvolutionSystem。
- **双 Titan 终局**：2D 单中心 Boss；3D 为紫/红双 Titan，Director 编排登场与吃一/被反杀。
- **表现全换**：程序图形/精灵 → GLB 低面数模型 + CSS2D 标签 + 3D 粒子。
