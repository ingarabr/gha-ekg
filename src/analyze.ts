import type { Point, Sample, Step } from "./types.ts";

export function toPoints(samples: Sample[]): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) continue;
    const dTotal = b.cpuTotal - a.cpuTotal;
    const rate = (x?: number, y?: number) =>
      x === undefined || y === undefined || y < x ? undefined : (y - x) / dt;
    points.push({
      t: b.t,
      dt,
      cpu: dTotal > 0 ? (100 * (b.cpuBusy - a.cpuBusy)) / dTotal : 0,
      memUsed: b.memUsed,
      memTotal: b.memTotal,
      diskRead: rate(a.diskRead, b.diskRead),
      diskWrite: rate(a.diskWrite, b.diskWrite),
      netRx: rate(a.netRx, b.netRx),
      netTx: rate(a.netTx, b.netTx),
    });
  }
  return points;
}

export interface Stats {
  samples: number;
  cpuAvg: number;
  cpuPeak: number;
  memPeak: number;
  memPeakPct: number;
  diskRead?: number;
  diskWrite?: number;
  netRx?: number;
  netTx?: number;
}

const total = (ps: Point[], key: "diskRead" | "diskWrite" | "netRx" | "netTx") =>
  ps.some((p) => p[key] !== undefined) ? ps.reduce((s, p) => s + (p[key] ?? 0) * p.dt, 0) : undefined;

export function summarize(points: Point[]): Stats | undefined {
  if (points.length === 0) return undefined;
  const dur = points.reduce((s, p) => s + p.dt, 0);
  const peak = points.reduce((m, p) => (p.memUsed > m.memUsed ? p : m));
  return {
    samples: points.length,
    cpuAvg: points.reduce((s, p) => s + p.cpu * p.dt, 0) / dur,
    cpuPeak: Math.max(...points.map((p) => p.cpu)),
    memPeak: peak.memUsed,
    memPeakPct: (100 * peak.memUsed) / peak.memTotal,
    diskRead: total(points, "diskRead"),
    diskWrite: total(points, "diskWrite"),
    netRx: total(points, "netRx"),
    netTx: total(points, "netTx"),
  };
}

/** A point belongs to a step when the interval it ends is finished within the step's window. */
export function pointsInStep(points: Point[], step: Step): Point[] {
  return points.filter((p) => p.t > step.start && p.t <= step.end);
}
