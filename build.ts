/**
 * Продакшн-сборка: минифицированный бандл src/main.ts → dist/main.js
 * плюс копия index.html. Открывай dist/index.html.
 */
import { build } from 'bun';
import { cp, mkdir } from 'node:fs/promises';

const result = await build({
  entrypoints: ['./src/main.ts'],
  outdir: './dist',
  target: 'browser',
  minify: true,
  sourcemap: 'external',
});

if (!result.success) {
  console.error('Сборка упала:');
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await Bun.write('./dist/index.html', await Bun.file('./index.html').text());

// Копируем картинки в dist/<asset-pack> (если папка есть).
try {
  await mkdir('./dist/assets', { recursive: true });
  await cp('./src/assets', './dist/assets', { recursive: true });
} catch {
  // src/assets ещё нет — не страшно, рендер откатится на процедурную графику.
}

try {
  await mkdir('./dist/assets-binding-2', { recursive: true });
  await cp('./src/assets-binding-2', './dist/assets-binding-2', { recursive: true });
} catch {
  // Второй пак ассетов опционален.
}

console.log('Сборка готова → dist/ (открой dist/index.html)');
