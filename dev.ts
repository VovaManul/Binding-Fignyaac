/**
 * Дев-сервер: бандлит src/main.ts → dist/main.js в watch-режиме и раздаёт
 * dist на http://localhost:3000. index.html копируется из корня (единый
 * источник правды) — правь его там, не в dist.
 */
import { spawn } from 'bun';

const builder = spawn(
  // --sourcemap=linked: в DevTools брейкпоинты/стек указывают на твой src/*.ts,
  // а не на собранный main.js. .map отдаётся из dist тем же сервером.
  ['bun', 'build', 'src/main.ts', '--outdir', 'dist', '--target', 'browser', '--sourcemap=linked', '--watch'],
  { stdout: 'inherit', stderr: 'inherit' },
);

const port = 3000;
const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    // index.html отдаём прямо из корня — правки CSS/разметки сразу живые;
    // бандл main.js и карты — из dist (их пишет watch-сборщик).
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(Bun.file('./index.html'));
    }
    // Картинки отдаём прямо из src/<asset-pack>/ — положил PNG → сразу подхватился.
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/assets-binding-2/')) {
      const asset = Bun.file('./src' + url.pathname);
      if (await asset.exists()) return new Response(asset);
      return new Response('Not found', { status: 404 });
    }
    const file = Bun.file('./dist' + url.pathname);
    if (await file.exists()) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`\n  Dev server:  http://localhost:${server.port}`);
console.log('  Watching:    src/\n');

process.on('SIGINT', () => {
  builder.kill();
  server.stop();
  process.exit(0);
});
