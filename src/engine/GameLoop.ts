import { FIXED_DT } from '../config';
import type { Game } from '../core/Game';
import type { KeyboardController } from '../input/KeyboardController';

/**
 * Игровой цикл с ФИКСИРОВАННЫМ шагом.
 *
 * Почему так: старый код двигал всё прямо в requestAnimationFrame, поэтому
 * скорость зависела от частоты монитора — на 144 Гц игра летела в 2.4 раза
 * быстрее. Здесь логика всегда обновляется ровно 60 раз в секунду (накопитель
 * времени), а рендер рисует с интерполяцией. Игра идёт одинаково везде.
 */
export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private rafId = 0;
  private running = false;
  private readonly maxSteps = 5; // защита от «спирали смерти» при лагах

  constructor(
    private readonly game: Game,
    private readonly controller: KeyboardController,
    private readonly onRender: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);

    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > 0.25) frameTime = 0.25; // не «отыгрывать» долгие паузы (фон/таб)

    // Ввод опрашиваем раз в кадр; однократные действия — тоже раз в кадр.
    const input = this.controller.poll();
    this.game.consumeActions(input);

    this.accumulator += frameTime;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < this.maxSteps) {
      this.game.step(input);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === this.maxSteps) this.accumulator = 0; // отстали — ресинхронизируемся

    const alpha = this.accumulator / FIXED_DT;
    this.onRender(alpha);
  };
}
