# 项目结构详解

## 目录说明

### src/config/
游戏配置文件。

**game.config.ts — 引擎配置**

2D 项目：
- `GAME_CONFIG`: Phaser 游戏主配置
- `GAME_CONSTANTS`: 游戏常量（场景名、资源路径等）

3D 项目：
- `RENDERER_CONFIG`: Three.js 渲染器配置
- `CAMERA_CONFIG`: 相机参数（FOV、裁剪面、初始位置）
- `SCENES`: 场景注册表
- `GAME_CONSTANTS`: 游戏常量

**data/*.json — 游戏数值配置**

所有可调数值（速度、血量、伤害、难度参数等）提取到 JSON 文件，配合 Config Editor 实现可视化调参 + HMR 热更新。每个 JSON 文件需在 `tools/config-editor/schemas.ts` 中定义对应 schema。

### src/core/（仅 3D 项目）
Three.js 核心框架代码。

| 文件 | 职责 |
|------|------|
| SceneManager.ts | 场景管理器：注册、切换、渲染循环、窗口缩放 |
| BaseScene.ts | 场景基类：提供 onInit/onEnter/onExit/onUpdate/onRender 生命周期 |

### src/scenes/
游戏场景，每个场景负责一个独立的游戏画面。

**2D 项目场景：**

| 场景 | 职责 |
|------|------|
| BootScene | 初始化游戏设置 |
| PreloadScene | 加载资源、显示进度 |
| MainMenuScene | 主菜单界面 |
| GameScene | 核心游戏逻辑 |

**3D 项目场景：**

| 场景 | 职责 |
|------|------|
| LoadingScene | 资源加载、进度条 |
| MainMenuScene | 主菜单界面（HTML Overlay + 3D 背景） |
| GameScene | 核心游戏逻辑（轨道控制器 + 玩家移动） |

### src/entities/
游戏实体类，如玩家、敌人、道具等。继承选择详见对应引擎的 coding-patterns 文档。

### src/components/
可复用的游戏组件，如血条、按钮、对话框等。

### src/systems/
游戏系统，处理全局逻辑：
- 碰撞系统
- 计分系统
- 存档系统
- 音频系统

### src/types/
TypeScript 类型定义。

### src/utils/
工具函数，如数学计算、随机数生成等。

### assets/
游戏资源文件。

**2D 项目：**

| 目录 | 内容 |
|------|------|
| images/ | 图片、精灵表 |
| audio/ | 音效、背景音乐 |
| fonts/ | 自定义字体 |

**3D 项目：**

| 目录 | 内容 |
|------|------|
| models/ | 3D 模型（glTF/glb 格式推荐） |
| textures/ | 纹理贴图 |
| audio/ | 音效、背景音乐 |
| fonts/ | 自定义字体 |

### specs/
SDD 规格文档，描述游戏功能和行为。

## 文件命名约定

- 场景：`XxxScene.ts`（PascalCase + Scene 后缀）
- 实体：`Xxx.ts`（PascalCase）
- 工具：`xxx.ts`（camelCase）
- 类型：`index.ts` 或 `xxx.types.ts`
