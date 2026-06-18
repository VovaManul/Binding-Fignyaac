import * as THREE from 'three';
import {
  CW, CH, OX, OY, TILE, COLS, ROWS,
  T_WALL, T_DOOR, MODE_RANGED, PROJECTILE,
} from '../config';
import { lerp } from '../core/util';
import type { Game } from '../core/Game';
import type { Room } from '../core/world/Room';
import type { Enemy } from '../core/entities/Enemy';
import type { Projectile } from '../core/entities/Projectile';
import type { Renderer } from './Renderer';
import { DEFAULT_THEME, type Theme } from './theme';

/** Z-слои: больше значение — ближе к камере (рисуется поверх). */
const Z = { floor: 0, wall: 1, door: 0.5, swing: 4, entity: 5, tear: 6 };

/**
 * Все материалы — DoubleSide. Наша ортокамера переворачивает ось Y
 * (top=0 сверху), из-за чего инвертируется порядок вершин и при обычном
 * отсечении задних граней плоскости становятся невидимыми. DoubleSide
 * рисует грань с обеих сторон — для плоского 2D это правильный выбор.
 */
function flatMat(params: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, ...params });
}

/**
 * Рендер мира на three.js с ОРТОГРАФИЧЕСКОЙ камерой: 3D-движок, но картинка
 * плоская 2D-сверху (как у настоящего Isaac). Мировые координаты совпадают
 * с пиксельными координатами логики (x вправо, y вниз), поэтому вся
 * математика ядра остаётся валидной без пересчётов.
 *
 * Управление ресурсами:
 *  • геометрии-«единицы» (unitPlane/unitCircle) общие и переиспользуются
 *    масштабированием — не плодим геометрии;
 *  • тайлы комнаты пересобираются ТОЛЬКО при смене комнаты;
 *  • меши сущностей создаются/удаляются по мере появления/исчезновения
 *    (mark-and-sweep), их персональные материалы корректно dispose-ятся.
 */
export class ThreeRenderer implements Renderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;

  // Общие геометрии-единицы (масштабируем под размер сущности).
  private readonly unitPlane = new THREE.PlaneGeometry(1, 1);
  private readonly unitCircle = new THREE.CircleGeometry(0.5, 24);

  // Общие материалы тайлов (без пер-тайлового мигания — можно шарить).
  private readonly tileMats: Record<string, THREE.MeshBasicMaterial>;

  // Группа статичных тайлов текущей комнаты.
  private roomGroup = new THREE.Group();
  private renderedRoom: Room | null = null;

  // Динамические меши с персональными материалами.
  private readonly playerMesh: THREE.Mesh;
  private readonly enemyMeshes = new Map<Enemy, THREE.Mesh>();
  private readonly tearMeshes = new Map<Projectile, THREE.Mesh>();
  private readonly swingMesh: THREE.Mesh;

  private readonly theme: Theme;

  constructor(canvas: HTMLCanvasElement, theme: Theme = DEFAULT_THEME) {
    this.theme = theme;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(CW, CH, false);
    this.renderer.setClearColor(this.theme.bg, 1);

    // Ортокамера: world (0,0) — верхний левый угол, (CW,CH) — нижний правый.
    this.camera = new THREE.OrthographicCamera(0, CW, 0, CH, 0.1, 1000);
    this.camera.position.z = 100;

    this.tileMats = {
      floorA: flatMat({ color: this.theme.floorA }),
      floorB: flatMat({ color: this.theme.floorB }),
      wall: flatMat({ color: this.theme.wall }),
      door: flatMat({ color: this.theme.door }),
    };

    this.scene.add(this.roomGroup);

    this.playerMesh = new THREE.Mesh(this.unitPlane, flatMat({ color: this.theme.playerRanged }));
    this.playerMesh.position.z = Z.entity;
    this.scene.add(this.playerMesh);

    this.swingMesh = new THREE.Mesh(
      this.unitPlane,
      flatMat({ color: this.theme.swing, transparent: true, opacity: 0.45 }),
    );
    this.swingMesh.position.z = Z.swing;
    this.swingMesh.visible = false;
    this.scene.add(this.swingMesh);
  }

  render(game: Game, alpha: number): void {
    const room = game.curRoom;
    if (room !== this.renderedRoom) this.buildRoom(room);

    this.syncPlayer(game, alpha);
    this.syncEnemies(room, alpha);
    this.syncTears(room, alpha);
    this.syncSwing(game);

    this.renderer.render(this.scene, this.camera);
  }

  // ── Статичная геометрия комнаты ───────────────────────────

  private buildRoom(room: Room): void {
    this.clearGroup(this.roomGroup);
    this.renderedRoom = room;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = room.tiles[r][c];
        let mat: THREE.MeshBasicMaterial;
        let z = Z.floor;
        if (t === T_WALL) { mat = this.tileMats.wall; z = Z.wall; }
        else if (t === T_DOOR) { mat = this.tileMats.door; z = Z.door; }
        else { mat = (r + c) % 2 === 0 ? this.tileMats.floorA : this.tileMats.floorB; }

        const mesh = new THREE.Mesh(this.unitPlane, mat);
        mesh.scale.set(TILE, TILE, 1);
        mesh.position.set(OX + c * TILE + TILE / 2, OY + r * TILE + TILE / 2, z);
        this.roomGroup.add(mesh);
      }
    }
  }

  // ── Динамические сущности ─────────────────────────────────

  private syncPlayer(game: Game, alpha: number): void {
    const p = game.player;
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    this.playerMesh.position.set(x, y, Z.entity);
    this.playerMesh.scale.set(p.w, p.h, 1);

    const base = p.mode === MODE_RANGED ? this.theme.playerRanged : this.theme.playerMelee;
    const flashing = p.invTimer > 0 && p.invTimer % 6 < 3;
    (this.playerMesh.material as THREE.MeshBasicMaterial).color.setHex(flashing ? this.theme.flash : base);
  }

  private syncEnemies(room: Room, alpha: number): void {
    const live = new Set<Enemy>();
    for (const e of room.enemies) {
      if (!e.alive) continue;
      live.add(e);

      let mesh = this.enemyMeshes.get(e);
      if (!mesh) {
        const geo = e.type === 'normal' ? this.unitPlane : this.unitCircle;
        mesh = new THREE.Mesh(geo, flatMat());
        mesh.position.z = Z.entity;
        this.scene.add(mesh);
        this.enemyMeshes.set(e, mesh);
      }

      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      mesh.position.set(x, y, Z.entity);
      mesh.scale.set(e.w, e.h, 1);

      const base = e.type === 'fast' ? this.theme.enemyFast : e.type === 'boss' ? this.theme.enemyBoss : this.theme.enemyNormal;
      const flashing = e.hitTimer > 0 && e.hitTimer % 4 < 2;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(flashing ? this.theme.flash : base);
    }
    this.sweep(this.enemyMeshes, live);
  }

  private syncTears(room: Room, alpha: number): void {
    const live = new Set<Projectile>();
    for (const t of room.tears) {
      if (!t.alive) continue;
      live.add(t);

      let mesh = this.tearMeshes.get(t);
      if (!mesh) {
        mesh = new THREE.Mesh(this.unitCircle, flatMat({ color: this.theme.tear }));
        mesh.position.z = Z.tear;
        mesh.scale.set(PROJECTILE.radius * 2, PROJECTILE.radius * 2, 1);
        this.scene.add(mesh);
        this.tearMeshes.set(t, mesh);
      }
      mesh.position.set(lerp(t.prevX, t.x, alpha), lerp(t.prevY, t.y, alpha), Z.tear);
    }
    this.sweep(this.tearMeshes, live);
  }

  private syncSwing(game: Game): void {
    const s = game.meleeSwing;
    if (!s || !s.alive) { this.swingMesh.visible = false; return; }
    this.swingMesh.visible = true;
    this.swingMesh.position.set(s.box.x + s.box.w / 2, s.box.y + s.box.h / 2, Z.swing);
    this.swingMesh.scale.set(s.box.w, s.box.h, 1);
    (this.swingMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * (s.life / 10);
  }

  // ── Утилиты управления ресурсами ──────────────────────────

  /** Удаляет меши, чьих сущностей больше нет, освобождая их материалы. */
  private sweep<K>(map: Map<K, THREE.Mesh>, live: Set<K>): void {
    for (const [key, mesh] of map) {
      if (live.has(key)) continue;
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      map.delete(key);
    }
  }

  private clearGroup(group: THREE.Group): void {
    // Материалы и геометрия тайлов общие (живут весь срок рендера),
    // поэтому здесь только убираем меши из сцены — без dispose.
    group.clear();
  }

  dispose(): void {
    this.clearGroup(this.roomGroup);
    this.sweep(this.enemyMeshes, new Set());
    this.sweep(this.tearMeshes, new Set());
    (this.playerMesh.material as THREE.Material).dispose();
    (this.swingMesh.material as THREE.Material).dispose();
    this.unitPlane.dispose();
    this.unitCircle.dispose();
    for (const m of Object.values(this.tileMats)) m.dispose();
    this.renderer.dispose();
  }
}
