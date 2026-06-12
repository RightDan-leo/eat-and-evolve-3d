---
target: src/core/ModelUtils.ts
created: 2026-03-20
updated: 2026-03-20
status: ready
engine: 3d
related:
  - specs/core/AnimationUtils.spec.md
---

# ModelUtils

## 概述

GLB/glTF 模型加载与标准化工具。负责加载模型、计算精确包围盒、自动缩放居中、安全克隆，为上层 Entity 提供即用的模型资产。

## 适用场景

- 加载 art-browser 下载的 GLB 模型并标准化尺寸
- 需要精确的 mesh-only 包围盒（排除骨骼、灯光等非视觉节点的干扰）
- 需要克隆含 SkinnedMesh 的模型（普通 clone 会丢失骨骼绑定）

## 公开接口

```typescript
interface ModelBounds {
  box: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  maxDim: number;
}

interface NormalizeOptions {
  targetSize?: number;       // 目标直径，默认 1.0
  scaleMultiplier?: number;  // 额外缩放系数，默认 1.0
  centerAndGround?: boolean; // XZ 居中 + Y 着地，默认 true
}

interface LoadGLBResult {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  bounds: ModelBounds;
}
```

### 方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `computeMeshBounds` | `(object)` | `ModelBounds` | 仅遍历 Mesh 几何体计算包围盒，排除 Bone/Helper/Light |
| `normalizeModel` | `(object, options?)` | `ModelBounds` | 自动缩放到目标尺寸 + XZ 居中 + Y 着地 |
| `cloneModel` | `(source)` | `Object3D` | 安全克隆，含 SkinnedMesh 时自动使用 SkeletonUtils |
| `loadAndNormalizeGLB` | `(url, options?)` | `Promise<LoadGLBResult>` | 加载 GLB + 标准化，一步到位 |

## 用法示例

```typescript
import { loadAndNormalizeGLB, cloneModel } from '../core/ModelUtils';

// 加载并标准化
const result = await loadAndNormalizeGLB('assets/models/tree.glb', {
  targetSize: 2.0,
  scaleMultiplier: 1.2,
});
this.add(result.scene);

// 克隆模型（骨骼安全）
const copy = cloneModel(result.scene);
copy.position.set(3, 0, 0);
this.add(copy);

// 单独使用包围盒计算碰撞半径
import { computeMeshBounds } from '../core/ModelUtils';
const bounds = computeMeshBounds(enemy);
const collisionRadius = bounds.maxDim / 2;
```

## 依赖

### 引用模块
- `three` (Box3, Vector3, Object3D)
- `three/examples/jsm/loaders/GLTFLoader.js` (GLTFLoader)
- `three/examples/jsm/utils/SkeletonUtils.js` (clone)
- `src/types/core.ts` (ModelBounds, NormalizeOptions, LoadGLBResult)

### 被引用
- 所有需要加载 GLB 模型的 Entity / Scene
- `AnimationUtils`（示例中常与 ModelUtils 配合使用）

### 同步说明
本文件属于 `src/core/` 同步组件，由 `sync.mjs` 从源仓库同步，禁止在游戏项目中直接修改。

<!-- INTERNAL -->

## 实现策略

`computeMeshBounds` 遍历所有子节点，只对 `isMesh === true` 的节点取 `geometry.boundingBox`，避免 Bone / Helper 等节点导致包围盒膨胀。若无 Mesh 则 fallback 到 `Box3.setFromObject`。

`normalizeModel` 两次调用 `computeMeshBounds`：第一次计算原始缩放因子，第二次在缩放后重新计算以精确居中。

`cloneModel` 先检测是否包含 SkinnedMesh，有则走 `SkeletonUtils.clone`（保留骨骼绑定），否则走 `Object3D.clone(true)`。

## 性能特性

- `computeMeshBounds` 调用 `updateMatrixWorld(true)`，对大场景图有开销，建议仅在加载时调用
- `loadAndNormalizeGLB` 使用 `GLTFLoader.loadAsync`，支持 async/await
- `cloneModel` 的 `SkeletonUtils.clone` 比普通 clone 慢但保证骨骼正确

## 设计取舍

- mesh-only 包围盒 vs `Box3.setFromObject`：后者会被骨骼根节点、辅助线等膨胀，导致缩放不准
- 二次包围盒计算：居中需要缩放后的精确坐标，一次计算无法兼顾
- SkinnedMesh 检测开销：遍历一次子节点代价远小于骨骼绑定丢失的 bug 排查成本
