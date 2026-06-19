import * as THREE from 'three';
import type { WeaponId } from '../core/weapons';

/**
 * assets.ts — поставщик текстур. Каждая текстура грузится из
 * `src/assets/<ключ>.png` через THREE.TextureLoader; если PNG нет — рисуется
 * процедурный фолбэк на canvas (функции drawX ниже), чтобы игра работала без
 * ассетов. Текстуры кэшируются и освобождаются в dispose().
 *
 * Как заменить/добавить графику: положи PNG с именем `<ключ>.png` в `src/assets/`
 * (dev-сервер отдаёт их из src/assets, прод-сборка копирует в dist/assets). Код
 * трогать не нужно. Функции drawX — это лишь плейсхолдер-фолбэк; правь их, только
 * если хочешь другой запасной рисунок. Полный список ключей — в docs/ASSET_BRIEF.md.
 */

export type SpriteKey =
  | 'player-ranged' | 'player-melee'
  | 'enemy-normal' | 'enemy-fast' | 'enemy-boss'
  | 'enemy-charger' | 'enemy-tank' | 'enemy-shooter'
  | 'chest' | 'pickup' | 'fireball' | 'beam';

function canvas(w: number, h: number): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, ctx: cv.getContext('2d')! };
}

/** Скруглённый прямоугольник (хелпер рисования). */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Большеголовый персонаж в духе Isaac (вертикальный спрайт 48×64). */
function drawCharacter(
  opts: { head: string; body: string; outline: string; eye?: string; horns?: boolean; small?: boolean },
): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 64);
  const cx = 24;
  const scale = opts.small ? 0.85 : 1;
  const headR = 15 * scale;
  const headY = 24;

  // Тело (туника) снизу.
  ctx.fillStyle = opts.body;
  roundRect(ctx, cx - 13 * scale, headY + 6, 26 * scale, 26 * scale, 6);
  ctx.fill();
  ctx.strokeStyle = opts.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ножки.
  ctx.fillStyle = opts.outline;
  ctx.fillRect(cx - 9 * scale, headY + 28, 6, 8);
  ctx.fillRect(cx + 3 * scale, headY + 28, 6, 8);

  // Рога (для босса) — за головой.
  if (opts.horns) {
    ctx.fillStyle = opts.outline;
    ctx.beginPath();
    ctx.moveTo(cx - 13, headY - 9); ctx.lineTo(cx - 18, headY - 22); ctx.lineTo(cx - 6, headY - 11); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 13, headY - 9); ctx.lineTo(cx + 18, headY - 22); ctx.lineTo(cx + 6, headY - 11); ctx.fill();
  }

  // Голова.
  ctx.fillStyle = opts.head;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = opts.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Глаза.
  ctx.fillStyle = opts.eye ?? '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx - 6, headY - 1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6, headY - 1, 3, 0, Math.PI * 2); ctx.fill();

  return cv;
}

/** Плиточная текстура пола (тёмный камень, бесшовная). */
function drawFloor(): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 64);
  ctx.fillStyle = '#6b6657';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#5f5a4c';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  // лёгкие «трещинки»/крапинки
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (const [x, y] of [[8, 12], [40, 6], [54, 40], [18, 48], [30, 28]]) ctx.fillRect(x, y, 3, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 63, 63);
  return cv;
}

/** Кирпичная текстура стены. */
function drawWall(): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 64);
  ctx.fillStyle = '#474757';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#55556a';
  const bh = 16;
  for (let row = 0; row * bh < 64; row++) {
    const off = row % 2 === 0 ? 0 : -16;
    for (let x = off; x < 64; x += 32) {
      ctx.fillRect(x + 1, row * bh + 1, 30, bh - 2);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(0.5, 0.5, 63, 63);
  return cv;
}

/** Снаряд-«слеза» (голубая капля со свечением, прозрачный фон). */
function drawTear(): HTMLCanvasElement {
  const { cv, ctx } = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, '#dff0ff');
  g.addColorStop(0.4, '#6699cc');
  g.addColorStop(1, 'rgba(40,80,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
  return cv;
}

/** Радиальная мягкая «вспышка» (для дула, попаданий, частиц). */
function drawGlow(inner: string, outer: string): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, inner);
  g.addColorStop(0.5, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return cv;
}

/** Дверь: закрытая (засов) или открытый тёмный проём. Прозрачный фон. */
function drawDoor(open: boolean): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 64);
  // Рама-арка.
  ctx.fillStyle = '#1c1a14';
  ctx.fillRect(4, 4, 56, 60);
  ctx.fillStyle = '#070707'; // тёмный проём
  ctx.fillRect(12, 12, 40, 52);

  if (!open) {
    // Створки + засов (закрыто).
    ctx.fillStyle = '#3a2e14';
    ctx.fillRect(12, 12, 40, 52);
    ctx.strokeStyle = '#241a08';
    ctx.lineWidth = 2;
    for (let x = 18; x < 52; x += 10) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 64); ctx.stroke(); }
    ctx.fillStyle = '#9a8a4a'; // засов
    ctx.fillRect(10, 32, 44, 7);
    ctx.fillStyle = '#cdbf78';
    ctx.fillRect(28, 30, 8, 11);
  }
  return cv;
}

/** Сундук: тёмный ящик с золотым ободком. */
function drawChest(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#5a3a1a';
  roundRect(ctx, 4, 4, 40, 40, 4);
  ctx.fill();
  ctx.strokeStyle = '#8a6a2a';
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, 40, 40, 4);
  ctx.stroke();
  ctx.fillStyle = '#c9a84a';
  ctx.fillRect(12, 18, 24, 10);
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(22, 14, 4, 18);
  ctx.fillStyle = '#3a220a';
  ctx.beginPath(); ctx.arc(24, 24, 4, 0, Math.PI * 2); ctx.fill();
  return cv;
}

/** Пикап оружия: парящий ромб со свечением. */
function drawPickup(): HTMLCanvasElement {
  const { cv, ctx } = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, '#ffdd88');
  g.addColorStop(0.4, '#cc8822');
  g.addColorStop(1, 'rgba(200,100,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#ffcc44';
  ctx.beginPath();
  ctx.moveTo(16, 4); ctx.lineTo(28, 16); ctx.lineTo(16, 28); ctx.lineTo(4, 16); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#aa6600';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return cv;
}

/** Зарядчик: красный, агрессивный вид, щель глаза. */
function drawCharger(): HTMLCanvasElement {
  return drawCharacter({ head: '#cc4422', body: '#882211', outline: '#330a04', eye: '#ffaa00', small: false });
}

/** Танк: большой, тёмный, тяжёлый. */
function drawTank(): HTMLCanvasElement {
  return drawCharacter({ head: '#554433', body: '#443322', outline: '#1a110a', eye: '#ff6622', horns: true });
}

/** Стрелок: синеватый, с «шапкой». */
function drawShooter(): HTMLCanvasElement {
  return drawCharacter({ head: '#4488aa', body: '#336688', outline: '#122436', eye: '#aaddff', small: false });
}

/** Лазерный луч: яркая бело-голубая полоса. */
function drawBeam(): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.2, '#88ddff');
  g.addColorStop(0.5, '#4488ff');
  g.addColorStop(1, 'rgba(0,50,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(20, 28, 24, 8);
  return cv;
}

/** Огненный шар: красно-оранжевый с бликом. */
function drawFireball(): HTMLCanvasElement {
  const { cv, ctx } = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
  g.addColorStop(0, '#ffee88');
  g.addColorStop(0.3, '#ff6622');
  g.addColorStop(0.7, '#cc2200');
  g.addColorStop(1, 'rgba(100,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2); ctx.fill();
  return cv;
}

/** Иконка оружия: слеза (голубая капля). */
function drawWeaponTears(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 20);
  g.addColorStop(0, '#dff0ff'); g.addColorStop(0.5, '#6699cc'); g.addColorStop(1, 'rgba(40,80,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(24, 24, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#aaccee'; ctx.beginPath(); ctx.arc(20, 18, 6, 0, Math.PI * 2); ctx.fill();
  return cv;
}

/** Иконка оружия: кулак. */
function drawWeaponMelee(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#8a6a3a';
  roundRect(ctx, 10, 14, 28, 24, 6); ctx.fill();
  ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 2; roundRect(ctx, 10, 14, 28, 24, 6); ctx.stroke();
  ctx.fillStyle = '#6a4a1a'; ctx.fillRect(14, 20, 8, 8); ctx.fillRect(26, 20, 8, 8);
  ctx.fillRect(18, 30, 12, 6);
  ctx.fillStyle = '#5a3a0a'; ctx.fillRect(20, 6, 8, 12);
  return cv;
}

/** Иконка оружия: дробовик — три точки. */
function drawWeaponShotgun(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  for (const [x, y] of [[24, 16], [16, 30], [32, 30]]) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, 10);
    g.addColorStop(0, '#ffcc44'); g.addColorStop(0.5, '#cc6622'); g.addColorStop(1, 'rgba(150,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  }
  return cv;
}

/** Иконка оружия: топор. */
function drawWeaponAxe(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#777';
  ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(38, 12); ctx.lineTo(40, 22); ctx.lineTo(30, 22); ctx.lineTo(30, 38); ctx.lineTo(16, 38); ctx.lineTo(16, 22); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#5a3a0a'; ctx.fillRect(22, 34, 4, 12);
  return cv;
}

/** Иконка оружия: посох. */
function drawWeaponStaff(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(22, 6, 4, 36);
  ctx.fillStyle = '#ff4422';
  ctx.beginPath(); ctx.arc(24, 10, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffcc44';
  ctx.beginPath(); ctx.arc(24, 10, 5, 0, Math.PI * 2); ctx.fill();
  return cv;
}

/** Иконка оружия: хлыст. */
function drawWeaponWhip(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, 38); ctx.quadraticCurveTo(18, 12, 38, 14); ctx.stroke();
  ctx.strokeStyle = '#5a3a0a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 38); ctx.quadraticCurveTo(18, 12, 38, 14); ctx.stroke();
  ctx.fillStyle = '#4a2a0a'; ctx.fillRect(6, 34, 8, 8);
  return cv;
}

/** Иконка оружия: бомба. */
function drawWeaponBomb(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(24, 24, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(24, 24, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc4422'; ctx.fillRect(22, 4, 4, 8);
  ctx.fillStyle = '#ff8844'; ctx.beginPath(); ctx.arc(24, 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(24, 24, 16, 0, Math.PI * 2); ctx.stroke();
  return cv;
}

/** Иконка оружия: бумеранг. */
function drawWeaponBoomerang(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  ctx.fillStyle = '#8a6a3a';
  ctx.beginPath(); ctx.moveTo(8, 36); ctx.lineTo(22, 16); ctx.lineTo(40, 6); ctx.lineTo(38, 18); ctx.lineTo(22, 28); ctx.lineTo(18, 36); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#a08850'; ctx.fillRect(8, 30, 12, 8);
  return cv;
}

/** Иконка оружия: лазер. */
function drawWeaponLaser(): HTMLCanvasElement {
  const { cv, ctx } = canvas(48, 48);
  const g = ctx.createLinearGradient(8, 24, 40, 24);
  g.addColorStop(0, 'rgba(100,180,255,0.2)'); g.addColorStop(0.3, '#88ddff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, '#88ddff'); g.addColorStop(1, 'rgba(100,180,255,0.2)');
  ctx.fillStyle = g; ctx.fillRect(8, 18, 32, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(12, 22, 24, 4);
  return cv;
}

/** Мягкая тень-«пятно» под сущностью. */
function drawShadow(): HTMLCanvasElement {
  const { cv, ctx } = canvas(64, 32);
  const g = ctx.createRadialGradient(32, 16, 1, 32, 16, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(1, 0.5); ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  return cv;
}

/**
 * Кэширующий поставщик текстур. Строит лениво, отдаёт по имени, освобождает все.
 */
export class Assets {
  private cache = new Map<string, THREE.Texture>();
  private readonly loader = new THREE.TextureLoader();

  /**
   * Возвращает текстуру по ключу. Сначала пытается загрузить PNG из
   * `src/assets/<key>.png` (поставляется художником, см. docs/ASSET_BRIEF.md);
   * если файла нет — рисует процедурный фолбэк, чтобы игра не ломалась.
   * 404 в консоли для ещё не добавленных ассетов — это норма (сработал фолбэк).
   */
  private get(key: string, build: () => HTMLCanvasElement, pixelated = true): THREE.Texture {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const tex = this.loader.load(
      `assets/${key}.png`,
      undefined,
      undefined,
      () => { tex.image = build() as unknown as HTMLImageElement; tex.needsUpdate = true; }, // PNG нет → процедурный фолбэк
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    if (pixelated) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
    }
    this.cache.set(key, tex);
    return tex;
  }

  sprite(key: SpriteKey): THREE.Texture {
    return this.get(key, () => {
      switch (key) {
        case 'player-ranged': return drawCharacter({ head: '#e8d2b0', body: '#2a6a9a', outline: '#16324a', eye: '#123' });
        case 'player-melee': return drawCharacter({ head: '#e8d2b0', body: '#9a3a2a', outline: '#4a160e', eye: '#123' });
        case 'enemy-normal': return drawCharacter({ head: '#c08a5a', body: '#9a5a36', outline: '#3a2210', eye: '#2a1c0c' });
        case 'enemy-fast': return drawCharacter({ head: '#bb3030', body: '#992222', outline: '#4a0e0e', eye: '#ffdddd', small: true });
        case 'enemy-boss': return drawCharacter({ head: '#7a1414', body: '#5a0a0a', outline: '#250303', eye: '#ff4444', horns: true });
        case 'enemy-charger': return drawCharger();
        case 'enemy-tank': return drawTank();
        case 'enemy-shooter': return drawShooter();
        case 'chest': return drawChest();
        case 'pickup': return drawPickup();
        case 'fireball': return drawFireball();
        case 'beam': return drawBeam();
      }
    });
  }

  floor(): THREE.Texture { return this.get('floor', drawFloor); }
  wall(): THREE.Texture { return this.get('wall', drawWall); }
  tear(): THREE.Texture { return this.get('tear', drawTear, false); }
  shadow(): THREE.Texture { return this.get('shadow', drawShadow, false); }
  door(open: boolean): THREE.Texture { return this.get(open ? 'door-open' : 'door-closed', () => drawDoor(open)); }
  muzzle(): THREE.Texture { return this.get('muzzle', () => drawGlow('#fffbe0', 'rgba(255,200,60,0.7)'), false); }
  spark(): THREE.Texture { return this.get('spark', () => drawGlow('#ffffff', 'rgba(255,230,170,0.6)'), false); }
  puff(): THREE.Texture { return this.get('puff', () => drawGlow('rgba(220,220,230,0.9)', 'rgba(120,120,140,0.4)'), false); }
  chest(): THREE.Texture { return this.get('chest', drawChest, false); }
  pickup(): THREE.Texture { return this.get('pickup', drawPickup, false); }
  fireball(): THREE.Texture { return this.get('fireball', drawFireball, false); }

  weaponIcon(id: WeaponId): THREE.Texture {
    return this.get(`weapon-icon-${id}`, () => {
      switch (id) {
        case 'tears': return drawWeaponTears();
        case 'melee': return drawWeaponMelee();
        case 'shotgun': return drawWeaponShotgun();
        case 'axe': return drawWeaponAxe();
        case 'staff': return drawWeaponStaff();
        case 'whip': return drawWeaponWhip();
        case 'bomb': return drawWeaponBomb();
        case 'boomerang': return drawWeaponBoomerang();
        case 'laser': return drawWeaponLaser();
      }
    });
  }

  dispose(): void {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}
