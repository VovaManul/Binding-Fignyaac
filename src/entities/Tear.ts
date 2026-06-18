export class Tear {
  x: number;
  y: number;
  dx: number;
  dy: number;
  r = 5;
  speed = 7;
  damage = 1;
  life = 80;

  constructor(x: number, y: number, dx: number, dy: number) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
  }

  get alive(): boolean {
    return this.life > 0;
  }
}
