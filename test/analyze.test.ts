import assert from "node:assert/strict";
import { test } from "node:test";
import { pointsInStep, summarize, toPoints } from "../src/analyze.ts";
import { sparkline } from "../src/render.ts";
import type { Sample } from "../src/types.ts";

const s = (t: number, busy: number, total: number, extra: Partial<Sample> = {}): Sample => ({
  t,
  cpuBusy: busy,
  cpuTotal: total,
  memUsed: 100,
  memTotal: 1000,
  ...extra,
});

test("cpu percent and disk rate come from counter deltas", () => {
  const points = toPoints([s(0, 0, 0, { diskRead: 0 }), s(2000, 50, 100, { diskRead: 2048 })]);
  assert.equal(points.length, 1);
  assert.equal(points[0].cpu, 50);
  assert.equal(points[0].diskRead, 1024);
  assert.equal(points[0].netRx, undefined);
});

test("counter reset yields no rate instead of a negative one", () => {
  const points = toPoints([s(0, 0, 0, { netRx: 500 }), s(1000, 1, 2, { netRx: 10 })]);
  assert.equal(points[0].netRx, undefined);
});

test("summary totals and step windows", () => {
  const points = toPoints([
    s(0, 0, 0, { netRx: 0 }),
    s(1000, 10, 10, { netRx: 1000 }),
    s(2000, 10, 20, { netRx: 1000 }),
  ]);
  const all = summarize(points)!;
  assert.equal(all.netRx, 1000);
  assert.equal(all.cpuPeak, 100);
  assert.equal(pointsInStep(points, { number: 1, name: "a", start: 1000, end: 2000 }).length, 1);
});

test("sparkline scales to max and downsamples", () => {
  assert.equal(sparkline([0, 100], 60, 100), "▁█");
  assert.equal(sparkline([0, 0, 0], 60), "▁▁▁");
  assert.equal(sparkline(Array(120).fill(1), 60).length, 60);
});

test("per-core busy fractions", () => {
  const points = toPoints([
    s(0, 0, 0, { coreBusy: [0, 0], coreTotal: [0, 0] }),
    s(1000, 60, 200, { coreBusy: [50, 10], coreTotal: [100, 100] }),
  ]);
  assert.deepEqual(points[0].cores, [0.5, 0.1]);
});
