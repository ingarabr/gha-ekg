import { execFile } from "node:child_process";
import { cpus } from "node:os";

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

export function cpuTicks(): { cpuBusy: number; cpuTotal: number } {
  let busy = 0;
  let total = 0;
  for (const { times } of cpus()) {
    const all = times.user + times.nice + times.sys + times.idle + times.irq;
    total += all;
    busy += all - times.idle;
  }
  return { cpuBusy: busy, cpuTotal: total };
}
