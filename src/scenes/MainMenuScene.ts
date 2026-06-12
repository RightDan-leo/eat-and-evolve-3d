import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene';
import type { SceneManager } from '../core/SceneManager';
import { GAME_CONSTANTS } from '../config/game.config';

export class MainMenuScene extends BaseScene {
  private cube!: THREE.Mesh;
  private uiContainer!: HTMLDivElement;

  constructor(manager: SceneManager) {
    super(manager);
  }

  async onInit(): Promise<void> {
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.3,
      roughness: 0.6,
    });
    this.cube = new THREE.Mesh(geometry, material);
    this.cube.position.y = 0.75;
    this.scene.add(this.cube);

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    this.scene.add(gridHelper);
  }

  onEnter(): void {
    this.createUI();
  }

  onExit(): void {
    this.removeUI();
  }

  onUpdate(delta: number): void {
    this.cube.rotation.y += delta * 0.5;
    this.cube.rotation.x += delta * 0.3;
  }

  private createUI(): void {
    const overlay = document.getElementById('ui-overlay')!;
    this.uiContainer = document.createElement('div');
    this.uiContainer.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    const title = document.createElement('h1');
    title.textContent = 'Web Game 3D';
    title.style.cssText = `
      color: #ffffff; font-size: 56px; margin-bottom: 40px;
      text-shadow: 0 0 20px rgba(68, 136, 255, 0.5);
    `;

    const btn = document.createElement('button');
    btn.textContent = '开始游戏';
    btn.style.cssText = `
      font-size: 24px; padding: 14px 40px; cursor: pointer;
      background: #4488ff; color: white; border: none; border-radius: 8px;
      transition: all 0.2s; font-family: inherit;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = '#5599ff'; btn.style.transform = 'scale(1.05)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#4488ff'; btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', () => this.manager.start(GAME_CONSTANTS.SCENES.GAME.id));

    const version = document.createElement('div');
    version.textContent = 'v0.1.0';
    version.style.cssText = `
      position: absolute; bottom: 10px; right: 10px;
      color: #888888; font-size: 14px;
    `;

    this.uiContainer.appendChild(title);
    this.uiContainer.appendChild(btn);
    this.uiContainer.appendChild(version);
    overlay.appendChild(this.uiContainer);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        window.removeEventListener('keydown', onKey);
        this.manager.start(GAME_CONSTANTS.SCENES.GAME.id);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  private removeUI(): void {
    this.uiContainer?.remove();
  }
}
