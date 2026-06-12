# 2D 游戏开发指南（Phaser 3）

项目结构详见 [project-structure.md](project-structure.md)。

---

## 常用操作

### 添加新场景

1. 在 `src/scenes/` 创建场景文件（参考 [templates/scene.template.ts](templates/scene.template.ts)）

2. 在 `src/config/game.config.ts` 注册：

```typescript
import { NewScene } from '../scenes/NewScene';
scene: [..., NewScene],
```

### 添加新实体

在 `src/entities/` 创建实体类（参考 [templates/entity.template.ts](templates/entity.template.ts)）

继承选择和构造函数模式详见 [coding-patterns-2d.md](coding-patterns-2d.md)。

### 加载资源

在 `PreloadScene.ts` 的 `loadAssets()` 中添加：

```typescript
this.load.image('key', 'assets/images/file.png');
this.load.spritesheet('key', 'assets/images/file.png', {
  frameWidth: 32, frameHeight: 32,
});
this.load.audio('key', 'assets/audio/file.mp3');
```

### 修改游戏配置

编辑 `src/config/game.config.ts`：
- `width/height`: 画布尺寸
- `physics.arcade.gravity`: 重力
- `scale.mode`: 缩放模式

---

## PC 和移动端适配

已内置：
- **PC**: 键盘（方向键/WASD）
- **移动端**: 自动缩放，触摸支持

虚拟摇杆（移动端）：
```bash
npm install phaser3-rex-plugins
```

---

## 调试

开发模式下：
- 物理碰撞框可见（`debug: true`）
- 游戏实例挂载到 `window.game`

```javascript
game.scene.scenes  // 查看场景
game.registry.list // 查看数据
```

---

## 编码模式

详见 [coding-patterns-2d.md](coding-patterns-2d.md)，包含：
- Entity 模式（构造函数、纹理缓存、继承选择）
- UI 模式（使用 `src/utils/ui.ts`）
- Manager/System 模式（依赖注入）
- 配置驱动模式
- 场景模式（生命周期、数据传递、碰撞注册）

---

## 参考文档

- [Phaser 3 文档](https://phaser.io/docs)
- [Phaser 3 示例](https://phaser.io/examples)
- [场景模板](templates/scene.template.ts)
- [实体模板](templates/entity.template.ts)
