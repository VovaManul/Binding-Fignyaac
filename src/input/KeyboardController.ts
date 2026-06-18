import type { InputState } from './InputState';
import type { Dir } from '../core/types';

/**
 * Раскладка: WASD — движение, стрелки — прицельная стрельба, пробел —
 * атака по ходу движения, Tab/Q — смена оружия, R — рестарт.
 *
 * ВАЖНО: используем `event.code` (ФИЗИЧЕСКАЯ клавиша), а не `event.key`.
 * `code` не зависит от раскладки, поэтому WASD/Q/R работают и в русской
 * раскладке (где те же клавиши дают «цфыв»/«й»/«к»). Стрелки/Tab/пробел в
 * `code` называются ArrowUp/Tab/Space.
 *
 * Контроллер держит набор зажатых клавиш и «защёлкивает» однократные действия
 * (смена оружия/рестарт). Раз в кадр вызывается poll(), который собирает
 * InputState и сбрасывает однократные флаги.
 */
export class KeyboardController {
  private held = new Set<string>();
  private toggleWeaponEdge = false;
  private restartEdge = false;
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const c = e.code;
    // Однократные действия ловим по факту нажатия (не по удержанию).
    if (!this.held.has(c)) {
      if (c === 'Tab' || c === 'KeyQ') this.toggleWeaponEdge = true;
      if (c === 'KeyR') this.restartEdge = true;
    }
    this.held.add(c);
    if (PREVENT.has(c)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
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
    const down = (code: string) => this.held.has(code);

    let moveX = 0;
    let moveY = 0;
    if (down('KeyW')) moveY -= 1;
    if (down('KeyS')) moveY += 1;
    if (down('KeyA')) moveX -= 1;
    if (down('KeyD')) moveX += 1;

    let aimDir: Dir | null = null;
    if (down('ArrowUp')) aimDir = 'up';
    else if (down('ArrowDown')) aimDir = 'down';
    else if (down('ArrowLeft')) aimDir = 'left';
    else if (down('ArrowRight')) aimDir = 'right';

    const snapshot: InputState = {
      moveX,
      moveY,
      aimDir,
      attackHeld: down('Space'),
      toggleWeapon: this.toggleWeaponEdge,
      restart: this.restartEdge,
    };

    this.toggleWeaponEdge = false;
    this.restartEdge = false;
    return snapshot;
  }
}

/** Физические клавиши (e.code), у которых гасим поведение браузера (скролл/таб). */
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
]);
