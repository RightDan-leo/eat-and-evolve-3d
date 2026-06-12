import type {
  Box3,
  Vector3,
  Object3D,
  AnimationClip,
  AnimationActionLoopStyles,
  AnimationMixer,
  AnimationAction,
} from 'three';

// ─── ModelUtils ──────────────────────────────────────

export interface ModelBounds {
  box: Box3;
  size: Vector3;
  center: Vector3;
  maxDim: number;
}

export interface NormalizeOptions {
  /** Target diameter to fit the model into (default: 1.0) */
  targetSize?: number;
  /** Additional scale multiplier on top of auto-fit (default: 1.0) */
  scaleMultiplier?: number;
  /** Center on XZ and ground on Y=0 (default: true) */
  centerAndGround?: boolean;
}

export interface LoadGLBResult {
  scene: Object3D;
  animations: AnimationClip[];
  bounds: ModelBounds;
}

// ─── AnimationUtils ──────────────────────────────────

export type ProceduralAnimationType =
  | 'float'
  | 'rotate'
  | 'breathe'
  | 'swing'
  | 'bounce'
  | 'spin-y';

export interface ProceduralAnimationOptions {
  name?: string;
  duration?: number;
  amplitude?: number;
  loop?: AnimationActionLoopStyles;
}

export interface ProceduralAnimationResult {
  mixer: AnimationMixer;
  actions: AnimationAction[];
}
