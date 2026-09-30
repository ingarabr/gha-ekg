import type { Meta, Point, Step } from "./types.ts";

const MAX_BUCKETS = 30;
const MUTED = "#8b949e";

const CORE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#eab308", "#14b8a6", "#ec4899", "#78716c"];
const SQUARE: Record<string, string> = {
  "#e5484d": "🟥",
  "#3b82f6": "🟦",
  "#22c55e": "🟩",
  "#f59e0b": "🟧",
  "#a855f7": "🟪",
  "#eab308": "🟨",
  "#14b8a6": "🩵",
  "#ec4899": "🩷",
  "#78716c": "🟫",
};

type Pick = (p: Point) => number | undefined;

interface Series {
  name: string;
  color: string;
  pick: Pick;
}

interface Bucketed {
  x: number[];
  y: number[];
}

function bucket(points: Point[], t0: number, pick: Pick): Bucketed | undefined {
  const size = Math.ceil(points.length / MAX_BUCKETS);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    const vals = chunk.map(pick).filter((v): v is number => v !== undefined);
    if (vals.length === 0) return undefined;
    const sec = Math.round((chunk.at(-1)!.t - t0) / 1000);
    x.push(x.length > 0 && sec <= x.at(-1)! ? x.at(-1)! + 1 : sec);
    y.push(Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)));
  }
  return { x, y };
}

const MAX_TICKS = 10;

function clockLabel(sec: number, span: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  if (span < 120) return `${sec}s`;
  if (span < 3600) return `${Math.floor(sec / 60)}:${p(sec % 60)}`;
  return `${Math.floor(sec / 3600)}:${p(Math.floor((sec % 3600) / 60))}`;
}

/**
 * Category labels must be unique or Mermaid merges the buckets, so unlabelled ticks get a distinct
 * run of zero-width spaces. The last bucket is always labelled.
 */
function xAxis(x: number[]): string {
  const every = Math.ceil(x.length / MAX_TICKS);
  const span = x.at(-1) ?? 0;
  const labels = x.map((sec, i) => ((x.length - 1 - i) % every === 0 ? clockLabel(sec, span) : "\u200b".repeat(i + 1)));
  return `    x-axis "time" [${labels.map((l) => JSON.stringify(l)).join(", ")}]`;
}

function theme(colors: string[]): string {
  const axis = ["xAxisLabel", "xAxisTitle", "xAxisTick", "xAxisLine", "yAxisLabel", "yAxisTitle", "yAxisTick", "yAxisLine"];
  return [
    "---",
    "config:",
    "  theme: base",
    "  themeVariables:",
    "    xyChart:",
    '      backgroundColor: "transparent"',
    `      titleColor: "${MUTED}"`,
    ...axis.map((k) => `      ${k}Color: "${MUTED}"`),
    `      plotColorPalette: "${colors.join(", ")}"`,
    "  xyChart:",
    "    width: 900",
    "    height: 260",
    "    titleFontSize: 16",
    "---",
  ].join("\n");
}

interface ChartOptions {
  title: string;
  unit: string;
  points: Point[];
  t0: number;
  series: Series[];
  max?: number;
  statsFromFirst?: boolean;
}

function chart(o: ChartOptions): string {
  const data = o.series.map((s) => bucket(o.points, o.t0, s.pick));
  if (data.some((d) => !d)) return `_${o.title}: n/a on this platform_`;
  const ys = data.map((d) => d!.y);
  const stat = o.statsFromFirst ? ys[0] : ys.flat();
  const avg = stat.reduce((a, b) => a + b, 0) / stat.length;
  const top = o.max ?? Math.max(1, Math.ceil(Math.max(...ys.flat()) * 1.15));
  const key = o.series.length > 1 ? "   " + o.series.map((s) => `${SQUARE[s.color] ?? "▪"} ${s.name}`).join("  ") : "";
  const title = `${o.title} · avg ${avg.toFixed(1)}${o.unit} · peak ${Math.max(...stat).toFixed(1)}${o.unit}${key}`;
  const marks = ys.map((y) => `line [${y.join(", ")}]`);
  const palette = o.series.map((s) => s.color);
  return [
    "```mermaid",
    theme(palette),
    "xychart-beta",
    `    title "${title}"`,
    xAxis(data[0]!.x),
    `    y-axis "${o.unit}" 0 --> ${top}`,
    ...marks.map((m) => `    ${m}`),
    "```",
  ].join("\n");
}

const MAX_LAYERS = 8;

/**
 * Stacked cores: xychart draws bar series on top of each other in declaration order, so the cumulative
 * sums are declared from the tallest down and each visible layer is one core's share of the total, so the
 * top edge of the stack is the total CPU.
 */
function cpuChart(points: Point[], t0: number, cpus: number): string {
  const total: Series = { name: "total", color: "#e5484d", pick: (p) => p.cpu };
  if (!points[0].cores) {
    return chart({ title: "🔥 CPU", unit: "%", points, t0, max: 100, series: [total] });
  }
  const layers = Math.min(cpus, MAX_LAYERS);
  const per = Math.ceil(cpus / layers);
  const groups = Array.from({ length: layers }, (_, i) => ({ from: i * per, to: Math.min(cpus, (i + 1) * per) }));
  const name = (g: { from: number; to: number }) => (g.to - g.from === 1 ? `${g.from + 1}` : `${g.from + 1}-${g.to}`);
  const cumulative = (upTo: number): Pick => (p) => (100 * p.cores!.slice(0, upTo).reduce((a, b) => a + b, 0)) / cpus;
  const layerSeries = groups.map((g, i) => ({ name: name(g), color: CORE_COLORS[i], pick: cumulative(g.to) }));

  const data = [...layerSeries, { ...total, pick: cumulative(cpus) }].map((s) => bucket(points, t0, s.pick));
  if (data.some((d) => !d)) return "";
  const ys = data.map((d) => d!.y);
  const totalY = ys.at(-1)!;
  const square = (s: Series) => `${SQUARE[s.color] ?? "▪"}${s.name}`;
  const key = `cores ${layerSeries.map(square).join(" ")}`;
  const avg = totalY.reduce((a, b) => a + b, 0) / totalY.length;
  const title = `🔥 CPU (${cpus} cores) · avg ${avg.toFixed(0)}% · peak ${Math.max(...totalY).toFixed(0)}% · ${key}`;
  const bars = layerSeries.map((_, i) => layerSeries.length - 1 - i).map((i) => `    bar [${ys[i].join(", ")}]`);
  const palette = layerSeries.map((s) => s.color).reverse();
  return [
    "```mermaid",
    theme(palette),
    "xychart-beta",
    `    title "${title}"`,
    xAxis(data[0]!.x),
    '    y-axis "%" 0 --> 100',
    ...bars,
    "```",
  ].join("\n");
}

function clock(sec: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`;
}

function gantt(steps: Step[], t0: number): string {
  const spans = steps
    .filter((s) => s.end - s.start >= 1000)
    .map((s) => {
      const a = Math.max(0, Math.round((s.start - t0) / 1000));
      return { s, a, b: Math.max(a + 1, Math.round((s.end - t0) / 1000)) };
    });
  if (spans.length === 0) return "";
  const long = Math.max(...spans.map((x) => x.b)) >= 3600;
  const rows = spans.map(({ s, a, b }) => `    ${s.name.replace(/[:;#]/g, " ")} :s${s.number}, ${clock(a)}, ${clock(b)}`);
  return [
    "```mermaid",
    "gantt",
    "    title Steps",
    "    dateFormat HH:mm:ss",
    `    axisFormat ${long ? "%H:%M:%S" : "%M:%S"}`,
    "    section job",
    ...rows,
    "```",
  ].join("\n");
}

export function mermaidTimeline(meta: Meta, points: Point[], steps?: Step[]): string {
  const t0 = meta.startedAt;
  const mb = (v?: number) => (v === undefined ? undefined : v / 1048576);
  const parts = [
    cpuChart(points, t0, meta.cpus),
    chart({ title: "🧠 Memory", unit: "%", points, t0, max: 100, series: [{ name: "used", color: "#a855f7", pick: (p) => (100 * p.memUsed) / p.memTotal }] }),
    chart({
      title: "💾 Disk MB/s",
      unit: "",
      points,
      t0,
      series: [
        { name: "read", color: "#3b82f6", pick: (p) => mb(p.diskRead) },
        { name: "write", color: "#22c55e", pick: (p) => mb(p.diskWrite) },
      ],
    }),
    chart({
      title: "🌐 Network MB/s",
      unit: "",
      points,
      t0,
      series: [
        { name: "rx", color: "#3b82f6", pick: (p) => mb(p.netRx) },
        { name: "tx", color: "#f59e0b", pick: (p) => mb(p.netTx) },
      ],
    }),
  ];
  const g = steps ? gantt(steps, t0) : "";
  if (g) parts.push(g);
  return parts.join("\n\n");
}
