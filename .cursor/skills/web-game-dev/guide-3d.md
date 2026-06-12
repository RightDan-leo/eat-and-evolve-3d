# 3D 游戏开发指南（Three.js）

项目结构详见 [project-structure.md](project-structure.md)。

---

## 核心框架

### SceneManager

场景管理器，负责注册、切换场景和驱动渲染循环。

```typescript
manager.register('GameScene', GameScene);  // 注册
manager.start('GameScene');                // 切换
manager.dispose();                         // 销毁
```

### BaseScene

所有场景的基类，提供标准生命周期（`onInit` → `onEnter` → `onUpdate`/`onRender` → `onExit` → `onDestroy`）。

内置属性：`this.scene`（THREE.Scene）、`this.camera`（PerspectiveCamera）、`this.manager`（SceneManager）。

完整生命周期方法表详见 [coding-patterns-3d.md](coding-patterns-3d.md) 场景模式章节。

---

## 常用操作

### 添加新场景

1. 在 `src/scenes/` 创建场景文件（继承 `BaseScene`）：

```typescript
import { BaseScene } from '../core/BaseScene';
import type { SceneManager } from '../core/SceneManager';

export class NewScene extends BaseScene {
  constructor(manager: SceneManager) {
    super(manager);
  }

  async onInit(): Promise<void> {
    // 初始化 3D 对象、灯光、相机
  }

  onEnter(): void {
    // 进入场景时
  }

  onUpdate(delta: number): void {
    // 每帧更新
  }
}
```

2. 在 `src/main.ts` 注册：

```typescript
import { NewScene } from './scenes/NewScene';
manager.register('NewScene', NewScene);
```

### 添加新实体

在 `src/entities/` 创建实体类。推荐组合方式：
- `THREE.Mesh` - 基础 3D 对象
- `THREE.Group` - 组合对象
- 加载 glTF 模型作为实体外观

### 加载资源

在场景的 `onInit()` 中加载：

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

const gltfLoader = new GLTFLoader();
const model = await gltfLoader.loadAsync('assets/models/character.glb');
this.scene.add(model.scene);

const textureLoader = new TextureLoader();
const texture = textureLoader.load('assets/textures/ground.png');
```

### 3D 模型配置

本框架支持配置驱动的模型加载。玩家和各类角色/敌人均通过 JSON 配置指定模型参数。

#### ModelConfig 接口

```typescript
interface ModelConfig {
  modelPath: string;      // 模型文件路径（以 / 开头），空字符串 = 无模型
  modelScale: number;     // 统一缩放倍数，默认 1
  modelRotationY: number; // Y 轴旋转角度（度），默认 0
}
```

#### JSON 配置示例

玩家（`player.json`）：

```json
{
  "modelPath": "/models/afonso/afonso.fbx",
  "modelScale": 0.02,
  "modelRotationY": 180
}
```

敌人/角色（`enemies.json`）— 每个类型都有相同的 model 字段：

```json
{
  "slime": {
    "modelPath": "",
    "modelScale": 1,
    "modelRotationY": 0
  }
}
```

`modelPath` 为空字符串时，实体使用程序生成的几何体作为占位外观。

#### 模型文件组织

```
public/models/
└── <模型名>/
    ├── <模型名>.fbx         # FBX 模型文件
    ├── <模型名>_d.png       # 漫反射贴图
    └── <模型名>_mask.png    # 遮罩贴图（可选）
```

**规则**：

| 规则 | 说明 |
|------|------|
| 一模型一目录 | 目录名 = 模型名 |
| 贴图同目录 | 贴图必须与 FBX 放在同一目录 |
| 贴图格式 `.png` | 浏览器不支持 TGA/TIF/BMP/DDS，须转为 PNG |
| 自动重定向 | TextureManager 自动将 FBX 内部贴图引用重定向到模型目录 |
| 格式自动替换 | 不支持的贴图格式（TGA/TIF/BMP/DDS）自动替换为同名 `.png` |
| 动画自动播放 | 若 FBX 包含动画，加载后自动播放第一个 clip 作为 idle |

#### 为新角色添加模型

1. 将 FBX + PNG 贴图放到 `public/models/<模型名>/`
2. 在对应的 JSON 配置文件中填写 `modelPath`、`modelScale`、`modelRotationY`
3. 无需改代码，框架自动通过 `getModelConfig()` 读取并加载

### 修改游戏配置

编辑 `src/config/game.config.ts`：
- `CAMERA_CONFIG`: 相机 FOV、近远裁剪面、初始位置
- `RENDERER_CONFIG`: 抗锯齿、性能偏好

---

## PC 和移动端适配

已内置：
- **PC**: 键盘（WASD/方向键）+ 鼠标（OrbitControls）
- **移动端**: OrbitControls 内置触摸支持（双指缩放、单指旋转）

---

## 调试

开发模式下：
- 场景管理器挂载到 `window.manager`

```javascript
manager.renderer.info  // 渲染器信息
```

常用调试工具：
```typescript
import { AxesHelper, GridHelper, BoxHelper } from 'three';

this.scene.add(new AxesHelper(5));             // 坐标轴
this.scene.add(new GridHelper(20, 20));         // 网格
this.scene.add(new BoxHelper(mesh, 0xff0000));  // 包围盒
```

---

## 编码模式

详见 [coding-patterns-3d.md](coding-patterns-3d.md)，包含：
- Entity 模式（几何体创建、模型加载、资源释放）
- UI 模式（HTML Overlay、CSS2DRenderer）
- Manager/System 模式（依赖注入）
- 配置驱动模式
- 场景模式（BaseScene 生命周期、场景切换）

---

## 参考文档

- [Three.js 文档](https://threejs.org/docs/)
- [Three.js 示例](https://threejs.org/examples/)
- [Three.js 编辑器](https://threejs.org/editor/)
