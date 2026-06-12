import type { SceneConfig } from '../types';
import playerData from './data/player.json';
import cameraData from './data/camera.json';
import fxData from './data/fx.json';
import audioData from './data/audio.json';
import { ENEMY_SIZE } from '../logic/config/enemies';

export { ENEMY_SIZE };

const hex = (s: string): number => Number(s);

export const RENDERER_CONFIG = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance' as const,
};

export const CAMERA_CONFIG = {
  fov: 75,
  near: 0.1,
  far: 1000,
  position: { x: 0, y: 5, z: 10 },
  lookAt: { x: 0, y: 0, z: 0 },
};

export const SCENES: Record<string, SceneConfig> = {
  LOADING: { id: 'LoadingScene', label: '加载' },
  MAIN_MENU: { id: 'MainMenuScene', label: '主菜单' },
  GAME: { id: 'GameScene', label: '游戏' },
} as const;

export const GAME_CONSTANTS = {
  SCENES,
  ASSETS: {
    BASE_PATH: '/assets/',
    MODELS: '/assets/models/',
    TEXTURES: '/assets/textures/',
    AUDIO: '/assets/audio/',
  },
} as const;

// ─── 玩家 / 相机 / 输入 / 特效 / 音效（均从 src/config/data/*.json 加载）─────────

/** 体型随等级的连续曲线采样点（分段线性插值）。 */
export const SIZE_BY_LEVEL: ReadonlyArray<{ level: number; scale: number }> = playerData.sizeByLevel;

/** 相机随等级（体型）的连续拉远曲线（distance=水平距离、height=高度）。 */
export const CAMERA_BY_LEVEL: ReadonlyArray<{ level: number; distance: number; height: number }> = cameraData.byLevel;

export const CAMERA_RIG_CONFIG = {
  followLerp: cameraData.rig.followLerp,
  zoomLerp: cameraData.rig.zoomLerp,
  pixelRatioCap: cameraData.rig.pixelRatioCap,
};

export const INPUT_CONFIG = {
  joystickRadius: playerData.joystick.radius,
  deadZone: playerData.joystick.deadZone,
  moveSpeedByLevel: playerData.moveSpeedByLevel as ReadonlyArray<{ level: number; speed: number }>,
};

export const AUDIO = {
  enabled: audioData.enabled,
  masterVolume: audioData.masterVolume,
};

export const FX_CONFIG = {
  devour: {
    chunkCount: fxData.devour.chunkCount,
    burstSpeed: fxData.devour.burstSpeed,
    burstHold: fxData.devour.burstHold,
    homeSpeed: fxData.devour.homeSpeed,
    pulseScale: fxData.devour.pulseScale,
    chunkColor: hex(fxData.devour.chunkColor),
  },
  evolution: {
    ringColor: hex(fxData.evolution.ringColor),
    ringDuration: fxData.evolution.ringDuration,
    ringMaxRadius: fxData.evolution.ringMaxRadius,
    punchScale: fxData.evolution.punchScale,
  },
};

/** 敌人体型相对玩家的比例（按等级差，含语义钳制） */
export function enemyScaleRatio(diff: number): number {
  const t = ENEMY_SIZE.scaleByDiff;
  let ratio: number;
  if (diff <= t[0].diff) ratio = t[0].scale;
  else if (diff >= t[t.length - 1].diff) ratio = t[t.length - 1].scale;
  else {
    ratio = t[t.length - 1].scale;
    for (let i = 0; i < t.length - 1; i++) {
      if (diff >= t[i].diff && diff <= t[i + 1].diff) {
        const k = (diff - t[i].diff) / (t[i + 1].diff - t[i].diff);
        ratio = t[i].scale + (t[i + 1].scale - t[i].scale) * k;
        break;
      }
    }
  }
  if (diff <= 0) return Math.min(ratio, ENEMY_SIZE.sameOrLowerMaxRatio);
  return Math.max(ratio, ENEMY_SIZE.higherMinRatio);
}

/** 在采样曲线上做分段线性插值 */
export function sampleByLevel<K extends string>(
  samples: ReadonlyArray<{ level: number } & Record<K, number>>,
  level: number,
  key: K,
): number {
  if (level <= samples[0].level) return samples[0][key];
  const last = samples[samples.length - 1];
  if (level >= last.level) return last[key];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (level >= a.level && level <= b.level) {
      const t = (level - a.level) / (b.level - a.level);
      return a[key] + (b[key] - a[key]) * t;
    }
  }
  return last[key];
}
