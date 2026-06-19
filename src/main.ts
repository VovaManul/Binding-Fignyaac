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

function boot(): void {
  const world = document.getElementById('game') as HTMLCanvasElement | null;
  const hudCanvas = document.getElementById('hud') as HTMLCanvasElement | null;
  const menuEl = document.getElementById('menu');
  if (!world || !hudCanvas || !menuEl) {
    document.body.innerHTML =
      '<p style="color:#c33;font-family:monospace;padding:2rem">Ошибка: не найдены #game / #hud / #menu в разметке.</p>';
    return;
  }

  // Рендер и ввод создаём один раз — они переиспользуются между забегами.
  const controller = new KeyboardController();
  const world3d = new ThreeRenderer(world);
  const hud = new HudOverlay(hudCanvas);
  controller.attach();

  let loop: GameLoop | null = null;

  const startGame = (rules: LevelRules): void => {
    loop?.stop();
    controller.reset(); // чистый ввод: не тащим зажатые клавиши/смену оружия из прошлого забега
    const game = new Game(rules);
    loop = new GameLoop(game, controller, (alpha) => {
      world3d.render(game, alpha);
      hud.render(game);
    });
    menu.hide();
    loop.start();
    // Debug-хэндл: в консоли браузера доступен `game`.
    (window as Window & { game?: Game }).game = game;
  };

  const toMenu = (): void => {
    loop?.stop();
    loop = null;
    menu.show(); // фон меню перекрывает «замёрзший» последний кадр
  };

  const menu = new StartMenu(menuEl, PRESETS, startGame);
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
