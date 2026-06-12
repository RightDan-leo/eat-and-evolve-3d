import { SceneManager } from './core/SceneManager';
import { GAME_CONSTANTS } from './config/game.config';
import { LoadingScene } from './scenes/LoadingScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';

const container = document.getElementById('game-container')!;
const manager = new SceneManager(container);

manager.register(GAME_CONSTANTS.SCENES.LOADING.id, LoadingScene);
manager.register(GAME_CONSTANTS.SCENES.MAIN_MENU.id, MainMenuScene);
manager.register(GAME_CONSTANTS.SCENES.GAME.id, GameScene);

manager.start(GAME_CONSTANTS.SCENES.LOADING.id);

if (import.meta.env.DEV) {
  (window as unknown as { manager: SceneManager }).manager = manager;
}

export default manager;
