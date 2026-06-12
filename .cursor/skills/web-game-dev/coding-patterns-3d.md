# 编码模式速查（Three.js 3D）

本项目已确立的编码模式。创建新文件时 **必须遵循** 这些模式，避免重新发明。

> **注意**：`src/core/` 和 `src/types/core.ts` 是由开发包同步维护的框架代码，禁止直接修改。运行 `node .cursor/sync.mjs pull` 可获取最新版本。需扩展框架功能时，在 `src/utils/` 或 `src/systems/` 中实现。

---

## 1. Entity 模式

### 1.1 构造函数标准步骤

```typescript
export class XxxEntity extends THREE.Group {
  private mesh: THREE.Mesh;
  private speed: number;

  constructor(config: XxxConfig) {
    super();

    // ① 创建几何体 + 材质
    const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.5,
      metalness: 0.2,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.add(this.mesh);

    // ② 属性赋值
    this.speed = config.speed;

    // ③ 设置初始位置
    this.position.set(config.x, config.y, config.z);
  }

  update(delta: number): void {
    // 每帧更新逻辑
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

### 1.2 模型加载实体

使用 glTF 模型时，**必须** 通过 `loadAndNormalizeGLB` 加载并归一化（自动缩放 + 居中 + 贴地）。
从网上下载的模型原点、尺寸、骨骼结构各异，不归一化会导致不可见、过大/过小等问题。

```typescript
import { loadAndNormalizeGLB, cloneModel } from '../core/ModelUtils';
import type { LoadGLBResult } from '../core/ModelUtils';

export class CharacterEntity extends THREE.Group {
  private mixer: THREE.AnimationMixer | null = null;

  async loadModel(url: string): Promise<void> {
    const result = await loadAndNormalizeGLB(url, {
      targetSize: 1.0,     // 最大维度归一到 1.0 单位
      scaleMultiplier: 1.0, // 微调倍率（可暴露为配置）
    });
    this.add(result.scene);

    if (result.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(result.scene);
      this.mixer.clipAction(result.animations[0]).play();
    }
  }

  update(delta: number): void {
    this.mixer?.update(delta);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
```

#### 预加载 + 克隆模式（多实例共享同一模型）

```typescript
// 预加载阶段（场景 onInit）
const template = await loadAndNormalizeGLB('assets/models/enemy.glb', {
  targetSize: 0.8,
});

// 创建实例时 — 必须用 cloneModel，否则含骨骼动画的模型克隆后会塌缩
const instance = cloneModel(template.scene);
scene.add(instance);
```
```

### 1.3 继承选择

| 基类 | 使用场景 |
|------|---------|
| `THREE.Mesh` | 单一几何体（地面、简单道具） |
| `THREE.Group` | 多部件组合、模型 + 附加物（角色、载具） |
| `THREE.InstancedMesh` | 大量相同几何体（子弹、粒子、植被） |

### 1.4 资源释放（必须遵循）

Three.js 不自动回收 GPU 资源，Entity 销毁时 **必须** 手动 dispose：

```typescript
dispose(): void {
  this.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => {
        m.dispose();
        // 释放贴图
        Object.values(m).forEach((val) => {
          if (val instanceof THREE.Texture) val.dispose();
        });
      });
    }
  });
  this.removeFromParent();
}
```

### 1.5 程序化动画（静态模型加动画）

从网上下载的模型大多没有内嵌动画。使用 `AnimationUtils` 可给任意静态模型添加程序化动画，
无需修改 GLB 文件。

**可用动画预设：**
| 类型 | 效果 | 典型用途 |
|------|------|---------|
| `float` | 上下悬浮 | 拾取物、漂浮道具 |
| `rotate` | Y 轴慢转 | 展示物品 |
| `breathe` | 均匀呼吸缩放 | 待机角色、NPC |
| `swing` | Z 轴左右摇摆 | 挂件、灯笼 |
| `bounce` | 弹跳 + 挤压 | 弹力物、卡通角色 |
| `spin-y` | Y 轴匀速旋转 | 金币、收集物 |

```typescript
import { loadAndNormalizeGLB, applyProceduralAnimations } from '../core';

// 加载静态模型 + 添加悬浮 & 呼吸动画
const result = await loadAndNormalizeGLB('assets/models/gem.glb', { targetSize: 0.5 });
this.add(result.scene);

const { mixer } = applyProceduralAnimations(result.scene, [
  { type: 'float', amplitude: 0.2, duration: 2.5 },
  { type: 'breathe', amplitude: 0.05 },
]);

// update 中驱动
update(delta: number): void {
  mixer.update(delta);
}
```

也可以用 `composeProceduralClip` 将多种动画合并为单个 clip（前提是它们操作不同属性）：

```typescript
import { composeProceduralClip } from '../core';

const clip = composeProceduralClip([
  { type: 'float', amplitude: 0.15 },
  { type: 'spin-y', duration: 4.0 },
]);
const mixer = new THREE.AnimationMixer(model);
mixer.clipAction(clip).play();
```

### 1.6 视觉反馈标准

- **受击**：材质 `emissive` 闪白 → 50ms 后恢复 + 位置抖动
- **死亡**：缩放 tween → `dispose()` + `removeFromParent()`
- **选中**：`OutlinePass` 或 `BoxHelper` 高亮

---

## 2. UI 模式

### 2.1 HTML Overlay（推荐）

3D 游戏 UI 使用 HTML DOM 覆盖层，不使用 Three.js 平面：

```typescript
private createHUD(): void {
  const overlay = document.getElementById('ui-overlay')!;
  const hud = document.createElement('div');
  hud.id = 'game-hud';
  hud.style.cssText = `
    position: absolute; top: 10px; left: 10px;
    font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff;
    pointer-events: none;
  `;
  overlay.appendChild(hud);
}
```

### 2.2 3D 世界内 UI（血条、名称）

使用 `CSS2DRenderer` 将 HTML 元素锚定到 3D 对象：

```typescript
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const label = document.createElement('div');
label.textContent = 'Player';
label.className = 'label-3d';
const labelObj = new CSS2DObject(label);
labelObj.position.set(0, 2, 0);  // 头顶偏移
entity.add(labelObj);
```

---

## 3. Manager/System 模式

### 3.1 标准结构

```typescript
export interface XxxManagerConfig {
  scene: THREE.Scene;
  getPlayerPosition: () => THREE.Vector3;
  onSomeEvent?: (data: EventData) => void;
}

export class XxxManager {
  private scene: THREE.Scene;
  private config: XxxManagerConfig;
  private entities: XxxEntity[] = [];

  constructor(config: XxxManagerConfig) {
    this.scene = config.scene;
    this.config = config;
  }

  start(): void { /* 启动逻辑 */ }

  update(delta: number): void {
    for (const entity of this.entities) {
      entity.update(delta);
    }
  }

  stop(): void { /* 停止逻辑 */ }

  dispose(): void {
    for (const entity of this.entities) {
      entity.dispose();
    }
    this.entities.length = 0;
  }
}
```

### 3.2 依赖注入原则

与 2D 相同：
- Manager 之间 **不互相引用**，通过配置传入的回调通信
- 数据查询用 getter 回调（`getXxx`），事件通知用 event 回调（`onXxx`）

---

## 4. 配置驱动模式

### 4.1 数据分离

```
src/config/data/*.json   ← 纯数值（非程序员可编辑）
src/config/balance.ts    ← 导入 JSON + 材质常量
src/config/layout.ts     ← 场景布局常量（位置、缩放）
```

### 4.2 JSON 结构约定

```json
{
  "globalSetting": 10,
  "types": {
    "typeName": { "speed": 5, "health": 100 }
  },
  "visuals": {
    "typeName": {
      "color": "0x00ff00",
      "roughness": 0.5,
      "metalness": 0.2
    }
  }
}
```

颜色值在 JSON 中用字符串 `"0x00ff00"`，在 `balance.ts` 中用 `parseInt()` 转为数字。

---

## 5. 场景模式

### 5.1 生命周期

```
onInit() → onEnter() → onUpdate(delta) / onRender(renderer) → onExit() → onDestroy()
```

| 方法 | 调用时机 | 典型用途 |
|------|---------|---------|
| `onInit()` | 首次进入（异步） | 加载资源、创建 3D 对象、灯光 |
| `onEnter()` | 每次切换到此场景 | 注册事件监听、重置状态 |
| `onUpdate(delta)` | 每帧 | 更新 Manager、物理、动画 |
| `onRender(renderer)` | 每帧渲染 | `renderer.render(scene, camera)` |
| `onResize(w, h)` | 窗口变化 | 更新相机宽高比 |
| `onExit()` | 离开场景 | 移除事件监听 |
| `onDestroy()` | 销毁 | 释放所有 GPU 资源 |

### 5.2 场景间数据传递

通过 `SceneManager.start()` 前设置共享状态，或使用 manager 上的自定义数据：

```typescript
// 方式一：全局状态对象
import { gameState } from '../state';
gameState.score = 100;
this.manager.start('ResultScene');

// 方式二：manager 上挂载共享数据
(this.manager as any).sharedData = { score: 100 };
this.manager.start('ResultScene');
```

---

## 6. 类型定义

所有游戏类型集中在 `src/types/index.ts`，包括：
- 场景配置（`SceneConfig`）
- 输入状态（`InputState`）
- 实体配置（`XxxConfig`）
- 游戏状态（`GameState`）

新增类型时 **追加** 到 `types/index.ts`，不要在模块内部定义公共类型。
