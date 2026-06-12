# 编码模式速查

本项目已确立的编码模式。创建新文件时 **必须遵循** 这些模式，避免重新发明。

---

## 1. Entity 模式

### 1.1 构造函数标准步骤

```typescript
constructor(scene: Phaser.Scene, x: number, y: number, config: XxxConfig) {
  // ① 纹理（如果是 Sprite）
  XxxEntity.ensureTexture(scene, config);
  super(scene, x, y, textureKey);  // 或 super(scene, x, y) for Container

  // ② 属性赋值
  this.hp = config.hp;
  this.speed = config.speed;

  // ③ 注册到场景
  scene.add.existing(this);
  scene.physics.add.existing(this);  // 需要物理时

  // ④ 物理体设置
  const body = this.body as Phaser.Physics.Arcade.Body;
  body.setCircle(config.radius);  // 或 body.setSize(w, h)
  body.setBounce(1, 1);
  body.setCollideWorldBounds(true);
}
```

### 1.2 纹理缓存（必须遵循）

所有程序化纹理 **必须** 使用双重缓存检查：

```typescript
private static createdTextures = new Set<string>();

private static ensureTexture(scene: Phaser.Scene, config: XxxConfig): void {
  const key = `__xxx_${config.type}__`;
  if (this.createdTextures.has(key)) return;
  if (scene.textures.exists(key)) {
    this.createdTextures.add(key);
    return;
  }

  const size = config.radius * 2 + 4;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();

  // ... Canvas 2D 绘制逻辑 ...

  canvas.refresh();
  this.createdTextures.add(key);
}
```

### 1.3 继承选择

| 基类 | 使用场景 |
|------|---------|
| `Phaser.Physics.Arcade.Sprite` | 单一物理体 + 纹理（Ball） |
| `Phaser.GameObjects.Container` | 多图形组合、多 hitbox（Enemy、Player、Pickup） |

Container 模式下，hitbox 是独立的 `Phaser.Physics.Arcade.Image`，需手动 `syncPosition()`。

### 1.4 视觉反馈标准

- **受击**：`setTint(0xffffff)` → 50ms 后 `clearTint()` + 位置抖动 tween
- **死亡**：`scene.tweens.add({ targets, scale: 0, alpha: 0, duration: 200 })` → `destroy()`
- **碰撞形变**：`killTweensOf` + `setScale(1)` 再开始新 tween（防止堆叠）

---

## 2. UI 模式

### 2.1 使用 `src/utils/ui.ts`（必须）

**所有 UI 元素** 统一使用 `src/utils/ui.ts` 提供的工具函数，禁止手写 `fillRoundedRect` / `strokeRoundedRect`。

```typescript
import { drawPanel, createButton, UI_COLORS, TEXT_STYLES } from '../utils/ui';

// 面板
const gfx = scene.add.graphics();
drawPanel(gfx, -w / 2, -h / 2, w, h);                    // 默认样式
drawPanel(gfx, x, y, w, h, { fillColor: 0x2a2a5e });      // 自定义

// 按钮
const btn = createButton(scene, x, y, {
  width: 200, height: 44,
  text: '开始',
  onClick: () => { /* ... */ },
});

// 文字样式
scene.add.text(x, y, '标题', TEXT_STYLES.title).setOrigin(0.5);
```

### 2.2 hover 效果模式

卡片 hover 需要 clear + 重绘：

```typescript
hitArea.on('pointerover', () => {
  bg.clear();
  drawPanel(bg, -w / 2, -h / 2, w, h, {
    fillColor: UI_COLORS.panelBgHover,
    strokeColor: UI_COLORS.panelBorderHover,
  });
});
```

---

## 3. Manager/System 模式

### 3.1 标准结构

```typescript
export interface XxxManagerConfig {
  // 依赖通过回调注入，不直接引用其他 Manager
  getPlayerPosition: () => { x: number; y: number };
  onSomeEvent?: (data: EventData) => void;
}

export class XxxManager {
  private scene: Phaser.Scene;
  private config: XxxManagerConfig;
  private items: Entity[] = [];

  constructor(scene: Phaser.Scene, config: XxxManagerConfig) {
    this.scene = scene;
    this.config = config;
  }

  start(): void { /* 启动定时器等 */ }
  update(delta: number): void { /* 每帧逻辑 */ }
  stop(): void { /* 停止定时器 */ }
  destroy(): void { /* 清理所有资源 */ }
}
```

### 3.2 依赖注入原则

- Manager 之间 **不互相引用**，通过 Scene 传入的回调通信
- 数据查询用 getter 回调（`getXxx`），事件通知用 event 回调（`onXxx`）

---

## 4. 配置驱动模式

### 4.1 数据分离

```
src/config/data/*.json   ← 纯数值（非程序员可编辑）
src/config/balance.ts    ← 导入 JSON + 视觉常量（颜色等）
src/config/layout.ts     ← 布局常量（画布尺寸、区域划分）
```

### 4.2 JSON 结构约定

```json
{
  "globalSetting": 10,
  "types": {
    "typeName": { "baseDamage": 5, "speed": 300 }
  },
  "visuals": {
    "typeName": { "color": "0xffffff", "strokeColor": "0x81d4fa" }
  }
}
```

视觉值在 JSON 中用字符串 `"0xffffff"`，在 `balance.ts` 中用 `parseInt()` 转为数字。

---

## 5. 场景模式

### 5.1 生命周期

```typescript
init(data?: SceneData)  →  create()  →  update(time, delta)
```

- `init`：接收从其他场景传递的数据
- `create`：创建对象、注册碰撞、初始化 Manager、创建 HUD
- `update`：每帧更新 Manager + HUD

### 5.2 场景间数据传递

```typescript
// 启动
this.scene.start('TargetScene', { key: value });
// 覆盖层
this.scene.launch('OverlayScene', data);
this.scene.pause();
// 恢复
this.scene.stop();
this.scene.resume('ParentScene');
```

### 5.3 物理碰撞注册

```typescript
this.physics.add.overlap(groupA, groupB, (a, b) => {
  // callback
}, undefined, this);
```

---

## 6. 类型定义

所有游戏类型集中在 `src/types/index.ts`，包括：
- 球种类型（`BallType`、`BallTypeConfig`）
- 敌人类型（`EnemyConfig`、`EnemyType`）
- 升级选项（`LevelUpOption`、`LevelUpOptionType`）
- 游戏状态（`GameState`）

新增类型时 **追加** 到 `types/index.ts`，不要在模块内部定义公共类型。
