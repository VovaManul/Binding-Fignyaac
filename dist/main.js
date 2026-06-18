// src/input.ts
var KEYS = {};
function setupInput() {
  window.addEventListener("keydown", (e) => {
    KEYS[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    KEYS[e.key] = false;
  });
  window.addEventListener("blur", () => {
    for (const k in KEYS)
      delete KEYS[k];
  });
}

// src/constants.ts
var CW = 880;
var CH = 660;
var TILE = 44;
var COLS = 15;
var ROWS = 11;
var RW = COLS * TILE;
var RH = ROWS * TILE;
var OX = (CW - RW) / 2;
var OY = 80;
var T_WALL = 0;
var T_FLOOR = 1;
var T_DOOR = 2;
var MODE_RANGED = 0;
var MODE_MELEE = 1;
var DIR = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};
var OPP = {
  up: "bottom",
  down: "top",
  left: "right",
  right: "left"
};
var DOOR = {
  up: { cols: [6, 7, 8], row: 0, cx: 7, cy: 0 },
  down: { cols: [6, 7, 8], row: 10, cx: 7, cy: 10 },
  left: { col: 0, rows: [4, 5, 6], cx: 0, cy: 5 },
  right: { col: 14, rows: [4, 5, 6], cx: 14, cy: 5 }
};
var MAP_RADIUS = 3;
var MIN_ROOMS = 8;
var EXTRA_ROOMS = 4;

// src/room/tiles.ts
function buildTiles(doorState) {
  const tiles = [];
  for (let r = 0;r < ROWS; r++) {
    tiles[r] = [];
    for (let c = 0;c < COLS; c++) {
      tiles[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? T_WALL : T_FLOOR;
    }
  }
  if (doorState)
    placeDoors(tiles, doorState);
  return tiles;
}
function placeDoors(tiles, doors) {
  if (doors.up)
    for (const c of DOOR.up.cols)
      tiles[DOOR.up.row][c] = T_DOOR;
  if (doors.down)
    for (const c of DOOR.down.cols)
      tiles[DOOR.down.row][c] = T_DOOR;
  if (doors.left)
    for (const r of DOOR.left.rows)
      tiles[r][DOOR.left.col] = T_DOOR;
  if (doors.right)
    for (const r of DOOR.right.rows)
      tiles[r][DOOR.right.col] = T_DOOR;
}

// src/math.ts
function shuffle(a) {
  for (let i = a.length - 1;i > 0; i--) {
    const j = Math.random() * i | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rand(a, b) {
  return Math.random() * (b - a) + a;
}
function ri(a, b) {
  return Math.floor(rand(a, b + 1));
}
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// src/room/Room.ts
class Room {
  c;
  r;
  type;
  doors = { up: false, down: false, left: false, right: false };
  visited = false;
  cleared = false;
  enemies = [];
  tears = [];
  tiles;
  constructor(c, r, type) {
    this.c = c;
    this.r = r;
    this.type = type;
    this.tiles = buildTiles();
  }
  buildTiles() {
    this.tiles = buildTiles(this.cleared || this.type === "spawn" ? this.doors : undefined);
  }
}

// src/room/RoomMap.ts
class RoomMap {
  rooms = new Map;
  key(c, r) {
    return c + "," + r;
  }
  get(c, r) {
    return this.rooms.get(this.key(c, r));
  }
  has(c, r) {
    return this.rooms.has(this.key(c, r));
  }
  add(c, r, type) {
    const room = new Room(c, r, type);
    this.rooms.set(this.key(c, r), room);
    return room;
  }
  hasBoss() {
    for (const room of this.rooms.values()) {
      if (room.type === "boss")
        return true;
    }
    return false;
  }
  generate() {
    this.add(0, 0, "spawn");
    const frontier = [[0, 0]];
    let count = 1;
    const target = MIN_ROOMS + ri(0, EXTRA_ROOMS);
    const dirs = [
      ["up", 0, -1],
      ["down", 0, 1],
      ["left", -1, 0],
      ["right", 1, 0]
    ];
    while (frontier.length > 0 && count < target) {
      const idx = ri(0, frontier.length - 1);
      const [cr, cc] = frontier[idx];
      shuffle(dirs);
      let added = false;
      for (const [_d, dc, dr] of dirs) {
        if (count >= target)
          break;
        const nc = cr + dc;
        const nr = cc + dr;
        if (Math.abs(nc) > MAP_RADIUS || Math.abs(nr) > MAP_RADIUS)
          continue;
        if (this.has(nc, nr))
          continue;
        let type = "normal";
        if (!this.hasBoss() && (count === target - 1 || Math.random() < 0.2 && count >= 3)) {
          type = "boss";
        } else if (Math.random() < 0.12 && count >= 2) {
          type = "treasure";
        }
        this.add(nc, nr, type);
        const dir = _d;
        this.get(cr, cc).doors[dir] = true;
        this.get(nc, nr).doors[OPP[dir]] = true;
        frontier.push([nc, nr]);
        count++;
        added = true;
      }
      if (!added)
        frontier.splice(idx, 1);
    }
    if (!this.hasBoss()) {
      const normals = [...this.rooms.values()].filter((r) => r.type === "normal");
      if (normals.length > 0) {
        normals[ri(0, normals.length - 1)].type = "boss";
      }
    }
  }
}

// src/entities/Player.ts
class Player {
  x = 0;
  y = 0;
  w = 26;
  h = 26;
  speed = 3.2;
  hp = 6;
  maxHp = 6;
  mode = MODE_RANGED;
  facing = "up";
  moveDir = "up";
  atkCD = 0;
  invTimer = 0;
  transCD = 0;
  get box() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}

// src/entities/Enemy.ts
var STATS = {
  normal: { w: 32, hp: 3, speed: 1.15, damage: 1 },
  fast: { w: 26, hp: 2, speed: 1.9, damage: 1 },
  boss: { w: 46, hp: 10, speed: 0.9, damage: 2 }
};

class Enemy {
  x;
  y;
  type;
  w;
  h;
  hp;
  maxHp;
  speed;
  damage;
  knx = 0;
  kny = 0;
  hitTimer = 0;
  atkTimer = 0;
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    const s = STATS[type];
    this.w = s.w;
    this.h = s.w;
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.speed = s.speed;
    this.damage = s.damage;
  }
  get box() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
  get alive() {
    return this.hp > 0;
  }
}

// src/entities/Tear.ts
class Tear {
  x;
  y;
  dx;
  dy;
  r = 5;
  speed = 7;
  damage = 1;
  life = 80;
  constructor(x, y, dx, dy) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
  }
  get alive() {
    return this.life > 0;
  }
}

// src/entities/MeleeSwing.ts
class MeleeSwing {
  dir;
  life = 10;
  damage = 2;
  kb = 10;
  box;
  constructor(x, y, dir) {
    this.dir = dir;
    const d = 22;
    const s = 50;
    const [dx, dy] = DIR[dir];
    this.box = {
      x: x + (dx > 0 ? d : dx < 0 ? -d - s : -s / 2),
      y: y + (dy > 0 ? d : dy < 0 ? -d - s : -s / 2),
      w: s,
      h: s
    };
  }
  get alive() {
    return this.life > 0;
  }
}

// src/game/collision.ts
function isBlocked(room, col, row) {
  if (row < 0 && room.doors.up && DOOR.up.cols.includes(col))
    return false;
  if (row >= ROWS && room.doors.down && DOOR.down.cols.includes(col))
    return false;
  if (col < 0 && room.doors.left && DOOR.left.rows.includes(row))
    return false;
  if (col >= COLS && room.doors.right && DOOR.right.rows.includes(row))
    return false;
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS)
    return true;
  return room.tiles[row][col] === T_WALL;
}
function collidesWall(box, room, ox, oy) {
  const l = Math.floor((box.x - ox) / TILE_SIZE);
  const r = Math.floor((box.x + box.w - ox) / TILE_SIZE);
  const t = Math.floor((box.y - oy) / TILE_SIZE);
  const b = Math.floor((box.y + box.h - oy) / TILE_SIZE);
  for (let row = t;row <= b; row++) {
    for (let col = l;col <= r; col++) {
      if (isBlocked(room, col, row))
        return true;
    }
  }
  return false;
}
var TILE_SIZE = 44;

// src/game/transitions.ts
var ENTRY_KEYS = {
  up: ["w", "W", "ArrowUp"],
  down: ["s", "S", "ArrowDown"],
  left: ["a", "A", "ArrowLeft"],
  right: ["d", "D", "ArrowRight"]
};
function keyPressed(dir) {
  for (const k of ENTRY_KEYS[dir]) {
    if (KEYS[k])
      return true;
  }
  return false;
}
function checkTransition(game) {
  if (game.gameOver || game.won)
    return;
  if (game.player.transCD > 0)
    return;
  const p = game.player;
  const room = game.curRoom;
  if (!room.cleared)
    return;
  const col = Math.floor((p.x - OX) / TILE);
  const row = Math.floor((p.y - OY) / TILE);
  if (row === 0 && room.doors.up && DOOR.up.cols.includes(col) && keyPressed("up")) {
    if (game.roomMap.has(game.cc, game.cr - 1)) {
      game.cr--;
      game.enterRoom("down");
      return;
    }
  }
  if (row === ROWS - 1 && room.doors.down && DOOR.down.cols.includes(col) && keyPressed("down")) {
    if (game.roomMap.has(game.cc, game.cr + 1)) {
      game.cr++;
      game.enterRoom("up");
      return;
    }
  }
  if (col === 0 && room.doors.left && DOOR.left.rows.includes(row) && keyPressed("left")) {
    if (game.roomMap.has(game.cc - 1, game.cr)) {
      game.cc--;
      game.enterRoom("right");
      return;
    }
  }
  if (col === COLS - 1 && room.doors.right && DOOR.right.rows.includes(row) && keyPressed("right")) {
    if (game.roomMap.has(game.cc + 1, game.cr)) {
      game.cc++;
      game.enterRoom("left");
      return;
    }
  }
}

// src/render/roomRenderer.ts
function drawRoom(ctx, room) {
  for (let r = 0;r < ROWS; r++) {
    for (let c = 0;c < COLS; c++) {
      const x = OX + c * TILE;
      const y = OY + r * TILE;
      const t = room.tiles[r][c];
      if (t === T_WALL) {
        ctx.fillStyle = "#1a1a24";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#242436";
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "#1e1e2c";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = "#161620";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + TILE / 2);
        ctx.lineTo(x + TILE, y + TILE / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + TILE / 2, y);
        ctx.lineTo(x + TILE / 2, y + TILE / 2);
        ctx.stroke();
      } else if (t === T_DOOR) {
        ctx.fillStyle = "#0d0d14";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#2a1e0e";
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        ctx.fillStyle = "#3a2e14";
        ctx.fillRect(x + 10, y + 10, TILE - 20, TILE - 20);
      } else {
        const dark = (r + c) % 2 === 0;
        ctx.fillStyle = dark ? "#2e2e24" : "#353528";
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(OX, OY, RW, RH);
}

// src/render/entityRenderer.ts
function drawEntities(ctx, room, player, meleeSwing) {
  for (const e of room.enemies) {
    if (!e.alive)
      continue;
    const flash = e.hitTimer > 0 && e.hitTimer % 4 < 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + e.h / 4, e.w / 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.type === "boss") {
      drawBoss(ctx, e, flash);
    } else if (e.type === "fast") {
      drawFastEnemy(ctx, e, flash);
    } else {
      drawNormalEnemy(ctx, e, flash);
    }
    ctx.restore();
  }
  drawPlayer(ctx, player);
  for (const t of room.tears) {
    if (!t.alive)
      continue;
    ctx.save();
    ctx.fillStyle = "#6699cc";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#99bbee";
    ctx.beginPath();
    ctx.arc(t.x - 1.5, t.y - 1.5, t.r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (meleeSwing && meleeSwing.alive) {
    drawMeleeSwing(ctx, meleeSwing);
  }
}
function drawBoss(ctx, e, flash) {
  ctx.fillStyle = flash ? "#ddd" : "#5a0a0a";
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a0808";
  ctx.beginPath();
  ctx.arc(e.x - 3, e.y - 3, e.w / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? "#000" : "#ff3333";
  ctx.beginPath();
  ctx.arc(e.x - 8, e.y - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 8, e.y - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(e.x - 8, e.y - 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 8, e.y - 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? "#bbb" : "#3a0505";
  ctx.beginPath();
  ctx.moveTo(e.x - 16, e.y - e.w / 2 + 4);
  ctx.lineTo(e.x - 8, e.y - e.w / 2 - 16);
  ctx.lineTo(e.x, e.y - e.w / 2 + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(e.x - 4, e.y - e.w / 2 + 4);
  ctx.lineTo(e.x + 4, e.y - e.w / 2 - 16);
  ctx.lineTo(e.x + 12, e.y - e.w / 2 + 4);
  ctx.fill();
  if (e.hp < e.maxHp) {
    ctx.fillStyle = "#222";
    ctx.fillRect(e.x - 22, e.y - e.h / 2 - 14, 44, 4);
    ctx.fillStyle = "#c33";
    ctx.fillRect(e.x - 22, e.y - e.h / 2 - 14, 44 * (e.hp / e.maxHp), 4);
  }
}
function drawFastEnemy(ctx, e, flash) {
  ctx.fillStyle = flash ? "#ddd" : "#992222";
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#771111";
  ctx.beginPath();
  ctx.arc(e.x - 1, e.y - 1, e.w / 2 - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff4444";
  ctx.beginPath();
  ctx.arc(e.x - 5, e.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 5, e.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(e.x - 5, e.y - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 5, e.y - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
function drawNormalEnemy(ctx, e, flash) {
  ctx.fillStyle = flash ? "#ccc" : "#5a4a2e";
  ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
  ctx.fillStyle = "#4a3a1e";
  ctx.fillRect(e.x - e.w / 2 + 3, e.y - e.h / 2 + 3, e.w - 6, e.h - 6);
  ctx.fillStyle = "#332816";
  ctx.fillRect(e.x - e.w / 2 + 6, e.y - e.h / 2 + 6, e.w - 12, e.h - 12);
  ctx.fillStyle = "#ffcc66";
  ctx.fillRect(e.x - 7, e.y - 5, 5, 5);
  ctx.fillRect(e.x + 2, e.y - 5, 5, 5);
  ctx.fillStyle = "#000";
  ctx.fillRect(e.x - 6, e.y - 4, 3, 3);
  ctx.fillRect(e.x + 3, e.y - 4, 3, 3);
}
function drawPlayer(ctx, p) {
  ctx.save();
  const flash = p.invTimer > 0 && p.invTimer % 6 < 3;
  const bodyColor = p.mode === 0 ? "#2a6a9a" : "#9a3a2a";
  ctx.fillStyle = flash ? "#ddd" : bodyColor;
  ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
  ctx.fillStyle = flash ? "#ccc" : "rgba(0,0,0,0.3)";
  ctx.fillRect(p.x - p.w / 2 + 3, p.y - p.h / 2 + 3, p.w - 6, p.h - 6);
  const [fx, fy] = DIR[p.facing];
  const wx = p.x + fx * (p.w / 2 + 4);
  const wy = p.y + fy * (p.h / 2 + 4);
  if (p.mode === 0) {
    drawPistol(ctx, p, wx, wy, fx, fy, flash);
  } else {
    drawKnife(ctx, wx, wy, fx, fy, flash);
  }
  ctx.fillStyle = "#fff";
  const ex = p.x + fx * 5;
  const ey = p.y + fy * 5;
  ctx.fillRect(ex - 5, ey - 4, 4, 5);
  ctx.fillRect(ex + 1, ey - 4, 4, 5);
  ctx.fillStyle = "#111";
  ctx.fillRect(ex - 4 + fx, ey - 3 + fy, 2, 3);
  ctx.fillRect(ex + 2 + fx, ey - 3 + fy, 2, 3);
  ctx.restore();
}
function drawPistol(ctx, p, wx, wy, fx, fy, flash) {
  ctx.strokeStyle = flash ? "#999" : "#555";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx + fx * 14 + fy * 2, wy + fy * 14 + fx * 2);
  ctx.stroke();
  ctx.fillStyle = flash ? "#aaa" : "#444";
  ctx.save();
  const angle = fy !== 0 ? Math.PI / 2 * (fy < 0 ? -1 : 1) : fx < 0 ? Math.PI : 0;
  ctx.translate(p.x + fx * 8, p.y + fy * 8);
  ctx.rotate(angle);
  ctx.fillRect(-7, -4, 14, 8);
  ctx.restore();
  if (p.atkCD > 8 && p.mode === 0) {
    ctx.fillStyle = "rgba(255,200,50,0.6)";
    ctx.beginPath();
    ctx.arc(wx + fx * 16, wy + fy * 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,200,0.4)";
    ctx.beginPath();
    ctx.arc(wx + fx * 18, wy + fy * 18, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawKnife(ctx, wx, wy, fx, fy, flash) {
  ctx.strokeStyle = flash ? "#bbb" : "#ccc";
  ctx.lineWidth = 2;
  const kx = wx + fx * 6;
  const ky = wy + fy * 6;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(kx + fx * 16 - fy * 6, ky + fy * 16 + fx * 6);
  ctx.lineTo(kx + fx * 16 + fy * 6, ky + fy * 16 - fx * 6);
  ctx.closePath();
  ctx.fillStyle = flash ? "#ddd" : "#d4d4d4";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = flash ? "#a99" : "#5a3a1a";
  ctx.fillRect(kx - fx * 3 - fy * 3, ky - fy * 3 - fx * 3, 8, 8);
  ctx.fillStyle = flash ? "#bbb" : "#888";
  ctx.fillRect(kx - fx * 2 - fy * 5, ky - fy * 2 - fx * 5, 5, 12);
}
function drawMeleeSwing(ctx, s) {
  const alpha = s.life / 10;
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = "#cc8844";
  ctx.fillRect(s.box.x, s.box.y, s.box.w, s.box.h);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ddbb88";
  ctx.lineWidth = 2;
  ctx.strokeRect(s.box.x, s.box.y, s.box.w, s.box.h);
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = "#ffcc88";
  ctx.lineWidth = 3;
  const [dx, dy] = DIR[s.dir];
  ctx.beginPath();
  ctx.moveTo(s.box.x + s.box.w / 2 - dx * 18, s.box.y + s.box.h / 2 - dy * 18);
  ctx.lineTo(s.box.x + s.box.w / 2 + dx * 18, s.box.y + s.box.h / 2 + dy * 18);
  ctx.stroke();
  ctx.restore();
}

// src/render/hudRenderer.ts
function drawHUD(ctx, player, room) {
  drawHPBar(ctx, player);
  drawModeIndicator(ctx, player);
  drawEnemyCount(ctx, room);
  drawRoomLabel(ctx, room);
}
function drawHPBar(ctx, p) {
  const bx = 20, by = 20, bw = 140, bh = 14;
  ctx.fillStyle = "#111";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#2a0a0a";
  ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
  const ratio = Math.max(0, p.hp / p.maxHp);
  const color = ratio > 0.5 ? "#993333" : ratio > 0.25 ? "#994422" : "#663322";
  ctx.fillStyle = color;
  ctx.fillRect(bx + 2, by + 2, (bw - 4) * ratio, bh - 4);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = "#bbb";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, bx + bw / 2, by + bh - 3);
}
function drawModeIndicator(ctx, p) {
  const my = CH - 46;
  ctx.textAlign = "center";
  const label = p.mode === MODE_RANGED ? "RANGED" : "MELEE";
  const color = p.mode === MODE_RANGED ? "#4488cc" : "#cc6644";
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(CW / 2 - 95, my - 18, 190, 34);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(CW / 2 - 95, my - 18, 190, 34);
  ctx.fillStyle = color;
  ctx.font = "bold 17px monospace";
  ctx.fillText(`[ ${label} ]`, CW / 2, my + 8);
  ctx.fillStyle = "#555";
  ctx.font = "11px monospace";
  ctx.fillText("[Tab/Q] switch", CW / 2, my - 26);
  if (p.mode === MODE_RANGED) {
    ctx.strokeStyle = "#88bbdd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 82, my - 4);
    ctx.lineTo(CW / 2 - 72, my - 4);
    ctx.stroke();
    ctx.fillStyle = "#88bbdd";
    ctx.fillRect(CW / 2 - 82, my - 8, 10, 8);
  } else {
    ctx.fillStyle = "#ddbb88";
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 82, my - 10);
    ctx.lineTo(CW / 2 - 74, my - 2);
    ctx.lineTo(CW / 2 - 82, my + 4);
    ctx.fill();
  }
}
function drawEnemyCount(ctx, room) {
  const alive = room.enemies.filter((e) => e.alive).length;
  ctx.textAlign = "left";
  if (alive > 0) {
    ctx.fillStyle = "#aa4444";
    ctx.font = "13px monospace";
    ctx.fillText(`▶ ${alive}`, 20, CH - 18);
  } else if (!room.cleared && room.type !== "spawn") {
    ctx.fillStyle = "#886633";
    ctx.font = "13px monospace";
    ctx.fillText("Clear the room", 20, CH - 18);
  }
}
function drawRoomLabel(ctx, room) {
  if (!room.visited)
    return;
  ctx.textAlign = "right";
  const labels = { spawn: "START", normal: "", treasure: "TREASURE", boss: "BOSS" };
  const label = labels[room.type];
  if (label) {
    ctx.fillStyle = "#555";
    ctx.font = "11px monospace";
    ctx.fillText(label, CW - 20, OY + RH + 30);
  }
}

// src/render/minimapRenderer.ts
var CELL = 14;
var GAP = 2;
function drawMinimap(ctx, map, cc, cr) {
  const cs = CELL + GAP;
  const mx = CW - 180;
  const my = 12;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(mx - 8, my - 8, cs * 7 + 16, cs * 7 + 16);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 8, my - 8, cs * 7 + 16, cs * 7 + 16);
  for (let r = -3;r <= 3; r++) {
    for (let c = -3;c <= 3; c++) {
      const room = map.get(cc + c, cr + r);
      if (!room)
        continue;
      const x = mx + (c + 3) * cs;
      const y = my + (r + 3) * cs;
      let color = "#141414";
      if (room.visited) {
        color = room.type === "spawn" ? "#2a5a2a" : room.type === "boss" ? "#5a1a1a" : room.type === "treasure" ? "#5a5a1a" : "#555";
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL, CELL);
      if (room.visited) {
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        if (room.doors.up)
          ctx.fillRect(x + cs / 2 - 2, y - 2, 4, 3);
        if (room.doors.down)
          ctx.fillRect(x + cs / 2 - 2, y + CELL - 1, 4, 3);
        if (room.doors.left)
          ctx.fillRect(x - 2, y + cs / 2 - 2, 3, 4);
        if (room.doors.right)
          ctx.fillRect(x + CELL - 1, y + cs / 2 - 2, 3, 4);
      }
      if (c === 0 && r === 0) {
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1.5, y - 1.5, CELL + 3, CELL + 3);
      }
    }
  }
}

// src/game/Game.ts
class Game {
  canvas;
  ctx;
  roomMap = new RoomMap;
  player = new Player;
  cc = 0;
  cr = 0;
  meleeSwing = null;
  gameOver = false;
  won = false;
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.enterRoom("up");
    this.loop();
  }
  get curRoom() {
    return this.roomMap.get(this.cc, this.cr);
  }
  toggleMode() {
    this.player.mode = this.player.mode === MODE_RANGED ? MODE_MELEE : MODE_RANGED;
  }
  restart() {
    this.gameOver = false;
    this.won = false;
    this.roomMap = new RoomMap;
    this.player = new Player;
    this.cc = 0;
    this.cr = 0;
    this.meleeSwing = null;
    this.enterRoom("up");
  }
  enterRoom(fromDir) {
    const room = this.curRoom;
    room.visited = true;
    const d = DOOR[fromDir];
    const [ddc, ddr] = DIR[fromDir];
    this.player.x = OX + d.cx * TILE + TILE / 2 - ddc * TILE;
    this.player.y = OY + d.cy * TILE + TILE / 2 - ddr * TILE;
    this.player.facing = fromDir;
    this.player.invTimer = 20;
    this.player.transCD = 15;
    this.meleeSwing = null;
    room.buildTiles();
    room.enemies = [];
    room.tears = [];
    if (!room.cleared && room.type !== "spawn") {
      this.spawnEnemies(room, fromDir);
    } else {
      room.cleared = true;
      room.buildTiles();
    }
  }
  spawnEnemies(room, entryDir) {
    const count = room.type === "boss" ? 1 : room.type === "treasure" ? 0 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0;i < count; i++) {
      let tries = 0;
      let x, y, ok;
      const type = room.type === "boss" ? "boss" : Math.random() < 0.3 ? "fast" : "normal";
      do {
        x = OX + 2 * TILE + Math.random() * (COLS - 4) * TILE;
        y = OY + 2 * TILE + Math.random() * (ROWS - 4) * TILE;
        ok = true;
        const ed = DOOR[entryDir];
        const dx = OX + ed.cx * TILE + TILE / 2;
        const dy = OY + ed.cy * TILE + TILE / 2;
        if (Math.hypot(x - dx, y - dy) < 180)
          ok = false;
        for (const e of room.enemies) {
          if (Math.hypot(x - e.x, y - e.y) < 60) {
            ok = false;
            break;
          }
        }
        if (Math.hypot(x - this.player.x, y - this.player.y) < 150)
          ok = false;
        tries++;
      } while (!ok && tries < 100);
      room.enemies.push(new Enemy(x, y, type));
    }
  }
  loop() {
    if (!this.gameOver && !this.won)
      this.tick();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
  tick() {
    const room = this.curRoom;
    const p = this.player;
    if (p.invTimer > 0)
      p.invTimer--;
    if (p.atkCD > 0)
      p.atkCD--;
    if (p.transCD > 0)
      p.transCD--;
    this.processMovement(p);
    this.processAttack(room, p);
    this.updateMelee(room);
    this.updateTears(room);
    const aliveCount = this.updateEnemies(room, p);
    if (room.enemies.length > 0 && aliveCount === 0 && !room.cleared) {
      room.cleared = true;
      room.buildTiles();
    }
    checkTransition(this);
    if (!this.gameOver) {
      const bossRoom = [...this.roomMap.rooms.values()].find((r) => r.type === "boss");
      if (bossRoom?.cleared)
        this.won = true;
    }
  }
  processMovement(p) {
    let mx = 0, my = 0;
    if (KEYS["w"] || KEYS["W"])
      my = -1;
    if (KEYS["s"] || KEYS["S"])
      my = 1;
    if (KEYS["a"] || KEYS["A"])
      mx = -1;
    if (KEYS["d"] || KEYS["D"])
      mx = 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      if (my < 0)
        p.moveDir = "up";
      else if (my > 0)
        p.moveDir = "down";
      if (mx < 0)
        p.moveDir = "left";
      else if (mx > 0)
        p.moveDir = "right";
      const dx = mx * p.speed;
      const dy = my * p.speed;
      p.x += dx;
      if (collidesWall(p.box, this.curRoom, OX, OY))
        p.x -= dx;
      p.y += dy;
      if (collidesWall(p.box, this.curRoom, OX, OY))
        p.y -= dy;
    }
  }
  processAttack(room, p) {
    let ax = 0, ay = 0;
    if (KEYS["ArrowUp"]) {
      ax = 0;
      ay = -1;
    } else if (KEYS["ArrowDown"]) {
      ax = 0;
      ay = 1;
    } else if (KEYS["ArrowLeft"]) {
      ax = -1;
      ay = 0;
    } else if (KEYS["ArrowRight"]) {
      ax = 1;
      ay = 0;
    } else if (KEYS[" "] || KEYS["Space"]) {
      [ax, ay] = DIR[p.moveDir];
    }
    if ((ax !== 0 || ay !== 0) && p.atkCD <= 0) {
      const len = Math.hypot(ax, ay);
      ax /= len;
      ay /= len;
      const dn = ay < 0 ? "up" : ay > 0 ? "down" : ax < 0 ? "left" : "right";
      p.facing = dn;
      p.atkCD = p.mode === MODE_RANGED ? 10 : 22;
      if (p.mode === MODE_RANGED) {
        room.tears.push(new Tear(p.x, p.y, ax, ay));
      } else {
        this.meleeSwing = new MeleeSwing(p.x, p.y, dn);
      }
    }
  }
  updateMelee(room) {
    if (this.meleeSwing && !this.meleeSwing.alive)
      this.meleeSwing = null;
    if (!this.meleeSwing)
      return;
    this.meleeSwing.life--;
    for (const e of room.enemies) {
      if (!e.alive || e.hitTimer > 0)
        continue;
      if (overlap(e.box, this.meleeSwing.box)) {
        e.hp -= this.meleeSwing.damage;
        e.hitTimer = 10;
        const [dx, dy] = DIR[this.meleeSwing.dir];
        e.knx = dx * this.meleeSwing.kb;
        e.kny = dy * this.meleeSwing.kb;
      }
    }
  }
  updateTears(room) {
    for (const t of room.tears) {
      if (!t.alive)
        continue;
      t.x += t.dx * t.speed;
      t.y += t.dy * t.speed;
      t.life--;
      const col = Math.floor((t.x - OX) / TILE);
      const row = Math.floor((t.y - OY) / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS || t.life <= 0) {
        t.life = 0;
        continue;
      }
      if (room.tiles[row][col] === T_WALL) {
        t.life = 0;
        continue;
      }
      for (const e of room.enemies) {
        if (!e.alive)
          continue;
        if (Math.hypot(t.x - e.x, t.y - e.y) < e.w / 2 + t.r) {
          e.hp -= t.damage;
          e.hitTimer = 8;
          t.life = 0;
          break;
        }
      }
    }
    room.tears = room.tears.filter((t) => t.alive);
  }
  updateEnemies(room, p) {
    let aliveCount = 0;
    for (const e of room.enemies) {
      if (!e.alive)
        continue;
      aliveCount++;
      if (e.hitTimer > 0)
        e.hitTimer--;
      if (Math.abs(e.knx) > 0.1 || Math.abs(e.kny) > 0.1) {
        e.x += e.knx * 3;
        e.y += e.kny * 3;
        e.knx *= 0.85;
        e.kny *= 0.85;
        continue;
      }
      e.knx = 0;
      e.kny = 0;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 500) {
        const s = e.speed;
        const mx = dx / d * s;
        const my = dy / d * s;
        e.x += mx;
        if (collidesWall(e.box, room, OX, OY))
          e.x -= mx;
        e.y += my;
        if (collidesWall(e.box, room, OX, OY))
          e.y -= my;
      }
      if (e.atkTimer > 0)
        e.atkTimer--;
      if (Math.hypot(e.x - p.x, e.y - p.y) < (e.w + p.w) / 2 && p.invTimer <= 0 && e.atkTimer <= 0) {
        p.hp -= e.damage;
        p.invTimer = 60;
        e.atkTimer = 30;
        if (p.hp <= 0) {
          this.gameOver = true;
          return aliveCount;
        }
      }
    }
    return aliveCount;
  }
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CW, CH);
    drawRoom(ctx, this.curRoom);
    drawEntities(ctx, this.curRoom, this.player, this.meleeSwing);
    drawHUD(ctx, this.player, this.curRoom);
    drawMinimap(ctx, this.roomMap, this.cc, this.cr);
    if (this.gameOver)
      this.drawOverlay("#c33", "GAME OVER");
    else if (this.won)
      this.drawOverlay("#3c3", "VICTORY");
  }
  drawOverlay(color, text) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = color;
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, CW / 2, CH / 2 - 20);
    ctx.fillStyle = "#888";
    ctx.font = "18px monospace";
    ctx.fillText("[R] restart", CW / 2, CH / 2 + 40);
  }
}

// src/main.ts
setupInput();
window.addEventListener("keydown", (e) => {
  const game = window.__game;
  if (!game)
    return;
  if ((e.key === "Tab" || e.key === "q" || e.key === "Q") && !game.gameOver && !game.won) {
    e.preventDefault();
    game.toggleMode();
  }
  if (e.key === "r" || e.key === "R") {
    if (game.gameOver || game.won)
      game.restart();
  }
});
window.addEventListener("load", () => {
  const canvas = document.getElementById("game");
  if (!canvas) {
    document.body.innerHTML = '<p style="color:red">Error: canvas element not found</p>';
    return;
  }
  const game = new Game(canvas);
  window.__game = game;
});
