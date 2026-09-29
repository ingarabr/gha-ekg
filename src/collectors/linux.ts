import { readFile } from "node:fs/promises";
import type { Counters } from "../types.ts";
import { attempt, cpuTicks } from "./util.ts";

const PHYSICAL_DISK = /^(sd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;
const VIRTUAL_NIC = /^(lo|docker|br-|veth)/;

async function memory() {
  const text = await readFile("/proc/meminfo", "utf8");
  const kb = (key: string) => Number(new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text)?.[1]) * 1024;
  const memTotal = kb("MemTotal");
  return { memTotal, memUsed: memTotal - kb("MemAvailable") };
}

async function disk() {
  const text = await readFile("/proc/diskstats", "utf8");
  let read = 0;
  let write = 0;
  for (const line of text.split("\n")) {
    const f = line.trim().split(/\s+/);
    if (!PHYSICAL_DISK.test(f[2] ?? "")) continue;
    read += Number(f[5]) * 512;
    write += Number(f[9]) * 512;
  }
  return { diskRead: read, diskWrite: write };
}

async function network() {
  const text = await readFile("/proc/net/dev", "utf8");
  let rx = 0;
  let tx = 0;
  for (const line of text.split("\n").slice(2)) {
    const [iface, rest] = line.split(":");
    if (!rest || VIRTUAL_NIC.test(iface.trim())) continue;
    const f = rest.trim().split(/\s+/);
    rx += Number(f[0]);
    tx += Number(f[8]);
  }
  return { netRx: rx, netTx: tx };
}

export async function collect(): Promise<Counters> {
  return {
    ...cpuTicks(),
    ...(await memory()),
    ...(await attempt(disk)),
    ...(await attempt(network)),
  };
}
