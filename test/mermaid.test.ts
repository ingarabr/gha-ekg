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

const cpuBlock = (md: string) => /```mermaid\n(?:(?!```)[\s\S])*?CPU \(\d+ cores\)[\s\S]*?```/.exec(md)![0];

test("mermaid report has per-core cpu, n/a for missing disk, and a step gantt", () => {
  const points = toPoints([sample(0, [0, 0], [0, 0]), sample(1000, [50, 10], [100, 100]), sample(2000, [100, 10], [200, 200])]);
  const steps = [{ number: 1, name: "build", start: 0, end: 2000 }];
  const md = renderReport(meta, points, steps, undefined, "mermaid");
  assert.match(md, /```mermaid/);
  assert.match(md, /CPU \(2 cores\)/);
  assert.match(md, /Disk MB\/s: n\/a on this platform/);
  assert.match(md, /gantt/);
  assert.match(md, /build :s1, 00:00:00, 00:00:02/);
});

test("cores are stacked layers declared tallest first", () => {
  const n = 4;
  const at = (t: number, busy: number) => ({
    t,
    cpuBusy: busy * n,
    cpuTotal: t * n,
    coreBusy: Array.from({ length: n }, () => busy),
    coreTotal: Array.from({ length: n }, () => t),
    memUsed: 1,
    memTotal: 2,
  });
  const points = toPoints([at(0, 0), at(1000, 500), at(2000, 1000)]);
  const md = renderReport({ ...meta, cpus: n }, points, undefined, undefined, "mermaid");
  const bars = [...cpuBlock(md).matchAll(/^ +bar \[(.*)\]$/gm)].map((m) => Number(m[1].split(", ")[0]));
  assert.deepEqual(bars, [50, 37.5, 25, 12.5]);
  assert.doesNotMatch(cpuBlock(md), /^ +line /m);
});

test("more than eight cores are grouped into eight layers", () => {
  const n = 16;
  const at = (t: number) => ({
    t,
    cpuBusy: 0,
    cpuTotal: t * n,
    coreBusy: Array.from({ length: n }, () => 0),
    coreTotal: Array.from({ length: n }, () => t),
    memUsed: 1,
    memTotal: 2,
  });
  const md = renderReport({ ...meta, cpus: n }, toPoints([at(0), at(1000), at(2000)]), undefined, undefined, "mermaid");
  assert.match(md, /🟦1-2/);
  assert.equal([...cpuBlock(md).matchAll(/^ +bar \[/gm)].length, 8);
});
