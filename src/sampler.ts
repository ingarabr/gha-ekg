import { appendFileSync } from "node:fs";
import { collect } from "./collectors/index.ts";

const out = process.env.EKG_SAMPLES;
const intervalMs = Number(process.env.EKG_INTERVAL ?? "5") * 1000;
if (!out) throw new Error("EKG_SAMPLES not set");

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    appendFileSync(out!, JSON.stringify({ t: Date.now(), ...(await collect()) }) + "\n");
  } catch (e) {
    console.error(e);
  } finally {
    busy = false;
  }
}

await tick();
setInterval(tick, intervalMs);
