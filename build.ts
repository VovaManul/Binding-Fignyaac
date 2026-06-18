import { build } from "bun";

const result = await build({
  entrypoints: ["./src/main.ts"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "external",
});

if (!result.success) {
  console.error("Build failed", result.logs);
  process.exit(1);
}

// Copy HTML template with correct script reference
const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Dungeon Crawl — Ranged / Melee</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;overflow:hidden;user-select:none}
canvas{display:block;border:1px solid #222;border-radius:2px;cursor:none}
</style>
</head>
<body>
<canvas id="game" width="880" height="660"></canvas>
<script src="main.js"></script>
</body>
</html>`;

Bun.write("./dist/index.html", html);
console.log("Build complete → dist/");
