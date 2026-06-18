/**
 * Продакшн-сборка: минифицированный бандл src/main.ts → dist/main.js
 * плюс копия index.html. Открывай dist/index.html.
 */
import { build } from 'bun';

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
console.log('Сборка готова → dist/ (открой dist/index.html)');
