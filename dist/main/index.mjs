import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/main.ts
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// src/actions.ts
import { appendFileSync } from "node:fs";
function getInput(name, fallback = "") {
  const v = process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
  return v === void 0 || v === "" ? fallback : v.trim();
}
function saveState(name, value) {
  const file = process.env.GITHUB_STATE;
  if (file) appendFileSync(file, `${name}=${value}
`);
}

// src/main.ts
var interval = Math.max(1, Number(getInput("interval", "5")) || 5);
var dir = join(process.env.RUNNER_TEMP ?? tmpdir(), `gha-ekg-${process.pid}`);
mkdirSync(dir, { recursive: true });
var meta = {
  startedAt: Date.now(),
  platform: platform(),
  arch: arch(),
  cpus: cpus().length,
  memTotal: totalmem(),
  interval
};
writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));
var samples = join(dir, "samples.jsonl");
var child = spawn(process.execPath, [fileURLToPath(new URL("../sampler/index.mjs", import.meta.url))], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, EKG_SAMPLES: samples, EKG_INTERVAL: String(interval) }
});
child.unref();
saveState("dir", dir);
saveState("pid", String(child.pid));
console.log(`gha-ekg sampling every ${interval}s (pid ${child.pid})`);
