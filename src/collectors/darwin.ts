import { totalmem } from "node:os";
import type { Counters } from "../types.ts";
import { attempt, cpuTicks, run } from "./util.ts";

async function memory() {
  const out = await run("vm_stat", []);
  const pageSize = Number(/page size of (\d+) bytes/.exec(out)?.[1]);
  const pages = (label: string) => Number(new RegExp(`^Pages ${label}:\\s+(\\d+)`, "m").exec(out)?.[1]);
  const available = (pages("free") + pages("inactive") + pages("speculative")) * pageSize;
  const memTotal = totalmem();
  return { memTotal, memUsed: memTotal - available };
}

async function network() {
  const lines = (await run("netstat", ["-ib"])).split("\n");
  const header = lines[0].trim().split(/\s+/);
  const ib = header.indexOf("Ibytes");
  const ob = header.indexOf("Obytes");
  let rx = 0;
  let tx = 0;
  for (const line of lines.slice(1)) {
    const f = line.trim().split(/\s+/);
    if (!/^en\d+$/.test(f[0]) || !f[2]?.startsWith("<Link#")) continue;
    const shift = f.length === header.length ? 0 : header.length - f.length;
    rx += Number(f[ib - shift]);
    tx += Number(f[ob - shift]);
  }
  return { netRx: rx, netTx: tx };
}

export async function collect(): Promise<Counters> {
  return {
    ...cpuTicks(),
    ...(await memory()),
    ...(await attempt(network)),
  };
}
