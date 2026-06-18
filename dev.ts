import { spawn } from "bun";

// Ensure dist/ has the HTML shell
await Bun.write(
  "./dist/index.html",
  `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
</html>`
);

// Start build watcher
const builder = spawn(["bun", "build", "src/main.ts", "--outdir", "dist", "--target", "browser", "--watch"], {
  stdout: "inherit",
  stderr: "inherit",
});

// Start dev server
const port = 3000;
const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file("./dist" + path);
    return new Response(file);
  },
});

console.log(`\n  Dev server:  http://localhost:${port}`);
console.log(`  Watching:    src/\n`);

// Graceful shutdown
process.on("SIGINT", () => {
  builder.kill();
  server.stop();
  process.exit(0);
});
