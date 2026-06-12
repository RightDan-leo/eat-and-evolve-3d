import * as THREE from 'three';
import type { BaseScene } from './BaseScene';

type SceneConstructor = new (manager: SceneManager) => BaseScene;

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly clock: THREE.Clock;

  private scenes = new Map<string, BaseScene>();
  private sceneClasses = new Map<string, SceneConstructor>();
  private activeScene: BaseScene | null = null;
  private _width: number;
  private _height: number;
  private animFrameId = 0;

  constructor(container: HTMLElement) {
    this._width = container.clientWidth;
    this._height = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this._width, this._height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => this.onResize(container));
  }

  get width() { return this._width; }
  get height() { return this._height; }
  get aspect() { return this._width / this._height; }

  register(id: string, sceneClass: SceneConstructor): void {
    this.sceneClasses.set(id, sceneClass);
  }

  async start(id: string): Promise<void> {
    if (this.activeScene) {
      this.activeScene.onExit();
    }

    let scene = this.scenes.get(id);
    if (!scene) {
      const SceneClass = this.sceneClasses.get(id);
      if (!SceneClass) throw new Error(`Scene "${id}" not registered`);
      scene = new SceneClass(this);
      this.scenes.set(id, scene);
      await scene.onInit();
    }

    this.activeScene = scene;
    scene.onEnter();

    if (!this.animFrameId) {
      this.clock.start();
      this.loop();
    }
  }

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const delta = this.clock.getDelta();

    if (this.activeScene) {
      this.activeScene.onUpdate(delta);
      this.activeScene.onRender(this.renderer);
    }
  };

  private onResize(container: HTMLElement): void {
    this._width = container.clientWidth;
    this._height = container.clientHeight;
    this.renderer.setSize(this._width, this._height);
    this.activeScene?.onResize(this._width, this._height);
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.scenes.forEach((s) => s.onDestroy());
    this.scenes.clear();
    this.renderer.dispose();
  }
}
