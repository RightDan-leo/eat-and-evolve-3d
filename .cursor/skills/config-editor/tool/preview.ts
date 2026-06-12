/**
 * Config Editor — 3D Model Preview Module (Template)
 *
 * 通用 Three.js 模型预览，支持 GLB/GLTF 和 FBX 格式。
 * 此文件在 init 时复制到项目 tools/config-editor/preview.ts，
 * 项目可根据需要修改（如添加自定义 texture manager）。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let animFrameId: number | null = null;
let mixer: THREE.AnimationMixer | null = null;
let clock: THREE.Clock | null = null;
let resizeObs: ResizeObserver | null = null;

const isGLB = (p: string) => /\.gl(b|tf)$/i.test(p);

function fixMaterials(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshPhongMaterial;
      if (!m.color || !m.emissive) continue;
      if (m.emissiveMap && !m.map) {
        m.map = m.emissiveMap;
        m.emissiveMap = null;
      }
      if (m.map) {
        m.color.setHex(0xffffff);
      } else {
        const emH = m.emissive.getHex();
        const colH = m.color.getHex();
        if (emH !== 0x000000 && (colH === 0xffffff || colH === 0x000000)) {
          m.color.copy(m.emissive);
        }
      }
      m.emissive.setHex(0x000000);
      m.emissiveIntensity = 0;
      m.needsUpdate = true;
    }
  });
}

function disposeGroup(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
}

function loadModel(
  modelPath: string,
  onSuccess: (root: THREE.Group, anims: THREE.AnimationClip[]) => void,
  onError: (err: Error) => void,
) {
  if (isGLB(modelPath)) {
    new GLTFLoader().load(
      modelPath,
      (gltf) => onSuccess(gltf.scene, gltf.animations),
      undefined,
      (e) => onError(e instanceof Error ? e : new Error(String(e))),
    );
  } else {
    new FBXLoader().load(
      modelPath,
      (fbx) => onSuccess(fbx, fbx.animations),
      undefined,
      (e) => onError(e instanceof Error ? e : new Error(String(e))),
    );
  }
}

function animate() {
  animFrameId = requestAnimationFrame(animate);
  if (mixer && clock) mixer.update(clock.getDelta());
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

export function cleanup() {
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
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => {
          if (m && typeof m.dispose === 'function') m.dispose();
        });
      }
    });
    scene = null;
  }
  camera = null;
  clock = null;
}

export interface InitCallbacks {
  onLoaded?: () => void;
  onLoadError?: (err: string) => void;
}

/** Extract animation clip names from a model file (lightweight, disposes after). */
export async function extractClipNames(
  modelPath: string,
): Promise<{ name: string; duration: number }[]> {
  return new Promise((resolve, reject) => {
    loadModel(
      modelPath,
      (root, anims) => {
        const clips = anims.map((c) => ({
          name: c.name,
          duration: Math.round(c.duration * 100) / 100,
        }));
        disposeGroup(root);
        resolve(clips);
      },
      reject,
    );
  });
}

/** Initialize 3D preview in a container element. */
export function initPreview(
  container: HTMLElement,
  modelPath: string,
  scale: number,
  rotationY: number,
  callbacks?: InitCallbacks,
) {
  cleanup();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const width = container.clientWidth || 560;
  const height = container.clientHeight || 420;

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

  const hemiLight = new THREE.HemisphereLight(0xc8ddf0, 0x584430, 0.8);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(5, 8, 7);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.6);
  fillLight.position.set(-6, 3, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfff0dd, 0.5);
  rimLight.position.set(0, 4, -8);
  scene.add(rimLight);

  const bounceLight = new THREE.DirectionalLight(0x8090a0, 0.25);
  bounceLight.position.set(0, -3, 2);
  scene.add(bounceLight);

  const grid = new THREE.GridHelper(20, 20, 0x333355, 0x222244);
  scene.add(grid);

  clock = new THREE.Clock();
  animate();

  resizeObs = new ResizeObserver(() => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObs.observe(container);

  loadModel(
    modelPath,
    (root, anims) => {
      if (!scene || !camera || !controls) return;

      root.rotation.y = (rotationY * Math.PI) / 180;

      if (!isGLB(modelPath)) fixMaterials(root);

      scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (maxDim > 0) {
        const normScale = 2.5 / maxDim;
        root.scale.multiplyScalar(normScale);
        box.setFromObject(root);
        box.getCenter(center);
      }

      root.position.sub(center);
      const groundBox = new THREE.Box3().setFromObject(root);
      root.position.y -= groundBox.min.y;

      controls.target.set(0, 0.8, 0);
      camera.position.set(0, 1.5, 4);
      controls.update();

      if (anims.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(anims[0]).play();
      }

      callbacks?.onLoaded?.();
    },
    (err) => {
      callbacks?.onLoadError?.(err.message);
    },
  );
}
