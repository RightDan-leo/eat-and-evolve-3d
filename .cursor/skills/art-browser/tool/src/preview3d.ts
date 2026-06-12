import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let animFrameId: number | null = null;
let mixer: THREE.AnimationMixer | null = null;
let clock: THREE.Clock | null = null;
let resizeObs: ResizeObserver | null = null;
let currentClips: THREE.AnimationClip[] = [];
let currentObject: THREE.Object3D | null = null;

/**
 * Create a LoadingManager that redirects texture requests to the model's
 * directory via our API. FBX files often store absolute Unity paths like
 * "D:\Projects\Game\Assets\Models\tex.png" — the modifier strips the path
 * and resolves the bare filename against the model's API base URL.
 */
function createTextureManager(modelUrl: string): THREE.LoadingManager {
  const baseUrl = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);

  const manager = new THREE.LoadingManager();

  // Let FBXLoader / OBJLoader decode .tga textures via Three.js TGALoader
  manager.addHandler(/\.tga$/i, new TGALoader(manager));

  manager.setURLModifier((url: string) => {
    if (
      url.startsWith('/api/') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {
      return url;
    }

    const filename = url.replace(/\\/g, '/').split('/').pop() || url;
    return baseUrl + encodeURIComponent(filename);
  });

  return manager;
}

/**
 * Fix common FBX material issues: the FBXLoader often puts the diffuse
 * color/map into the emissive channel, making the model "self-lit" and
 * completely unresponsive to scene lights.
 */
function fixMaterials(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshPhongMaterial;
      if (!m.color || !m.emissive) continue;

      const emH = m.emissive.getHex();
      const colH = m.color.getHex();

      if (emH !== 0x000000) {
        // Emissive has actual color — likely misplaced diffuse data
        if (colH === 0xffffff || colH === 0x000000) {
          m.color.copy(m.emissive);
        }
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }

      // Emissive map but no diffuse map → move it
      if (m.emissiveMap && !m.map) {
        m.map = m.emissiveMap;
        m.emissiveMap = null;
      }

      m.needsUpdate = true;
    }
  });
}

export interface MaterialInfo {
  meshCount: number;
  materialsFixed: boolean;
  materials: {
    name: string;
    type: string;
    color: string;
    emissive: string;
    hasMap: boolean;
    hasNormalMap: boolean;
    hasEmissiveMap: boolean;
    mapNames: string[];
  }[];
}

function collectMaterialInfo(object: THREE.Object3D): MaterialInfo {
  const seen = new Set<number>();
  const materials: MaterialInfo['materials'] = [];
  let meshCount = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshCount++;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);

      const mapNames: string[] = [];
      const stdMat = m as THREE.MeshStandardMaterial & THREE.MeshPhongMaterial;

      if (stdMat.map) mapNames.push('diffuse');
      if (stdMat.normalMap) mapNames.push('normal');
      if (stdMat.emissiveMap) mapNames.push('emissive');
      if (stdMat.aoMap) mapNames.push('ao');
      if (stdMat.specularMap) mapNames.push('specular');
      if (stdMat.bumpMap) mapNames.push('bump');
      if (stdMat.metalnessMap) mapNames.push('metalness');
      if (stdMat.roughnessMap) mapNames.push('roughness');

      materials.push({
        name: m.name || '(unnamed)',
        type: m.type,
        color: '#' + (stdMat.color?.getHexString?.() || 'ffffff'),
        emissive: '#' + (stdMat.emissive?.getHexString?.() || '000000'),
        hasMap: !!stdMat.map,
        hasNormalMap: !!stdMat.normalMap,
        hasEmissiveMap: !!stdMat.emissiveMap,
        mapNames,
      });
    }
  });

  const materialsFixed = materials.every(
    (m) => m.emissive === '#000000' || m.emissive === '#000000',
  );

  return { meshCount, materialsFixed, materials };
}

export interface Preview3DCallbacks {
  onAnimationsFound?: (clips: THREE.AnimationClip[]) => void;
  onLoadProgress?: (progress: number) => void;
  onLoadError?: (error: string) => void;
  onLoaded?: () => void;
  onMaterialsInfo?: (info: MaterialInfo) => void;
}

export function init3DPreview(
  container: HTMLElement,
  modelUrl: string,
  extension: string,
  callbacks?: Preview3DCallbacks,
) {
  cleanup3DPreview();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const width = container.clientWidth;
  const height = container.clientHeight;
  camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 5000);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Hemisphere light — natural sky/ground ambient fill
  const hemiLight = new THREE.HemisphereLight(0xc8ddf0, 0x584430, 0.8);
  scene.add(hemiLight);

  // Key light — main directional from upper-right-front
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(5, 8, 7);
  scene.add(keyLight);

  // Fill light — softer from left side to reduce harsh shadows
  const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.6);
  fillLight.position.set(-6, 3, -2);
  scene.add(fillLight);

  // Rim/back light — edge definition from behind
  const rimLight = new THREE.DirectionalLight(0xfff0dd, 0.5);
  rimLight.position.set(0, 4, -8);
  scene.add(rimLight);

  // Subtle bottom bounce light
  const bounceLight = new THREE.DirectionalLight(0x8090a0, 0.25);
  bounceLight.position.set(0, -3, 2);
  scene.add(bounceLight);

  const grid = new THREE.GridHelper(20, 20, 0x333355, 0x222244);
  scene.add(grid);

  clock = new THREE.Clock();

  loadModel(modelUrl, extension, callbacks);
  animate();

  resizeObs = new ResizeObserver(() => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObs.observe(container);
}

/**
 * Mesh-only bounding box — excludes Bone, Helper, Light etc. that inflate
 * Box3.setFromObject and cause wrong centering on skinned models.
 */
function computePreviewBounds(object: THREE.Object3D) {
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

function loadModel(
  url: string,
  extension: string,
  callbacks?: Preview3DCallbacks,
) {
  const onProgress = (event: ProgressEvent) => {
    if (event.lengthComputable && callbacks?.onLoadProgress) {
      callbacks.onLoadProgress(event.loaded / event.total);
    }
  };

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks?.onLoadError?.(msg);
  };

  const handleLoaded = (
    object: THREE.Object3D,
    animations?: THREE.AnimationClip[],
  ) => {
    if (!scene || !camera || !controls) return;

    fixMaterials(object);

    currentObject = object;
    scene.add(object);

    const { maxDim } = computePreviewBounds(object);

    if (maxDim > 0) {
      const scale = 2.5 / maxDim;
      object.scale.multiplyScalar(scale);
    }

    const scaled = computePreviewBounds(object);
    object.position.set(
      -scaled.center.x,
      -scaled.box.min.y,
      -scaled.center.z,
    );

    camera.position.set(0, 1.5, 4);
    controls.target.set(0, 0.8, 0);
    controls.update();

    if (animations && animations.length > 0) {
      currentClips = animations;
      mixer = new THREE.AnimationMixer(object);
      mixer.clipAction(animations[0]).play();
      callbacks?.onAnimationsFound?.(animations);
    }

    callbacks?.onMaterialsInfo?.(collectMaterialInfo(object));
    callbacks?.onLoaded?.();
  };

  const manager = createTextureManager(url);

  switch (extension.toLowerCase()) {
    case '.fbx': {
      const loader = new FBXLoader(manager);
      loader.load(url, (group) => handleLoaded(group, group.animations), onProgress, onError);
      break;
    }
    case '.obj': {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const baseName = url.substring(url.lastIndexOf('/') + 1).replace(/\.obj$/i, '');
      const mtlUrl = baseUrl + encodeURIComponent(baseName + '.mtl');

      const mtlLoader = new MTLLoader(manager);
      mtlLoader.load(
        mtlUrl,
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader(manager);
          objLoader.setMaterials(materials);
          objLoader.load(url, (group) => handleLoaded(group), onProgress, onError);
        },
        undefined,
        () => {
          // .mtl not found — load OBJ without materials
          const objLoader = new OBJLoader(manager);
          objLoader.load(url, (group) => handleLoaded(group), onProgress, onError);
        },
      );
      break;
    }
    case '.gltf':
    case '.glb': {
      const loader = new GLTFLoader(manager);
      loader.load(url, (gltf) => handleLoaded(gltf.scene, gltf.animations), onProgress, onError);
      break;
    }
    default:
      callbacks?.onLoadError?.(`不支持的模型格式: ${extension}`);
  }
}

export function setExposure(value: number) {
  if (renderer) renderer.toneMappingExposure = value;
}

export function getExposure(): number {
  return renderer?.toneMappingExposure ?? 1.5;
}

export function playAnimation(index: number) {
  if (!mixer || !currentObject || index < 0 || index >= currentClips.length) return;

  mixer.stopAllAction();
  mixer.clipAction(currentClips[index]).reset().play();
}

function animate() {
  animFrameId = requestAnimationFrame(animate);

  if (mixer && clock) {
    mixer.update(clock.getDelta());
  }
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export function cleanup3DPreview() {
  if (animFrameId != null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
    renderer = null;
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        materials.forEach((m) => {
          if (m && typeof m.dispose === 'function') m.dispose();
        });
      }
    });
    scene = null;
  }
  camera = null;
  clock = null;
  currentClips = [];
  currentObject = null;
}

/**
 * Load a standalone TGA image and render it to a <canvas> inside `container`.
 * Used for previewing .tga files that browsers can't display natively.
 */
export function loadTGAToCanvas(
  url: string,
  container: HTMLElement,
  callbacks?: { onLoaded?: () => void; onError?: (msg: string) => void },
) {
  const loader = new TGALoader();
  loader.load(
    url,
    (texture) => {
      // DataTexture.image = { data: Uint8Array, width, height } — not ImageData
      const img = texture.image as { data: Uint8Array; width: number; height: number };
      const { data, width, height } = img;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      const clamped = new Uint8ClampedArray(data.length);
      clamped.set(data);
      const imageData = new ImageData(clamped, width, height);
      ctx.putImageData(imageData, 0, 0);

      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.objectFit = 'contain';
      container.appendChild(canvas);
      callbacks?.onLoaded?.();
    },
    undefined,
    (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(msg);
    },
  );
}
