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
  bars?: boolean;
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
  const marks = o.bars ? [`bar [${ys[0].join(", ")}]`, `line [${ys[0].join(", ")}]`] : ys.map((y) => `line [${y.join(", ")}]`);
  const palette = o.bars ? [o.series[0].color, o.series[0].color] : o.series.map((s) => s.color);
  return [
    "```mermaid",
    theme(palette),
    "xychart-beta",
    `    title "${title}"`,
    `    x-axis "seconds" [${data[0]!.x.join(", ")}]`,
    `    y-axis "${o.unit}" 0 --> ${top}`,
    ...marks.map((m) => `    ${m}`),
    "```",
  ].join("\n");
}

function cpuChart(points: Point[], t0: number, cpus: number): string {
  if (!points[0].cores) {
    return chart({ title: "🔥 CPU", unit: "%", points, t0, max: 100, bars: true, series: [{ name: "cpu", color: "#e5484d", pick: (p) => p.cpu }] });
  }
  const shown = Math.min(cpus, CORE_COLORS.length);
  const series: Series[] = [
    { name: "total", color: "#e5484d", pick: (p) => p.cores!.reduce((a, b) => a + b, 0) },
    ...Array.from({ length: shown }, (_, i) => ({ name: `core ${i + 1}`, color: CORE_COLORS[i], pick: (p: Point) => p.cores![i] })),
  ];
  return chart({ title: `🔥 CPU cores (of ${cpus})`, unit: "", points, t0, max: cpus, series, statsFromFirst: true });
}

function gantt(steps: Step[], t0: number): string {
  const rows = steps
    .filter((s) => s.end - s.start >= 1000)
    .map((s) => {
      const a = Math.max(0, Math.round((s.start - t0) / 1000));
      const b = Math.max(a + 1, Math.round((s.end - t0) / 1000));
      return `    ${s.name.replace(/[:;#]/g, " ")} :s${s.number}, ${a}, ${b}`;
    });
  if (rows.length === 0) return "";
  return ["```mermaid", "gantt", "    title Steps", "    dateFormat X", "    axisFormat %Ss", "    section job", ...rows, "```"].join("\n");
}

export function mermaidTimeline(meta: Meta, points: Point[], steps?: Step[]): string {
  const t0 = meta.startedAt;
  const mb = (v?: number) => (v === undefined ? undefined : v / 1048576);
  const parts = [
    cpuChart(points, t0, meta.cpus),
    chart({ title: "🧠 Memory", unit: "%", points, t0, max: 100, bars: true, series: [{ name: "used", color: "#a855f7", pick: (p) => (100 * p.memUsed) / p.memTotal }] }),
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
