import { setupInput, KEYS } from './input';
import { Game } from './game/Game';

// Global key bindings (mode toggle, restart) handled here
setupInput();

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const game = (window as any).__game as Game | undefined;
  if (!game) return;

  // Toggle combat mode
  if ((e.key === 'Tab' || e.key === 'q' || e.key === 'Q') && !game.gameOver && !game.won) {
    e.preventDefault();
    game.toggleMode();
  }

  // Restart
  if (e.key === 'r' || e.key === 'R') {
    if (game.gameOver || game.won) game.restart();
  }
});

// Bootstrap
window.addEventListener('load', () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) {
    document.body.innerHTML = '<p style="color:red">Error: canvas element not found</p>';
    return;
  }
  const game = new Game(canvas);
  (window as any).__game = game;
});
