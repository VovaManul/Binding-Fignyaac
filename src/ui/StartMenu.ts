import type { LevelRules } from '../core/rules';

/**
 * Стартовое меню на DOM (поверх холстов). Показывает список пресетов-уровней;
 * по клику зовёт onStart с выбранными правилами. DOM-меню выбрано осознанно:
 * его проще стилизовать и расширять (новые поля, превью), чем рисовать UI в WebGL.
 *
 * Чтобы добавить пункт меню — добавь пресет в core/rules.ts (PRESETS): он
 * появится здесь автоматически.
 */
export class StartMenu {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement, presets: LevelRules[], onStart: (rules: LevelRules) => void) {
    this.root = root;
    const list = root.querySelector('#menu-presets');
    if (!list) throw new Error('StartMenu: не найден #menu-presets внутри #menu');

    for (const rules of presets) {
      const btn = document.createElement('button');
      btn.className = 'menu-preset';
      btn.type = 'button';

      const name = document.createElement('span');
      name.className = 'menu-preset-name';
      name.textContent = rules.name;

      const desc = document.createElement('span');
      desc.className = 'menu-preset-desc';
      desc.textContent = rules.description;

      btn.append(name, desc);
      btn.addEventListener('click', () => onStart(rules));
      list.appendChild(btn);
    }
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
