import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelBounds, NormalizeOptions, LoadGLBResult } from '../types/core';

/**
 * Draco 解码器路径。默认空 = 不启用（playable 单文件零外部请求）。
 * 若模型经 Draco 压缩，部署前设置本地解码器目录后调用 setDracoDecoderPath()。
 */
let dracoDecoderPath = '';
let sharedDraco: DRACOLoader | null = null;

export function setDracoDecoderPath(path: string): void {
  dracoDecoderPath = path;
  if (sharedDraco) { sharedDraco.dispose(); sharedDraco = null; }
}

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  if (dracoDecoderPath) {
    if (!sharedDraco) {
      sharedDraco = new DRACOLoader();
      sharedDraco.setDecoderPath(dracoDecoderPath);
    }
    loader.setDRACOLoader(sharedDraco);
  }
  return loader;
}

export function computeMeshBounds(object: THREE.Object3D): ModelBounds {
  object.updateMatrixWorld(true);

  const box = new THREE.Box3();
  let initialized = false;

  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const geo = (child as THREE.Mesh).geometry;
    if (!geo) return;

    geo.computeBoundingBox();
    if (!geo.boundingBox) return;

    const b = geo.boundingBox.clone();
    b.applyMatrix4(child.matrixWorld);

    if (!initialized) {
      box.copy(b);
      initialized = true;
    } else {
      box.union(b);
    }
  });

  if (!initialized) {
    box.setFromObject(object);
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  return { box, size, center, maxDim };
}

export function normalizeModel(
  object: THREE.Object3D,
  options: NormalizeOptions = {},
): ModelBounds {
  const {
    targetSize = 1.0,
    scaleMultiplier = 1.0,
    centerAndGround = true,
  } = options;

  const bounds = computeMeshBounds(object);

  if (bounds.maxDim > 0) {
    const fitScale = (targetSize / bounds.maxDim) * scaleMultiplier;
    object.scale.setScalar(fitScale);
  }

  if (centerAndGround) {
    const scaled = computeMeshBounds(object);
    object.position.set(
      -scaled.center.x,
      -scaled.box.min.y,
      -scaled.center.z,
    );
  }

  return bounds;
}

export function cloneModel(source: THREE.Object3D): THREE.Object3D {
  let hasSkin = false;
  source.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true;
  });

  return hasSkin
    ? (SkeletonUtils.clone(source) as THREE.Group)
    : source.clone(true);
}

export async function loadAndNormalizeGLB(
  url: string,
  options: NormalizeOptions = {},
): Promise<LoadGLBResult> {
  const loader = makeLoader();
  const gltf = await loader.loadAsync(url);
  const bounds = normalizeModel(gltf.scene, options);
  return { scene: gltf.scene, animations: gltf.animations, bounds };
}
