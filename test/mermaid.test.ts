import assert from "node:assert/strict";
import { test } from "node:test";
import { toPoints } from "../src/analyze.ts";
import { renderReport } from "../src/render.ts";
import type { Meta, Sample } from "../src/types.ts";

const meta: Meta = { startedAt: 0, platform: "linux", arch: "x64", cpus: 2, memTotal: 1000, interval: 1 };
const sample = (t: number, busy: number[], total: number[]): Sample => ({
  t,
  cpuBusy: busy[0] + busy[1],
  cpuTotal: total[0] + total[1],
  coreBusy: busy,
  coreTotal: total,
  memUsed: 500,
  memTotal: 1000,
  netRx: t,
  netTx: t,
});

test("mermaid report has per-core cpu, n/a for missing disk, and a step gantt", () => {
  const points = toPoints([sample(0, [0, 0], [0, 0]), sample(1000, [50, 10], [100, 100]), sample(2000, [100, 10], [200, 200])]);
  const steps = [{ number: 1, name: "build", start: 0, end: 2000 }];
  const md = renderReport(meta, points, steps, undefined, "mermaid");
  assert.match(md, /```mermaid/);
  assert.match(md, /CPU \(2 cores\)/);
  assert.match(md, /Disk MB\/s: n\/a on this platform/);
  assert.match(md, /gantt/);
  assert.match(md, /build :s1, 0, 2/);
});

test("many cores are summarised as busiest and quietest instead of one line each", () => {
  const n = 8;
  const at = (t: number, busy: number) => ({
    t,
    cpuBusy: busy * n,
    cpuTotal: t * n,
    coreBusy: Array.from({ length: n }, (_, i) => (i === 0 ? busy : 0)),
    coreTotal: Array.from({ length: n }, () => t),
    memUsed: 1,
    memTotal: 2,
  });
  const points = toPoints([at(0, 0), at(1000, 1000), at(2000, 2000)]);
  const md = renderReport({ ...meta, cpus: n }, points, undefined, undefined, "mermaid");
  assert.match(md, /busiest core/);
  assert.match(md, /quietest core/);
  assert.doesNotMatch(md, /core 5/);
});
