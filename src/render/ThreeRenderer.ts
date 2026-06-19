import * as THREE from 'three';
import {
  CW, CH, OX, OY, TILE, COLS, ROWS, RW, RH,
  DIR, MODE_RANGED, PROJECTILE, MELEE,
} from '../config';
import { lerp } from '../core/util';
import type { Game } from '../core/Game';
import type { Room } from '../core/world/Room';
import type { Enemy } from '../core/entities/Enemy';
import type { Projectile } from '../core/entities/Projectile';
import type { Renderer } from './Renderer';
import { DEFAULT_THEME, type Theme } from './theme';
import { Assets, type SpriteKey } from './assets';

/**
 * Псевдо-3D рендер «как в Isaac»: наклонная перспективная камера, пол лежит
 * плоско, а персонажи/враги — ВЕРТИКАЛЬНЫЕ спрайты-биллборды, стоящие на полу.
 *
 * КАРТА КООРДИНАТ: игровая логика остаётся 2D-сверху (x, y). В 3D мы кладём
 * y на ось Z: мировая точка = (x, высота, y). Пол — плоскость Y=0; вверх — +Y.
 * Поэтому ВСЯ математика и КОЛЛИЗИИ ядра без изменений: хитбоксы по-прежнему на
 * полу (footprint спрайта), псевдо-3D — чисто визуальный слой.
 *
 * Камера фиксированная на комнату (как в Isaac), кадрирует всю комнату.
 */

// ── Параметры вида (крути для настройки картинки) ─────────────
const WALL_H = 38;            // высота стен
const SPRITE_SCALE = 1.5;     // ширина спрайта = размер хитбокса × это
const SPRITE_ASPECT = 64 / 48; // высота/ширина спрайта (из канваса ассета)
const SHADOW_Y = 0.6;         // тень чуть над полом (без z-fighting)
const TEAR_Y = 13;            // высота полёта снаряда
const GAP = 3 * TILE;         // ширина дверного проёма (3 тайла)

type EnemyVisual = { sprite: THREE.Mesh; shadow: THREE.Mesh; lastHit: number };
type Effect = { mesh: THREE.Mesh; life: number; max: number; vy: number; grow: number };

export class ThreeRenderer implements Renderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly assets: Assets;
  private readonly theme: Theme;

  // Общие геометрии.
  private readonly vGeo = new THREE.PlaneGeometry(1, 1);   // вертикальный спрайт/стена
  private readonly flatGeo = new THREE.PlaneGeometry(1, 1); // лежит на полу (повёрнут)

  // Общие материалы.
  private readonly floorMat: THREE.MeshBasicMaterial;
  private readonly wallMat: THREE.MeshBasicMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly playerMat: Record<'ranged' | 'melee', THREE.MeshBasicMaterial>;
  private readonly enemyMatKey: Record<Enemy['type'], SpriteKey> = {
    normal: 'enemy-normal', fast: 'enemy-fast', boss: 'enemy-boss',
    charger: 'enemy-charger', tank: 'enemy-tank', shooter: 'enemy-shooter',
    splitter: 'enemy-fast', // пока используем визуал fast, пока нет отдельной текстуры
  };

  // Группа статичной геометрии комнаты (пол + стены + двери).
  private roomGroup = new THREE.Group();
  private renderedRoom: Room | null = null;
  private renderedCleared = false;

  // Динамика.
  private readonly playerMesh: THREE.Mesh;
  private readonly playerShadow: THREE.Mesh;
  private readonly enemyVisuals = new Map<Enemy, EnemyVisual>();
  private readonly tearMeshes = new Map<Projectile, THREE.Mesh>();
  private readonly swingMesh: THREE.Mesh;
  private readonly effects: Effect[] = [];
  private lastAtkCD = 0;

  private chestMesh: THREE.Mesh | null = null;
  private pickupMesh: THREE.Mesh | null = null;
  private currentPickupWeapon: string | null = null;

  constructor(canvas: HTMLCanvasElement, assetBasePathOrTheme: string | Theme = 'assets', theme: Theme = DEFAULT_THEME) {
    const assetBasePath = typeof assetBasePathOrTheme === 'string' ? assetBasePathOrTheme : 'assets';
    this.theme = typeof assetBasePathOrTheme === 'string' ? theme : assetBasePathOrTheme;
    this.assets = new Assets(assetBasePath);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(CW, CH, false);
    this.renderer.setClearColor(theme.bg, 1);

    // Наклонная камера, кадрирует комнату с юга-сверху.
    this.camera = new THREE.PerspectiveCamera(44, CW / CH, 1, 4000);
    const cx = OX + RW / 2;
    const cz = OY + RH / 2;
    // Наклонный «исааковский» ракурс: камера приподнята и отодвинута на юг.
    this.camera.position.set(cx, 650, cz + 560);
    this.camera.lookAt(cx, 40, cz);

    // Материалы.
    const floorTex = this.assets.floor();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(COLS, ROWS);
    this.floorMat = new THREE.MeshBasicMaterial({ map: floorTex });

    const wallTex = this.assets.wall();
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 1);
    this.wallMat = new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.DoubleSide });

    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.assets.shadow(), transparent: true, depthWrite: false,
    });

    const spriteMat = (key: SpriteKey) =>
      new THREE.MeshBasicMaterial({ map: this.assets.sprite(key), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    this.playerMat = { ranged: spriteMat('player-ranged'), melee: spriteMat('player-melee') };

    this.scene.add(this.roomGroup);

    this.playerShadow = this.flatMesh(this.shadowMat);
    this.scene.add(this.playerShadow);
    this.playerMesh = new THREE.Mesh(this.vGeo, this.playerMat.ranged);
    this.scene.add(this.playerMesh);

    this.swingMesh = this.flatMesh(
      new THREE.MeshBasicMaterial({
        map: this.assets.spark(), color: new THREE.Color(this.theme.swing),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.swingMesh.visible = false;
    this.scene.add(this.swingMesh);
  }

  render(game: Game, alpha: number): void {
    const room = game.curRoom;
    if (room !== this.renderedRoom || room.cleared !== this.renderedCleared) {
      this.buildRoom(room);
    }

    this.syncPlayer(game, alpha);
    this.syncEnemies(room, alpha);
    this.syncTears(room, alpha);
    this.syncSwing(game);
    this.syncChest(room);
    this.syncPickup(room, game.elapsedSteps + alpha);
    this.updateEffects();

    this.renderer.render(this.scene, this.camera);
  }

  // ── Статика комнаты: пол, стены, двери ────────────────────

  private buildRoom(room: Room): void {
    this.clearGroup(this.roomGroup);
    this.renderedRoom = room;
    this.renderedCleared = room.cleared;

    // Пол — одна плоскость на весь периметр, ПЛАШМЯ (flatMesh кладёт её
    // горизонтально; без этого пол стоял бы вертикально и перспектива «выворачивалась»).
    const floor = this.flatMesh(this.floorMat);
    floor.scale.set(RW, RH, 1);
    floor.position.set(OX + RW / 2, 0, OY + RH / 2);
    this.roomGroup.add(floor);

    // Стены по сторонам с проёмами под двери.
    const xGap: [number, number] | null =
      room.doors.up || room.doors.down ? [OX + 6 * TILE, OX + 6 * TILE + GAP] : null;
    const zGap: [number, number] | null =
      room.doors.left || room.doors.right ? [OY + 4 * TILE, OY + 4 * TILE + GAP] : null;
    this.addWall('x', OY, OX, OX + RW, room.doors.up ? xGap : null);          // север
    this.addWall('x', OY + RH, OX, OX + RW, room.doors.down ? xGap : null);   // юг
    this.addWall('z', OX, OY, OY + RH, room.doors.left ? zGap : null);        // запад
    this.addWall('z', OX + RW, OY, OY + RH, room.doors.right ? zGap : null);  // восток

    // Двери (всегда видны: закрыты в бою, открыты после зачистки).
    const open = room.cleared;
    if (room.doors.up) this.addDoor('x', OX + 7.5 * TILE, OY, open);
    if (room.doors.down) this.addDoor('x', OX + 7.5 * TILE, OY + RH, open);
    if (room.doors.left) this.addDoor('z', OX, OY + 5.5 * TILE, open);
    if (room.doors.right) this.addDoor('z', OX + RW, OY + 5.5 * TILE, open);
  }

  /** Вертикальная стена вдоль оси axis на координате edge от a до b, с проёмом gap. */
  private addWall(axis: 'x' | 'z', edge: number, a: number, b: number, gap: [number, number] | null): void {
    const segs: Array<[number, number]> = gap
      ? [[a, gap[0]], [gap[1], b]].filter(([s, e]) => e - s > 1) as Array<[number, number]>
      : [[a, b]];
    for (const [s, e] of segs) {
      const mesh = new THREE.Mesh(this.vGeo, this.wallMat);
      const mid = (s + e) / 2;
      mesh.scale.set(e - s, WALL_H, 1);
      if (axis === 'x') mesh.position.set(mid, WALL_H / 2, edge);
      else { mesh.rotation.y = Math.PI / 2; mesh.position.set(edge, WALL_H / 2, mid); }
      this.roomGroup.add(mesh);
    }
  }

  /** Дверь в проёме: вертикальный спрайт (закрытая/открытая). */
  private addDoor(axis: 'x' | 'z', x: number, edgeOrZ: number, open: boolean): void {
    const mat = new THREE.MeshBasicMaterial({ map: this.assets.door(open), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.vGeo, mat);
    mesh.scale.set(GAP, WALL_H, 1);
    if (axis === 'x') mesh.position.set(x, WALL_H / 2, edgeOrZ);
    else { mesh.rotation.y = Math.PI / 2; mesh.position.set(x, WALL_H / 2, edgeOrZ); }
    mesh.userData.disposable = true; // материал двери персональный — освобождаем
    this.roomGroup.add(mesh);
  }

  // ── Динамика ──────────────────────────────────────────────

  private syncPlayer(game: Game, alpha: number): void {
    const p = game.player;
    const x = lerp(p.prevX, p.x, alpha);
    const z = lerp(p.prevY, p.y, alpha);

    this.playerMesh.material = p.mode === MODE_RANGED ? this.playerMat.ranged : this.playerMat.melee;
    const w = p.w * SPRITE_SCALE;
    const h = w * SPRITE_ASPECT;
    this.playerMesh.scale.set(w, h, 1);
    this.playerMesh.position.set(x, h / 2, z);
    this.placeShadow(this.playerShadow, x, z, p.w);

    // I-frames: мигаем спрайтом (классические кадры неуязвимости).
    this.playerMesh.visible = !(p.invTimer > 0 && p.invTimer % 6 < 3);

    // Вспышка из дула при выстреле (atkCD «подскочил» вверх).
    if (p.mode === MODE_RANGED && p.atkCD > this.lastAtkCD) {
      const [dx, dz] = DIR[p.facing];
      this.spawnEffect(this.assets.muzzle(), this.theme.flash,
        x + dx * (p.w * 0.7), h * 0.55, z + dz * (p.w * 0.7), 16, 6, { vy: 0, grow: 1.04 });
    }
    this.lastAtkCD = p.atkCD;
  }

  private syncEnemies(room: Room, alpha: number): void {
    const live = new Set<Enemy>();
    for (const e of room.enemies) {
      if (!e.alive) continue;
      live.add(e);

      let v = this.enemyVisuals.get(e);
      if (!v) {
        const mat = new THREE.MeshBasicMaterial({
          map: this.assets.sprite(this.enemyMatKey[e.type]), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
        });
        const sprite = new THREE.Mesh(this.vGeo, mat);
        const shadow = this.flatMesh(this.shadowMat);
        this.scene.add(sprite, shadow);
        v = { sprite, shadow, lastHit: 0 };
        this.enemyVisuals.set(e, v);
      }

      const x = lerp(e.prevX, e.x, alpha);
      const z = lerp(e.prevY, e.y, alpha);
      const pop = 1 + 0.18 * (e.hitTimer / Math.max(1, MELEE.life));
      const w = e.w * SPRITE_SCALE * pop;
      const h = w * SPRITE_ASPECT;
      v.sprite.scale.set(w, h, 1);
      v.sprite.position.set(x, h / 2, z);
      this.placeShadow(v.shadow, x, z, e.w);
      // Искра в момент попадания (hitTimer вырос).
      if (e.hitTimer > v.lastHit) {
        // Увеличенный эффект для смены фазы босса (15+ тиков)
        const size = e.hitTimer >= 12 ? e.w * 1.5 : e.w * 0.9;
        const life = e.hitTimer >= 12 ? 16 : 8;
        this.spawnEffect(this.assets.puff(), 0xff6600, x, e.w * 0.6, z, size, life, { vy: 0.8, grow: 1.06 });
      }
      v.lastHit = e.hitTimer;

      // Цвет подкраски по фазе босса.
      let phaseTint = 0xffffff;
      if (e.burnTimer > 0) phaseTint = 0xff6644;
      else if (e.type === 'boss' && e.phase === 2) phaseTint = 0xff8844;
      else if (e.type === 'boss' && e.phase >= 3) phaseTint = 0xff3300;
      (v.sprite.material as THREE.MeshBasicMaterial).color.setHex(phaseTint);
    }

    // Уборка: исчезнувшие враги. Если враг мёртв — «пуф» на месте гибели.
    for (const [e, v] of this.enemyVisuals) {
      if (live.has(e)) continue;
      if (!e.alive) {
        this.spawnEffect(this.assets.puff(), 0xffffff, e.x, e.w * 0.6, e.y, e.w * 1.2, 14, { vy: 1.1, grow: 1.07 });
      }
      this.scene.remove(v.sprite, v.shadow);
      (v.sprite.material as THREE.Material).dispose();
      this.enemyVisuals.delete(e);
    }
  }

  private syncTears(room: Room, alpha: number): void {
    const live = new Set<Projectile>();
    for (const t of room.tears) {
      if (!t.alive) continue;
      live.add(t);
      let mesh = this.tearMeshes.get(t);
      if (!mesh) {
        const tex =
          t.type === 'fireball' ? this.assets.fireball() :
          t.type === 'beam' ? this.assets.sprite('beam') :
          this.assets.tear();
        mesh = new THREE.Mesh(this.vGeo, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        const s = t.type === 'fireball' ? PROJECTILE.radius * 5 :
                  t.type === 'beam' ? 50 :
                  PROJECTILE.radius * 4;
        mesh.scale.set(s, s, 1);
        this.scene.add(mesh);
        this.tearMeshes.set(t, mesh);
      }
      mesh.position.set(lerp(t.prevX, t.x, alpha), t.type === 'beam' ? 10 : TEAR_Y, lerp(t.prevY, t.y, alpha));
    }
    for (const [t, mesh] of this.tearMeshes) {
      if (live.has(t)) continue;
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      this.tearMeshes.delete(t);
    }
  }

  private syncSwing(game: Game): void {
    const s = game.meleeSwing;
    if (!s || !s.alive) { this.swingMesh.visible = false; return; }
    this.swingMesh.visible = true;
    this.swingMesh.position.set(s.box.x + s.box.w / 2, 2, s.box.y + s.box.h / 2);
    this.swingMesh.scale.set(s.box.w * 1.4, s.box.h * 1.4, 1);
    (this.swingMesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (s.life / s.maxLife);
  }

  private syncChest(room: Room): void {
    if (room.chest?.alive) {
      if (!this.chestMesh) {
        const mat = new THREE.MeshBasicMaterial({
          map: this.assets.sprite('chest'), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
        });
        this.chestMesh = new THREE.Mesh(this.vGeo, mat);
        this.scene.add(this.chestMesh);
      }
      const c = room.chest;
      const w = c.w * 1.2;
      const h = w * (64 / 48);
      this.chestMesh.scale.set(w, h, 1);
      this.chestMesh.position.set(c.x, h / 2, c.y);
    } else if (this.chestMesh) {
      this.scene.remove(this.chestMesh);
      (this.chestMesh.material as THREE.Material).dispose();
      this.chestMesh = null;
    }
  }

  private syncPickup(room: Room, visualStep: number): void {
    if (room.pickup) {
      // Уникальный ключ для кэша меша: для оружия — его id, для предмета — префикс.
      const pk = room.pickup;
      const key = pk.kind === 'weapon' && pk.weaponId
        ? `w:${pk.weaponId}`
        : `i:${pk.itemId ?? '?'}`;
      if (!this.pickupMesh || this.currentPickupWeapon !== key) {
        if (this.pickupMesh) {
          this.scene.remove(this.pickupMesh);
          (this.pickupMesh.material as THREE.Material).dispose();
        }
        const tex = pk.kind === 'weapon' && pk.weaponId
          ? this.assets.weaponIcon(pk.weaponId)
          : this.assets.sprite('pickup');
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
        });
        this.pickupMesh = new THREE.Mesh(this.vGeo, mat);
        this.scene.add(this.pickupMesh);
        this.currentPickupWeapon = key;
      }
      const w = pk.w * 1.6;
      const h = w * (48 / 48);
      this.pickupMesh.scale.set(w, h, 1);
      this.pickupMesh.position.set(pk.x, h / 2 + Math.sin(visualStep / 12) * 3, pk.y);
    } else if (this.pickupMesh) {
      this.scene.remove(this.pickupMesh);
      (this.pickupMesh.material as THREE.Material).dispose();
      this.pickupMesh = null;
      this.currentPickupWeapon = null;
    }
  }

  // ── Эффекты (частицы-биллборды) ───────────────────────────

  private spawnEffect(
    tex: THREE.Texture, color: number, x: number, y: number, z: number,
    size: number, life: number, opts: { vy: number; grow: number },
  ): void {
    const mesh = new THREE.Mesh(this.vGeo, new THREE.MeshBasicMaterial({
      map: tex, color: new THREE.Color(color), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.scale.set(size, size, 1);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.effects.push({ mesh, life, max: life, vy: opts.vy, grow: opts.grow });
  }

  private updateEffects(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life--;
      const mat = fx.mesh.material as THREE.MeshBasicMaterial;
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        mat.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      mat.opacity = fx.life / fx.max;
      fx.mesh.position.y += fx.vy;
      fx.mesh.scale.multiplyScalar(fx.grow);
    }
  }

  // ── Хелперы ───────────────────────────────────────────────

  /** Плоский (лежащий на полу) меш из общей геометрии. */
  private flatMesh(mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.flatGeo, mat);
    m.rotation.x = -Math.PI / 2; // положить плашмя, нормаль вверх
    return m;
  }

  private placeShadow(shadow: THREE.Mesh, x: number, z: number, footprint: number): void {
    shadow.position.set(x, SHADOW_Y, z);
    shadow.scale.set(footprint * 1.4, footprint * 0.9, 1);
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of group.children) {
      // Общие материалы (пол/стены) не трогаем; персональные (двери) — освобождаем.
      if ((child as THREE.Mesh).userData?.disposable) {
        ((child as THREE.Mesh).material as THREE.Material).dispose();
      }
    }
    group.clear();
  }

  dispose(): void {
    this.clearGroup(this.roomGroup);
    for (const v of this.enemyVisuals.values()) (v.sprite.material as THREE.Material).dispose();
    for (const m of this.tearMeshes.values()) (m.material as THREE.Material).dispose();
    for (const fx of this.effects) (fx.mesh.material as THREE.Material).dispose();
    (this.swingMesh.material as THREE.Material).dispose();
    if (this.chestMesh) (this.chestMesh.material as THREE.Material).dispose();
    if (this.pickupMesh) (this.pickupMesh.material as THREE.Material).dispose();
    this.floorMat.dispose();
    this.wallMat.dispose();
    this.shadowMat.dispose();
    this.playerMat.ranged.dispose();
    this.playerMat.melee.dispose();
    this.vGeo.dispose();
    this.flatGeo.dispose();
    this.assets.dispose();
    this.renderer.dispose();
  }
}
