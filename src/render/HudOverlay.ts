import { CW, CH, OY, RH, MODE_RANGED } from '../config';
import type { Game } from '../core/Game';
import type { Renderer } from './Renderer';

/**
 * HUD и миникарта на прозрачном 2D-канвасе ПОВЕРХ WebGL-холста.
 * Текст и тонкие линии в Canvas2D остаются чёткими и их просто стилизовать —
 * куда удобнее, чем тянуть шрифты в WebGL. Чисто отрисовка, без логики.
 */
export class HudOverlay implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly images = new Map<string, HTMLImageElement>();

  /** Лениво грузит PNG из assets/<name>.png; возвращает картинку, только когда она готова. */
  private img(name: string): HTMLImageElement | null {
    let im = this.images.get(name);
    if (!im) {
      im = new Image();
      im.src = `assets/${name}.png`;
      this.images.set(name, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  constructor(canvas: HTMLCanvasElement) {
    // Буфер увеличиваем под плотность пикселей (чёткий текст на HiDPI),
    // а рисуем по-прежнему в логических координатах CW×CH.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  render(game: Game): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CW, CH);

    this.drawHud(game);
    this.drawMinimap(game);

    if (game.gameOver) this.drawOverlay('#c33', 'ИГРА ОКОНЧЕНА');
    else if (game.won) this.drawOverlay('#3c3', 'ПОБЕДА');
  }

  dispose(): void {
    this.ctx.clearRect(0, 0, CW, CH);
  }

  private drawHud(game: Game): void {
    const ctx = this.ctx;
    const p = game.player;
    const room = game.curRoom;

    // Здоровье: сердечки (2 HP = сердце), с фолбэком на полосу.
    const healthBottom = this.drawHealth(p.hp, p.maxHp);

    // Название текущего уровня (правил).
    ctx.textAlign = 'left'; ctx.fillStyle = '#667'; ctx.font = '11px monospace';
    ctx.fillText(`Уровень: ${game.rules.name}`, 20, healthBottom + 14);

    // Индикатор режима боя.
    const my = CH - 46;
    const ranged = p.mode === MODE_RANGED;
    const mText = ranged ? 'ДАЛЬНИЙ' : 'БЛИЖНИЙ';
    const mCol = ranged ? '#4488cc' : '#cc6644';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(CW / 2 - 95, my - 18, 190, 34);
    ctx.strokeStyle = mCol; ctx.lineWidth = 2; ctx.strokeRect(CW / 2 - 95, my - 18, 190, 34);
    ctx.fillStyle = mCol; ctx.font = 'bold 17px monospace'; ctx.fillText(`[ ${mText} ]`, CW / 2, my + 8);
    ctx.fillStyle = '#555'; ctx.font = '11px monospace'; ctx.fillText('[Tab] сменить оружие', CW / 2, my - 26);
    // Иконка оружия слева в рамке (если ассет есть).
    const icon = this.img(ranged ? 'icon-ranged' : 'icon-melee');
    if (icon) ctx.drawImage(icon, CW / 2 - 90, my - 14, 26, 26);

    // Счётчик врагов / подсказка зачистки.
    ctx.textAlign = 'left';
    const alive = room.enemies.filter((e) => e.alive).length;
    if (alive > 0) {
      ctx.fillStyle = '#aa4444'; ctx.font = '13px monospace';
      ctx.fillText(`▶ ${alive}`, 20, CH - 18);
    } else if (!room.cleared && room.type !== 'spawn') {
      ctx.fillStyle = '#886633'; ctx.font = '13px monospace';
      ctx.fillText('Зачисти комнату', 20, CH - 18);
    }

    // Подпись типа комнаты.
    if (room.visited) {
      const label = { spawn: 'СТАРТ', normal: '', treasure: 'СОКРОВИЩЕ', boss: 'БОСС' }[room.type];
      if (label) {
        ctx.textAlign = 'right'; ctx.fillStyle = '#555'; ctx.font = '11px monospace';
        ctx.fillText(label, CW - 20, OY + RH + 30);
      }
    }
  }

  /** Рисует здоровье сердечками (2 HP = сердце); фолбэк — полоса. Возвращает нижний Y. */
  private drawHealth(hp: number, maxHp: number): number {
    const ctx = this.ctx;
    const x0 = 20, y0 = 16;
    const full = this.img('heart-full');
    const half = this.img('heart-half');
    const empty = this.img('heart-empty');
    if (full && half && empty) {
      const sz = 26, gap = 2;
      const slots = Math.ceil(maxHp / 2);
      for (let i = 0; i < slots; i++) {
        const rem = hp - i * 2;
        const im = rem >= 2 ? full : rem === 1 ? half : empty;
        ctx.drawImage(im, x0 + i * (sz + gap), y0, sz, sz);
      }
      return y0 + sz;
    }
    // Фолбэк — полоса HP.
    const by = 20, bw = 140, bh = 14;
    ctx.fillStyle = '#111'; ctx.fillRect(x0, by, bw, bh);
    ctx.fillStyle = '#2a0a0a'; ctx.fillRect(x0 + 2, by + 2, bw - 4, bh - 4);
    const ratio = Math.max(0, hp / maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#993333' : ratio > 0.25 ? '#994422' : '#663322';
    ctx.fillRect(x0 + 2, by + 2, (bw - 4) * ratio, bh - 4);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(x0, by, bw, bh);
    ctx.fillStyle = '#bbb'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`HP ${hp}/${maxHp}`, x0 + bw / 2, by + bh - 3);
    return by + bh;
  }

  private drawMinimap(game: Game): void {
    const ctx = this.ctx;
    const ox = CW - 180, oy = 12, cell = 14, gap = 2, cs = cell + gap;

    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(ox - 8, oy - 8, cs * 7 + 16, cs * 7 + 16);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(ox - 8, oy - 8, cs * 7 + 16, cs * 7 + 16);

    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        const room = game.roomMap.get(game.cc + c, game.cr + r);
        if (!room) continue;
        const x = ox + (c + 3) * cs, y = oy + (r + 3) * cs;

        let color = '#141414';
        if (room.visited) {
          color = { spawn: '#2a5a2a', boss: '#5a1a1a', treasure: '#5a5a1a', normal: '#555' }[room.type];
        }
        ctx.fillStyle = color; ctx.fillRect(x, y, cell, cell);

        if (room.visited) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          if (room.doors.up) ctx.fillRect(x + cs / 2 - 2, y - 2, 4, 3);
          if (room.doors.down) ctx.fillRect(x + cs / 2 - 2, y + cell - 1, 4, 3);
          if (room.doors.left) ctx.fillRect(x - 2, y + cs / 2 - 2, 3, 4);
          if (room.doors.right) ctx.fillRect(x + cell - 1, y + cs / 2 - 2, 3, 4);
        }
        if (c === 0 && r === 0) {
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.strokeRect(x - 1.5, y - 1.5, cell + 3, cell + 3);
        }
      }
    }
  }

  private drawOverlay(color: string, text: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = color; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center';
    ctx.fillText(text, CW / 2, CH / 2 - 20);
    ctx.fillStyle = '#888'; ctx.font = '18px monospace';
    ctx.fillText('[R] заново', CW / 2, CH / 2 + 40);
    ctx.fillStyle = '#666'; ctx.font = '14px monospace';
    ctx.fillText('[Esc] в меню', CW / 2, CH / 2 + 68);
  }
}
