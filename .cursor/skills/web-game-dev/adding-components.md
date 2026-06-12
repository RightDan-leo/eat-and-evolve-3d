# 新增核心组件流程

向套件添加新的核心组件（ObjectPool、FSM、AudioManager 等）时，遵循以下步骤。

---

## 1. 创建 Spec

使用 `component.spec.md` 模板，在**游戏项目**的 `specs/core/` 下创建：

```
specs/core/{component-name}.spec.md
```

填写公开接口区（`<!-- INTERNAL -->` 之前）：概述、适用场景、公开接口、用法示例。
填写内部实现区：实现策略、性能特性、设计取舍。

frontmatter 中的 `engine` 字段标注适用范围：`both` | `2d` | `3d`。

## 2. 确定引擎范围

| engine 值 | 代码位置 | 说明 |
|-----------|---------|------|
| `both` | 两个 boilerplate 的 `src/core/` | 引擎无关（如 FSM、SaveSystem），可共享同一份 .ts 文件 |
| `2d` | `boilerplate-2d/src/core/` | Phaser 专用封装（如 Phaser SoundManager 封装） |
| `3d` | `boilerplate-3d/src/core/` | Three.js 专用封装（如 AudioListener 封装） |

注意：`boilerplate-2d` 目前没有 `src/core/` 目录。首次添加 2d/both 组件时需要：
1. 在 `boilerplate-2d/src/core/` 创建 `index.ts` barrel export
2. 在 `init.mjs` 中为 2D 项目也复制 `src/core/`（参考 3D 的 `cpSync` 逻辑）

## 3. 实现代码

在对应 boilerplate 的 `src/core/` 下创建文件：

```
boilerplate-{2d|3d}/src/core/{ComponentName}.ts
```

要求：
- 泛型优先 — 尽量让组件类型安全且可复用
- 不依赖具体游戏逻辑，只依赖引擎 API
- 导出类型定义（接口、配置类型等）

## 4. 更新 Barrel Export

在 `src/core/index.ts` 中添加 export，**必须带 JSDoc 注释**：

```typescript
/**
 * {一句话描述} — {适用场景}
 */
export { ComponentName } from './ComponentName';
export type { ComponentConfig } from './ComponentName';
```

JSDoc 是 AI 发现组件的关键入口（Rule 门控要求读取此文件）。

## 5. 验证

- [ ] `npm run check` 无类型错误
- [ ] spec 公开接口区与实际代码一致
- [ ] `core/index.ts` 的 JSDoc 准确描述了组件用途
- [ ] `engine: both` 的组件在两个 boilerplate 中都存在

## 6. 更新 TODO.md

将对应组件的待办项标记为完成。
