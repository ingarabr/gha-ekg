import { mermaidTimeline } from "./mermaid.ts";
import { pointsInStep, summarize, type Stats } from "./analyze.ts";
import type { Meta, Point, Step } from "./types.ts";

const BARS = "▁▂▃▄▅▆▇█";

export function sparkline(values: number[], width = 60, max?: number): string {
  if (values.length === 0) return "";
  const buckets: number[] = [];
  const size = Math.max(1, Math.ceil(values.length / width));
  for (let i = 0; i < values.length; i += size) {
    buckets.push(Math.max(...values.slice(i, i + size)));
  }
  const top = max ?? Math.max(...buckets);
  if (top <= 0) return BARS[0].repeat(buckets.length);
  return buckets.map((v) => BARS[Math.min(7, Math.floor((v / top) * 7.999))]).join("");
}

export function bytes(n: number | undefined): string {
  if (n === undefined) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export function duration(seconds: number): string {
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const pct = (n: number) => `${n.toFixed(0)}%`;

function line(label: string, values: (number | undefined)[], fmt: (max: number) => string, max?: number): string | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  if (defined.length === 0) return `${label.padEnd(12)}n/a`;
  return `${label.padEnd(12)}${sparkline(defined, 60, max)}  ${fmt(Math.max(...defined))}`;
}

function overview(meta: Meta, s: Stats, points: Point[]): string {
  const span = (points.at(-1)!.t - meta.startedAt) / 1000;
  const rows = [
    "| | |",
    "|---|---|",
    `| Runner | ${meta.platform}/${meta.arch}, ${meta.cpus} CPUs, ${bytes(meta.memTotal)} RAM |`,
    `| Duration | ${duration(span)} (${s.samples} samples every ${meta.interval}s) |`,
    `| CPU | avg ${pct(s.cpuAvg)}, peak ${pct(s.cpuPeak)} |`,
    `| Memory | peak ${bytes(s.memPeak)} (${pct(s.memPeakPct)}) |`,
    `| Disk | read ${bytes(s.diskRead)}, write ${bytes(s.diskWrite)} |`,
    `| Network | rx ${bytes(s.netRx)}, tx ${bytes(s.netTx)} |`,
  ];
  return rows.join("\n");
}

function timeline(points: Point[]): string {
  const rate = (k: "diskRead" | "diskWrite" | "netRx" | "netTx") => points.map((p) => p[k]);
  const lines = [
    line("CPU", points.map((p) => p.cpu), (m) => `peak ${pct(m)}`, 100),
    line("Memory", points.map((p) => (100 * p.memUsed) / p.memTotal), (m) => `peak ${pct(m)}`, 100),
    line("Disk read", rate("diskRead"), (m) => `peak ${bytes(m)}/s`),
    line("Disk write", rate("diskWrite"), (m) => `peak ${bytes(m)}/s`),
    line("Net rx", rate("netRx"), (m) => `peak ${bytes(m)}/s`),
    line("Net tx", rate("netTx"), (m) => `peak ${bytes(m)}/s`),
  ];
  return "```\n" + lines.join("\n") + "\n```";
}

function stepTable(points: Point[], steps: Step[]): string {
  const rows = ["| Step | Duration | CPU avg / peak | Mem peak | Disk r / w | Net rx / tx |", "|---|---|---|---|---|---|"];
  for (const step of steps) {
    const s = summarize(pointsInStep(points, step));
    const name = `${step.number}. ${step.name.replace(/\|/g, "\\|")}`;
    const dur = duration((step.end - step.start) / 1000);
    rows.push(
      s
        ? `| ${name} | ${dur} | ${pct(s.cpuAvg)} / ${pct(s.cpuPeak)} | ${bytes(s.memPeak)} | ${bytes(s.diskRead)} / ${bytes(s.diskWrite)} | ${bytes(s.netRx)} / ${bytes(s.netTx)} |`
        : `| ${name} | ${dur} | – | – | – | – |`,
    );
  }
  return rows.join("\n");
}

export type OutputFormat = "ascii" | "mermaid";

export function renderReport(meta: Meta, points: Point[], steps: Step[] | undefined, note?: string, format: OutputFormat = "ascii"): string {
  const s = summarize(points);
  const head = `## gha-ekg · ${meta.platform}/${meta.arch}`;
  if (!s) return `${head}\n\nNot enough samples collected (job shorter than one interval).`;
  const chartBlock = format === "mermaid" ? mermaidTimeline(meta, points, steps) : timeline(points);
  const parts = [head, overview(meta, s, points), "### Timeline", chartBlock];
  if (steps && steps.length > 0) {
    parts.push("### Steps", stepTable(points, steps), "_Steps shorter than the sampling interval have no samples._");
  } else if (note) {
    parts.push(`> ${note}`);
  }
  return parts.join("\n\n");
}

export function headline(points: Point[]): string {
  const s = summarize(points);
  if (!s) return "Not enough samples";
  return `CPU avg ${pct(s.cpuAvg)}, peak ${pct(s.cpuPeak)} · memory peak ${bytes(s.memPeak)} (${pct(s.memPeakPct)})`;
}
