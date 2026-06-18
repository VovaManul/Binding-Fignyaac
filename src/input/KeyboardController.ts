import type { InputState } from './InputState';
import type { Dir } from '../core/types';

/**
 * Раскладка: WASD — движение, стрелки — прицельная стрельба, пробел —
 * атака по ходу движения, Tab/Q — смена оружия, R — рестарт.
 *
 * Контроллер держит набор зажатых клавиш и «защёлкивает» однократные
 * действия (смена оружия/рестарт). Раз в кадр вызывается poll(), который
 * собирает InputState и сбрасывает однократные флаги.
 */
export class KeyboardController {
  private held = new Set<string>();
  private toggleWeaponEdge = false;
  private restartEdge = false;
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key;
    // Однократные действия ловим по факту нажатия (не по удержанию).
    if (!this.held.has(k)) {
      if (k === 'Tab' || k === 'q' || k === 'Q') this.toggleWeaponEdge = true;
      if (k === 'r' || k === 'R') this.restartEdge = true;
    }
    this.held.add(k);
    if (PREVENT.has(k)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.key);
  };

  private onBlur = (): void => {
    // Сбрасываем всё, чтобы клавиши не «залипали» при потере фокуса.
    this.held.clear();
  };

  /**
   * Сбросить весь ввод: зажатые клавиши и однократные действия. Звать на
   * границе забега (старт новой игры) — иначе клавиша, зажатая в прошлом
   * забеге, или залатченная смена оружия «перетекут» в новый.
   */
  reset(): void {
    this.held.clear();
    this.toggleWeaponEdge = false;
    this.restartEdge = false;
  }

  /** Подписаться на события окна. Вызывается один раз при старте. */
  attach(target: Window = window): void {
    if (this.attached) return;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
    this.attached = true;
  }

  /** Собрать снимок ввода и сбросить однократные флаги. */
  poll(): InputState {
    const down = (k: string) => this.held.has(k);

    let moveX = 0;
    let moveY = 0;
    if (down('w') || down('W')) moveY -= 1;
    if (down('s') || down('S')) moveY += 1;
    if (down('a') || down('A')) moveX -= 1;
    if (down('d') || down('D')) moveX += 1;

    let aimDir: Dir | null = null;
    if (down('ArrowUp')) aimDir = 'up';
    else if (down('ArrowDown')) aimDir = 'down';
    else if (down('ArrowLeft')) aimDir = 'left';
    else if (down('ArrowRight')) aimDir = 'right';

    const snapshot: InputState = {
      moveX,
      moveY,
      aimDir,
      attackHeld: down(' ') || down('Spacebar'),
      toggleWeapon: this.toggleWeaponEdge,
      restart: this.restartEdge,
    };

    this.toggleWeaponEdge = false;
    this.restartEdge = false;
    return snapshot;
  }
}

/** Клавиши, у которых гасим стандартное поведение браузера (скролл и т.п.). */
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar', 'Tab',
]);
