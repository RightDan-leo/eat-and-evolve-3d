# Spec 文件规范

## Spec 存放位置

所有 spec 文件统一存放在项目根目录 `specs/` 下：

```
specs/
├── _index.md                              # 索引文件
├── _templates/                            # spec 模板
│   ├── default.spec.md                    # 通用 spec 模板
│   ├── milestone.spec.md                  # 里程碑 spec 模板
│   ├── task.spec.md                       # 任务 spec 模板
│   ├── scene.spec.md                      # 场景 spec 模板
│   ├── entity.spec.md                     # 实体 spec 模板
│   ├── system.spec.md                     # 系统 spec 模板
│   └── component.spec.md                  # 核心组件 spec 模板
├── game-design.spec.md                    # 游戏设计总文档（顶层）
├── milestones/                            # 里程碑 spec
│   ├── m1-core-combat.spec.md
│   └── m2-stamina-scoring.spec.md
├── tasks/                                 # 任务 spec（非里程碑的跨模块修改）
│   ├── combat-rebalance.spec.md
│   └── movement-refactor.spec.md
├── core/                                  # 核心组件 spec（套件内置组件的 API 文档）
│   ├── object-pool.spec.md
│   ├── fsm.spec.md
│   └── audio-manager.spec.md
├── scenes/
│   ├── main-menu.spec.md                  # 场景 spec
│   └── gameplay.spec.md
├── entities/
│   ├── player.spec.md                     # 实体 spec
│   └── player/
│       └── features/
│           └── double-jump.spec.md        # 功能 spec
└── systems/
    └── collision.spec.md                  # 系统 spec
```

## Spec 与代码路径的映射

spec 路径镜像代码的 `src/` 目录结构：

| 代码路径 | Spec 路径 |
|---------|----------|
| `src/core/ObjectPool.ts` | `specs/core/object-pool.spec.md` |
| `src/scenes/GameScene.ts` | `specs/scenes/GameScene.spec.md` |
| `src/entities/Player.ts` | `specs/entities/Player.spec.md` |
| `src/systems/Collision.ts` | `specs/systems/Collision.spec.md` |

里程碑 spec 不直接对应代码，而是组织和关联多个模块 spec：

| 里程碑 | Spec 路径 |
|--------|----------|
| M1 核心战斗 | `specs/milestones/m1-core-combat.spec.md` |
| M2 体力得分 | `specs/milestones/m2-stamina-scoring.spec.md` |

任务 spec 类似里程碑但更轻量，用于跨模块修改（非里程碑级别）：

| 任务 | Spec 路径 |
|------|----------|
| 战斗数值重平衡 | `specs/tasks/combat-rebalance.spec.md` |
| 移动系统重构 | `specs/tasks/movement-refactor.spec.md` |

## Spec 层级

```
game-design.spec.md              ← 第 1 层：游戏设计总纲
├── milestones/mX-xxx.spec.md    ← 第 2 层：里程碑 spec（开发阶段划分）
├── tasks/xxx.spec.md            ← 第 2 层：任务 spec（跨模块修改）
├── core/xxx.spec.md             ← 独立层：核心组件 spec（套件内置，API 文档）
├── scenes/xxx.spec.md           ← 第 3 层：模块 spec
├── entities/xxx.spec.md
├── systems/xxx.spec.md
└── xxx/features/yyy.spec.md     ← 第 4 层：功能 spec（细粒度）
```

**开发顺序：总纲 → 里程碑/任务 spec → 模块 spec → 代码**

---

## Spec 文件格式

### 模板

所有模板文件存放在两处（内容一致）：
- 项目中：`specs/_templates/`（初始化时创建）
- Skill 中：本目录 `templates/`（作为参考源）

可用模板：`default` | `milestone` | `task` | `scene` | `entity` | `system` | `component` | `game-design` | `feature`

### 公开接口区与内部实现区

模块级 spec（entity / scene / system / default）分为两个区域，以 `<!-- INTERNAL -->` 标记分隔：

- **标记之前**：公开接口区 — 概述、属性、状态、接口定义、公开方法、类型定义、碰撞交互、依赖等。**外部模块只需阅读此区域。**
- **标记之后**：内部实现区 — 功能需求、状态流转、视觉表现、物理属性、行为规则、业务逻辑、场景生命周期、配置、备注等。**仅在开发本模块时阅读。**

### 状态定义

| 状态 | 说明 |
|------|------|
| `draft` | 初稿，spec 尚未完善 |
| `ready` | spec 已完成，待实现 |
| `implementing` | 正在实现中 |
| `completed` | 实现完成。转入此状态时，MUST 将 spec 内所有 `- [ ]` 标记为 `- [x]`（功能需求、验收标准、实施计划等） |
| `deprecated` | 已废弃 |
