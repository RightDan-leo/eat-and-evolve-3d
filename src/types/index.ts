export * from './core';

export type GameState = 'loading' | 'menu' | 'playing' | 'paused' | 'gameover';
export type Direction = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down';

export interface Vector3 { x: number; y: number; z: number; }

export interface IEntity {
  id: string;
  position: Vector3;
  update(delta: number): void;
  destroy(): void;
}

export interface GameData {
  score: number;
  level: number;
  lives: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  action: boolean;
}

export interface SceneConfig {
  id: string;
  label: string;
}
