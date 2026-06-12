---
target: src/core/AnimationUtils.ts
created: 2026-03-19
updated: 2026-03-20
status: ready
engine: 3d
related:
  - specs/core/ModelUtils.spec.md
---

# AnimationUtils

## 概述

为无内嵌动画的静态 GLB 模型提供程序化动画能力。通过代码生成 `THREE.AnimationClip`，配合 `AnimationMixer` 驱动，无需修改模型文件。

## 适用场景

- 从 art-browser 下载的静态模型需要动画表现（悬浮、旋转、呼吸等）
- 需要为拾取物、收集物、道具等添加简单循环动画
- 不适用于骨骼动画——骨骼动画应使用模型自带的 clip 或 Mixamo

## 公开接口

```typescript
type ProceduralAnimationType =
  | 'float' | 'rotate' | 'breathe'
  | 'swing' | 'bounce' | 'spin-y';

interface ProceduralAnimationOptions {
  name?: string;
  duration?: number;
  amplitude?: number;
  loop?: THREE.AnimationActionLoopStyles;
}

interface ProceduralAnimationResult {
  mixer: THREE.AnimationMixer;
  actions: THREE.AnimationAction[];
}
```

### 方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `createProceduralClip` | `(type, options?)` | `AnimationClip` | 生成单个程序化动画 clip |
| `applyProceduralAnimations` | `(target, animations[])` | `ProceduralAnimationResult` | 创建 mixer 并立即播放多个动画 |
| `composeProceduralClip` | `(animations[], name?)` | `AnimationClip` | 将多种动画合成单个 clip（要求操作不同属性） |

### 配置项（预设默认值）

| 类型 | duration | amplitude | 操作属性 | 效果 |
|------|----------|-----------|----------|------|
| `float` | 2.0 | 0.15 | `.position` | 上下悬浮 |
| `rotate` | 4.0 | — | `.quaternion` | Y 轴慢速旋转 |
| `breathe` | 2.5 | 0.08 | `.scale` | 均匀呼吸缩放 |
| `swing` | 1.8 | 0.15 | `.quaternion` | Z 轴摇摆 |
| `bounce` | 0.8 | 0.2 | `.position` + `.scale` | 弹跳 + 挤压 |
| `spin-y` | 3.0 | — | `.quaternion` | Y 轴匀速自转 |

## 用法示例

```typescript
import { loadAndNormalizeGLB } from '../core/ModelUtils';
import { applyProceduralAnimations } from '../core/AnimationUtils';

const result = await loadAndNormalizeGLB('assets/models/gem.glb', { targetSize: 0.5 });
this.add(result.scene);

const { mixer } = applyProceduralAnimations(result.scene, [
  { type: 'float', amplitude: 0.2 },
  { type: 'breathe', amplitude: 0.05 },
]);

// update loop
update(delta: number): void {
  mixer.update(delta);
}
```

## 依赖

### 引用模块
- `three` (AnimationClip, AnimationMixer, KeyframeTrack)
- `src/types/core.ts` (ProceduralAnimationType, ProceduralAnimationOptions, ProceduralAnimationResult)

### 被引用
- 所有 Entity 类（按需 import）

### 同步说明
本文件属于 `src/core/` 同步组件，由 `sync.mjs` 从源仓库同步，禁止在游戏项目中直接修改。

<!-- INTERNAL -->

## 实现策略

每种动画类型由一个私有 generator 函数实现，统一注册到 `GENERATORS` 映射表。`createProceduralClip` 查表调用。采样 60 帧/周期（旋转类用 4 帧即可）。

合成 clip 时检测属性冲突（`.position` / `.quaternion` / `.scale`），同属性的后续 track 跳过并 warn。

## 性能特性

- clip 创建是一次性开销，后续 mixer.update 为 O(tracks)
- Float32Array 预分配，无运行时 GC 压力
- 60 帧采样对大多数循环动画足够平滑

## 设计取舍

- 选择 AnimationClip 而非直接操作 transform：与 Three.js 动画系统一致，可与模型自带动画混合
- 不支持自定义曲线：覆盖 80% 常见需求，复杂动画应用 tween 库或手写 clip
- `bounce` 同时操作 position 和 scale：因此不能与 `float` 或 `breathe` compose
