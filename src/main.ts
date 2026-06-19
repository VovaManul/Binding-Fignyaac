/**
 * main.ts — точка входа и «склейка». Поток:
 *   стартовое меню → выбор уровня (правил) → создаём Game с этими правилами →
 *   запускаем цикл. Esc во время игры — назад в меню.
 *
 * Это единственное место, где встречаются логика, рендер и ввод — поэтому
 * именно здесь проще всего подменить рендер/ввод или добавить экраны.
 */
import { Game } from './core/Game';
import { PRESETS, type LevelRules } from './core/rules';
import { KeyboardController } from './input/KeyboardController';
import { ThreeRenderer } from './render/ThreeRenderer';
import { HudOverlay } from './render/HudOverlay';
import { GameLoop } from './engine/GameLoop';
import { StartMenu } from './ui/StartMenu';
import { ASSET_PACKS, type AssetPack } from './render/assetPacks';

function boot(): void {
  const world = document.getElementById('game') as HTMLCanvasElement | null;
  const hudCanvas = document.getElementById('hud') as HTMLCanvasElement | null;
  const menuEl = document.getElementById('menu');
  if (!world || !hudCanvas || !menuEl) {
    document.body.innerHTML =
      '<p style="color:#c33;font-family:monospace;padding:2rem">Ошибка: не найдены #game / #hud / #menu в разметке.</p>';
    return;
  }

  // Ввод живёт всё приложение; рендер создаётся на забег, потому что зависит от пака ассетов.
  const controller = new KeyboardController();
  controller.attach();

  let loop: GameLoop | null = null;
  let world3d: ThreeRenderer | null = null;
  let hud: HudOverlay | null = null;

  const startGame = (rules: LevelRules, assetPack: AssetPack): void => {
    loop?.stop();
    world3d?.dispose();
    hud?.dispose();
    controller.reset(); // чистый ввод: не тащим зажатые клавиши/смену оружия из прошлого забега
    const game = new Game(rules);
    const currentWorld = new ThreeRenderer(world, assetPack.path);
    const currentHud = new HudOverlay(hudCanvas, assetPack.path);
    world3d = currentWorld;
    hud = currentHud;
    loop = new GameLoop(game, controller, (alpha) => {
      currentWorld.render(game, alpha);
      currentHud.render(game);
    });
    menu.hide();
    loop.start();
    // Debug-хэндл: в консоли браузера доступен `game`.
    (window as Window & { game?: Game }).game = game;
  };

  const toMenu = (): void => {
    loop?.stop();
    loop = null;
    world3d?.dispose();
    hud?.dispose();
    world3d = null;
    hud = null;
    menu.show(); // фон меню перекрывает «замёрзший» последний кадр
  };

  const menu = new StartMenu(menuEl, PRESETS, ASSET_PACKS, startGame);
  menu.show();

  // Esc во время игры — вернуться к выбору уровня (по физической клавише).
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && loop) {
      const g = (window as Window & { game?: Game }).game;
      if (g?.inventoryOpen) {
        g.closeInventory();
        e.preventDefault();
        return;
      }
      e.preventDefault();
      toMenu();
    }
    // Цифры 1-9 для экипировки оружия в инвентаре.
    const digit = parseInt(e.code.replace('Digit', ''), 10);
    if (digit >= 1 && digit <= 9 && loop) {
      const g = (window as Window & { game?: Game }).game;
      if (g?.inventoryOpen) {
        g.equipSlot(digit - 1);
        e.preventDefault();
      }
    }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
