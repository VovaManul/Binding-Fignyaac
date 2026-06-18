import type { Dir } from '../core/types';

/**
 * Снимок намерений игрока за один опрос ввода — абстракция над «железом».
 * Игровая логика (core/Game.ts) читает ТОЛЬКО это, ничего не зная про
 * клавиатуру. Захочешь геймпад или сенсор — просто сделай ещё один
 * контроллер, отдающий такой же InputState.
 *
 * Поля делятся на два вида:
 *  • удерживаемые (move*, aimDir, attackHeld) — читаются каждый шаг симуляции;
 *  • однократные «edge» (toggleWeapon, restart) — срабатывают один раз на нажатие.
 */
export interface InputState {
  moveX: number;        // -1 влево, +1 вправо, 0 нет
  moveY: number;        // -1 вверх, +1 вниз, 0 нет
  aimDir: Dir | null;   // прицеливание стрелками (приоритетнее attackHeld)
  attackHeld: boolean;  // атака «по ходу движения» (пробел)
  toggleWeapon: boolean; // сменить оружие (однократно)
  restart: boolean;      // рестарт на экране конца игры (однократно)
}

/** Нейтральный снимок — ничего не нажато. */
export function emptyInput(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimDir: null,
    attackHeld: false,
    toggleWeapon: false,
    restart: false,
  };
}

/** Жмёт ли игрок в сторону dir (движением ИЛИ прицеливанием) — для переходов. */
export function pressingDir(input: InputState, dir: Dir): boolean {
  switch (dir) {
    case 'up': return input.moveY < 0 || input.aimDir === 'up';
    case 'down': return input.moveY > 0 || input.aimDir === 'down';
    case 'left': return input.moveX < 0 || input.aimDir === 'left';
    case 'right': return input.moveX > 0 || input.aimDir === 'right';
  }
}
