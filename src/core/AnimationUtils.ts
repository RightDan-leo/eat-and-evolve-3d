import * as THREE from 'three';
import type {
  ProceduralAnimationType,
  ProceduralAnimationOptions,
  ProceduralAnimationResult,
} from '../types/core';

interface PresetDefaults {
  duration: number;
  amplitude: number;
}

const PRESET_DEFAULTS: Record<ProceduralAnimationType, PresetDefaults> = {
  'float':   { duration: 2.0, amplitude: 0.15 },
  'rotate':  { duration: 4.0, amplitude: 1.0 },
  'breathe': { duration: 2.5, amplitude: 0.08 },
  'swing':   { duration: 1.8, amplitude: 0.15 },
  'bounce':  { duration: 0.8, amplitude: 0.2 },
  'spin-y':  { duration: 3.0, amplitude: 1.0 },
};

// ─── Clip Generators ─────────────────────────────────────────────────

function createFloatClip(duration: number, amplitude: number): THREE.AnimationClip {
  const steps = 60;
  const times = new Float32Array(steps);
  const values = new Float32Array(steps * 3);

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * duration;
    const y = Math.sin((t / duration) * Math.PI * 2) * amplitude;
    times[i] = t;
    values[i * 3] = 0;
    values[i * 3 + 1] = y;
    values[i * 3 + 2] = 0;
  }

  const track = new THREE.VectorKeyframeTrack('.position', times, values);
  return new THREE.AnimationClip('float', duration, [track]);
}

function createRotateClip(duration: number, _amplitude: number): THREE.AnimationClip {
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
  const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI * 2, 0));

  const times = new Float32Array([0, duration / 2, duration]);
  const values = new Float32Array([
    q0.x, q0.y, q0.z, q0.w,
    q1.x, q1.y, q1.z, q1.w,
    q2.x, q2.y, q2.z, q2.w,
  ]);

  const track = new THREE.QuaternionKeyframeTrack('.quaternion', times, values);
  return new THREE.AnimationClip('rotate', duration, [track]);
}

function createBreatheClip(duration: number, amplitude: number): THREE.AnimationClip {
  const steps = 60;
  const times = new Float32Array(steps);
  const values = new Float32Array(steps * 3);
  const base = 1.0;

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * duration;
    const s = base + Math.sin((t / duration) * Math.PI * 2) * amplitude;
    times[i] = t;
    values[i * 3] = s;
    values[i * 3 + 1] = s;
    values[i * 3 + 2] = s;
  }

  const track = new THREE.VectorKeyframeTrack('.scale', times, values);
  return new THREE.AnimationClip('breathe', duration, [track]);
}

function createSwingClip(duration: number, amplitude: number): THREE.AnimationClip {
  const steps = 60;
  const times = new Float32Array(steps);
  const values = new Float32Array(steps * 4);

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * duration;
    const angle = Math.sin((t / duration) * Math.PI * 2) * amplitude;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle));
    times[i] = t;
    values[i * 4] = q.x;
    values[i * 4 + 1] = q.y;
    values[i * 4 + 2] = q.z;
    values[i * 4 + 3] = q.w;
  }

  const track = new THREE.QuaternionKeyframeTrack('.quaternion', times, values);
  return new THREE.AnimationClip('swing', duration, [track]);
}

function createBounceClip(duration: number, amplitude: number): THREE.AnimationClip {
  const steps = 60;
  const times = new Float32Array(steps);
  const posValues = new Float32Array(steps * 3);
  const scaleValues = new Float32Array(steps * 3);

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * duration;
    const phase = (t / duration) * Math.PI * 2;
    const y = Math.abs(Math.sin(phase)) * amplitude;
    const squash = 1.0 - (1.0 - Math.abs(Math.sin(phase))) * 0.15;

    times[i] = t;

    posValues[i * 3] = 0;
    posValues[i * 3 + 1] = y;
    posValues[i * 3 + 2] = 0;

    scaleValues[i * 3] = 1.0 / squash;
    scaleValues[i * 3 + 1] = squash;
    scaleValues[i * 3 + 2] = 1.0 / squash;
  }

  const posTrack = new THREE.VectorKeyframeTrack('.position', times, posValues);
  const scaleTrack = new THREE.VectorKeyframeTrack('.scale', times, scaleValues);
  return new THREE.AnimationClip('bounce', duration, [posTrack, scaleTrack]);
}

function createSpinYClip(duration: number, _amplitude: number): THREE.AnimationClip {
  const steps = 4;
  const times = new Float32Array(steps);
  const values = new Float32Array(steps * 4);

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * duration;
    const angle = (i / (steps - 1)) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle,
    );
    times[i] = t;
    values[i * 4] = q.x;
    values[i * 4 + 1] = q.y;
    values[i * 4 + 2] = q.z;
    values[i * 4 + 3] = q.w;
  }

  const track = new THREE.QuaternionKeyframeTrack('.quaternion', times, values);
  track.setInterpolation(THREE.InterpolateLinear);
  return new THREE.AnimationClip('spin-y', duration, [track]);
}

const GENERATORS: Record<
  ProceduralAnimationType,
  (duration: number, amplitude: number) => THREE.AnimationClip
> = {
  'float': createFloatClip,
  'rotate': createRotateClip,
  'breathe': createBreatheClip,
  'swing': createSwingClip,
  'bounce': createBounceClip,
  'spin-y': createSpinYClip,
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate a procedural AnimationClip for a given preset type.
 * Works with any static model — animates .position, .quaternion, or .scale.
 */
export function createProceduralClip(
  type: ProceduralAnimationType,
  options: ProceduralAnimationOptions = {},
): THREE.AnimationClip {
  const defaults = PRESET_DEFAULTS[type];
  const duration = options.duration ?? defaults.duration;
  const amplitude = options.amplitude ?? defaults.amplitude;

  const clip = GENERATORS[type](duration, amplitude);
  if (options.name) clip.name = options.name;
  return clip;
}

/**
 * Create a mixer on the target, apply one or more procedural
 * animations, and return the mixer + actions.
 * Caller must call `mixer.update(delta)` each frame.
 */
export function applyProceduralAnimations(
  target: THREE.Object3D,
  animations: Array<{ type: ProceduralAnimationType } & ProceduralAnimationOptions>,
): ProceduralAnimationResult {
  const mixer = new THREE.AnimationMixer(target);
  const actions: THREE.AnimationAction[] = [];

  for (const anim of animations) {
    const { type, ...opts } = anim;
    const clip = createProceduralClip(type, opts);
    const action = mixer.clipAction(clip);

    if (opts.loop !== undefined) {
      action.setLoop(opts.loop, Infinity);
    }

    action.play();
    actions.push(action);
  }

  return { mixer, actions };
}

/**
 * Compose multiple animation types into a single clip by layering
 * their tracks. Clips must target different properties — duplicate
 * properties are skipped with a warning.
 */
export function composeProceduralClip(
  animations: Array<{ type: ProceduralAnimationType } & ProceduralAnimationOptions>,
  compositeName = 'composed',
): THREE.AnimationClip {
  const allTracks: THREE.KeyframeTrack[] = [];
  let maxDuration = 0;

  const usedProperties = new Set<string>();

  for (const anim of animations) {
    const { type, ...opts } = anim;
    const clip = createProceduralClip(type, opts);
    maxDuration = Math.max(maxDuration, clip.duration);

    for (const track of clip.tracks) {
      const prop = track.name;
      if (usedProperties.has(prop)) {
        console.warn(
          `[AnimationUtils] composeProceduralClip: duplicate property "${prop}" — later track skipped`,
        );
        continue;
      }
      usedProperties.add(prop);
      allTracks.push(track);
    }
  }

  return new THREE.AnimationClip(compositeName, maxDuration, allTracks);
}
