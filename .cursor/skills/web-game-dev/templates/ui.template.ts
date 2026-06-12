/**
 * UI 工具套件模板
 *
 * 复制到项目 src/utils/ui.ts 后使用。
 * 提供统一的主题色、文字样式、面板/按钮/卡片/遮罩工具函数。
 *
 * 使用方式：
 *   import { drawPanel, createButton, UI_COLORS, TEXT_STYLES } from '../utils/ui';
 *
 * 定制：
 *   - 修改 UI_COLORS 调整主题色
 *   - 修改 TEXT_STYLES 调整文字预设
 *   - 工具函数保持不变，通过 style 参数覆盖默认值
 */
import Phaser from 'phaser';

// ===== 主题色（按项目需求修改） =====
export const UI_COLORS = {
  // 面板
  panelBg: 0x1a1a3e,
  panelBgHover: 0x2a2a5e,
  panelBgDark: 0x151530,
  panelBgLocked: 0x111122,
  panelBorder: 0x4a4a6a,
  panelBorderHover: 0x9b59b6,
  panelBorderSelected: 0xf1c40f,
  panelBorderLocked: 0x333344,

  // 按钮
  buttonPrimary: 0x2ecc71,
  buttonPrimaryHover: 0x27ae60,
  buttonSecondary: 0x16213e,
  buttonSecondaryHover: 0x1a3a5c,

  // 文字（CSS 颜色字符串）
  title: '#f1c40f',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#888888',
  textDim: '#555555',
  textLocked: '#666666',

  // 遮罩
  overlay: 0x000000,
  overlayAlpha: 0.75,
} as const;

// ===== 文字样式预设（按项目需求增删） =====
export const TEXT_STYLES = {
  title: {
    fontSize: '24px', color: UI_COLORS.title,
    fontFamily: 'monospace', fontStyle: 'bold',
  },
  titleLarge: {
    fontSize: '28px', color: UI_COLORS.title,
    fontFamily: 'monospace', fontStyle: 'bold',
  },
  titleHuge: {
    fontSize: '48px', color: UI_COLORS.title,
    fontFamily: 'monospace', fontStyle: 'bold',
  },
  heading: {
    fontSize: '18px', color: UI_COLORS.text,
    fontFamily: 'monospace', fontStyle: 'bold',
  },
  body: {
    fontSize: '14px', color: UI_COLORS.text,
    fontFamily: 'monospace',
  },
  bodyBold: {
    fontSize: '14px', color: UI_COLORS.text,
    fontFamily: 'monospace', fontStyle: 'bold',
  },
  caption: {
    fontSize: '11px', color: UI_COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  captionMuted: {
    fontSize: '11px', color: UI_COLORS.textMuted,
    fontFamily: 'monospace',
  },
  label: {
    fontSize: '10px', color: UI_COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  small: {
    fontSize: '9px', color: UI_COLORS.textMuted,
    fontFamily: 'monospace',
  },
  version: {
    fontSize: '14px', color: UI_COLORS.textDim,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: '18px', color: UI_COLORS.textMuted,
    fontFamily: 'monospace',
  },
  subtitleSmall: {
    fontSize: '16px', color: UI_COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: '12px', color: UI_COLORS.textMuted,
    fontFamily: 'monospace',
  },
} as const;

// ===== Panel =====

export interface PanelStyle {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeWidth?: number;
  radius?: number;
}

const DEFAULT_PANEL: Required<PanelStyle> = {
  fillColor: 0x1a1a3e,
  fillAlpha: 0.95,
  strokeColor: 0x4a4a6a,
  strokeWidth: 2,
  radius: 10,
};

/**
 * 在已有 Graphics 上绘制圆角面板（不 clear，调用方按需 clear）。
 */
export function drawPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  style?: PanelStyle,
): void {
  const s = { ...DEFAULT_PANEL, ...style };
  gfx.fillStyle(s.fillColor, s.fillAlpha);
  gfx.fillRoundedRect(x, y, w, h, s.radius);
  if (s.strokeWidth > 0) {
    gfx.lineStyle(s.strokeWidth, s.strokeColor, 1);
    gfx.strokeRoundedRect(x, y, w, h, s.radius);
  }
}

/**
 * 创建一个新的 Graphics 并绘制面板。
 */
export function createPanel(
  scene: Phaser.Scene,
  x: number, y: number, w: number, h: number,
  style?: PanelStyle,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  drawPanel(gfx, x, y, w, h, style);
  return gfx;
}

// ===== Button =====

export interface ButtonConfig {
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  fillColor?: number;
  hoverColor?: number;
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  radius?: number;
}

/**
 * 创建带 hover 效果的按钮 Container（bg + label + hitArea）。
 *
 * 返回 Container，可通过 getData 获取内部元素：
 *   container.getData('bg')      → Graphics
 *   container.getData('label')   → Text
 *   container.getData('hitArea') → Rectangle
 */
export function createButton(
  scene: Phaser.Scene,
  x: number, y: number,
  config: ButtonConfig,
): Phaser.GameObjects.Container {
  const {
    width: bw, height: bh, label: text, onClick,
    fillColor = UI_COLORS.buttonPrimary,
    hoverColor = UI_COLORS.buttonPrimaryHover,
    radius = 8,
  } = config;
  const textStyle = config.textStyle ?? TEXT_STYLES.heading;

  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);
  container.add(bg);

  const labelObj = scene.add.text(0, 0, text, textStyle).setOrigin(0.5);
  container.add(labelObj);

  const hitArea = scene.add.rectangle(0, 0, bw, bh, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  container.add(hitArea);

  hitArea.on('pointerover', () => {
    bg.clear();
    bg.fillStyle(hoverColor, 1);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);
  });

  hitArea.on('pointerout', () => {
    bg.clear();
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);
  });

  hitArea.on('pointerdown', onClick);

  container.setData('bg', bg);
  container.setData('label', labelObj);
  container.setData('hitArea', hitArea);

  return container;
}

// ===== Interactive Card =====

export interface CardStyle {
  normal?: PanelStyle;
  hover?: PanelStyle;
  selected?: PanelStyle;
}

const DEFAULT_CARD_STYLE: Required<CardStyle> = {
  normal: { fillColor: UI_COLORS.panelBg, strokeColor: UI_COLORS.panelBorder },
  hover: { fillColor: UI_COLORS.panelBgHover, strokeColor: UI_COLORS.panelBorderHover },
  selected: { fillColor: UI_COLORS.panelBgHover, strokeColor: UI_COLORS.panelBorderSelected },
};

/**
 * 为 Container 添加可交互的卡片背景 + hover 效果。
 * bg 插入到 index 0（最底层），hitArea 添加到最顶层。
 *
 * 返回 { bg, hitArea } 供调用方进一步定制（如选中高亮）。
 */
export function addCardInteraction(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  w: number, h: number,
  onClick: () => void,
  style?: CardStyle,
): { bg: Phaser.GameObjects.Graphics; hitArea: Phaser.GameObjects.Rectangle } {
  const s = { ...DEFAULT_CARD_STYLE, ...style };

  const bg = scene.add.graphics();
  drawPanel(bg, -w / 2, -h / 2, w, h, s.normal);
  container.addAt(bg, 0);

  const hitArea = scene.add.rectangle(0, 0, w, h, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  container.add(hitArea);

  hitArea.on('pointerover', () => {
    bg.clear();
    drawPanel(bg, -w / 2, -h / 2, w, h, s.hover);
    container.setScale(1.03);
  });

  hitArea.on('pointerout', () => {
    bg.clear();
    drawPanel(bg, -w / 2, -h / 2, w, h, s.normal);
    container.setScale(1);
  });

  hitArea.on('pointerdown', onClick);

  return { bg, hitArea };
}

// ===== Overlay =====

/**
 * 创建全屏半透明遮罩（用于覆盖层场景），阻止点击穿透。
 */
export function createOverlay(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.cameras.main;
  return scene.add.rectangle(width / 2, height / 2, width, height,
    UI_COLORS.overlay, UI_COLORS.overlayAlpha,
  ).setInteractive();
}
