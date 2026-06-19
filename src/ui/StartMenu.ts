import type { LevelRules } from '../core/rules';
import { DEFAULT_ASSET_PACK, type AssetPack } from '../render/assetPacks';

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
  private selectedPack: AssetPack;

  constructor(
    root: HTMLElement,
    presets: LevelRules[],
    assetPacks: readonly AssetPack[],
    onStart: (rules: LevelRules, assetPack: AssetPack) => void,
  ) {
    this.root = root;
    this.selectedPack = assetPacks[0] ?? DEFAULT_ASSET_PACK;
    const list = root.querySelector('#menu-presets');
    if (!list) throw new Error('StartMenu: не найден #menu-presets внутри #menu');

    const packs = document.createElement('div');
    packs.className = 'menu-packs';
    const packButtons: HTMLButtonElement[] = [];
    for (const pack of assetPacks) {
      const btn = document.createElement('button');
      btn.className = 'menu-pack';
      btn.type = 'button';
      btn.textContent = pack.name;
      btn.addEventListener('click', () => {
        this.selectedPack = pack;
        for (const b of packButtons) b.classList.toggle('is-selected', b === btn);
        this.applyPackPreview();
      });
      packButtons.push(btn);
      packs.appendChild(btn);
    }
    packButtons[0]?.classList.add('is-selected');
    list.before(packs);

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
      btn.addEventListener('click', () => onStart(rules, this.selectedPack));
      list.appendChild(btn);
    }

    this.applyPackPreview();
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private applyPackPreview(): void {
    const path = this.selectedPack.path;
    const logo = this.root.querySelector<HTMLImageElement>('#menu-logo');
    if (logo) logo.src = `${path}/logo.png`;
    this.root.style.background =
      `linear-gradient(rgba(10,10,15,0.7), rgba(10,10,15,0.82)), url(${path}/menu-bg.png) center / cover no-repeat, #0a0a0f`;
  }
}
