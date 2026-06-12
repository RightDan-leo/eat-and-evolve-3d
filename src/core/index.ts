export { SceneManager } from './SceneManager';
export { BaseScene } from './BaseScene';

/**
 * 模型加载与标准化 — GLB 加载、mesh-only 包围盒、自动缩放居中、骨骼安全克隆
 */
export {
  computeMeshBounds,
  normalizeModel,
  cloneModel,
  loadAndNormalizeGLB,
} from './ModelUtils';
export type { ModelBounds, NormalizeOptions, LoadGLBResult } from '../types/core';

/**
 * 程序化动画工具 — 为静态模型生成悬浮/旋转/呼吸等 AnimationClip
 */
export {
  createProceduralClip,
  applyProceduralAnimations,
  composeProceduralClip,
} from './AnimationUtils';
export type {
  ProceduralAnimationType,
  ProceduralAnimationOptions,
  ProceduralAnimationResult,
} from '../types/core';
