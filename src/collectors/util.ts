import { execFile } from "node:child_process";
import { cpus } from "node:os";
import type { Counters } from "../types.ts";

export function run(cmd: string, args: string[], timeout = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

export async function attempt<T>(f: () => Promise<T>): Promise<T | undefined> {
  try {
    return await f();
  } catch {
    return undefined;
  }
}

export function cpuTicks(): Pick<Counters, "cpuBusy" | "cpuTotal" | "coreBusy" | "coreTotal"> {
  const coreBusy: number[] = [];
  const coreTotal: number[] = [];
  for (const { times } of cpus()) {
    const all = times.user + times.nice + times.sys + times.idle + times.irq;
    coreTotal.push(all);
    coreBusy.push(all - times.idle);
  }
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return { cpuBusy: sum(coreBusy), cpuTotal: sum(coreTotal), coreBusy, coreTotal };
}
