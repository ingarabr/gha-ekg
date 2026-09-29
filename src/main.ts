import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getInput, saveState } from "./actions.ts";
import type { Meta } from "./types.ts";

const interval = Math.max(1, Number(getInput("interval", "5")) || 5);
const dir = join(process.env.RUNNER_TEMP ?? tmpdir(), `gha-ekg-${process.pid}`);
mkdirSync(dir, { recursive: true });

const meta: Meta = {
  startedAt: Date.now(),
  platform: platform(),
  arch: arch(),
  cpus: cpus().length,
  memTotal: totalmem(),
  interval,
};
writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));

const samples = join(dir, "samples.jsonl");
const child = spawn(process.execPath, [fileURLToPath(new URL("../sampler/index.mjs", import.meta.url))], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, EKG_SAMPLES: samples, EKG_INTERVAL: String(interval) },
});
child.unref();

saveState("dir", dir);
saveState("pid", String(child.pid));
console.log(`gha-ekg sampling every ${interval}s (pid ${child.pid})`);
