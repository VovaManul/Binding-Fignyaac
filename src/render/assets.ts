import * as THREE from 'three';

/**
 * assets.ts — СТАНДАРТНЫЕ АССЕТЫ, нарисованные процедурно на canvas и
 * превращённые в текстуры three.js. Никаких внешних файлов: спрайты «зашиты»
 * в код, поэтому проект самодостаточен и легко версионируется.
 *
 * Как заменить на свои картинки: вместо рисования на canvas загрузи PNG через
 * `new THREE.TextureLoader().load('путь.png')` и верни его из соответствующего
 * геттера. Остальной рендер не изменится — он просто берёт текстуру по имени.
 *
 * Текстуры кэшируются (строятся один раз) и освобождаются в dispose().
 */

export type SpriteKey =
  | 'player-ranged' | 'player-melee'
  | 'enemy-normal' | 'enemy-fast' | 'enemy-boss';

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

  dispose(): void {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}
