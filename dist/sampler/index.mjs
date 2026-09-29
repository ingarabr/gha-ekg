import { createRequire } from 'module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/collectors/util.ts
import { execFile } from "node:child_process";
import { cpus } from "node:os";
function run(cmd, args, timeout = 1e4) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => err ? reject(err) : resolve(stdout)
    );
  });
}
async function attempt(f) {
  try {
    return await f();
  } catch {
    return void 0;
  }
}
function cpuTicks() {
  const coreBusy = [];
  const coreTotal = [];
  for (const { times } of cpus()) {
    const all = times.user + times.nice + times.sys + times.idle + times.irq;
    coreTotal.push(all);
    coreBusy.push(all - times.idle);
  }
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  return { cpuBusy: sum(coreBusy), cpuTotal: sum(coreTotal), coreBusy, coreTotal };
}
var init_util = __esm({
  "src/collectors/util.ts"() {
    "use strict";
  }
});

// src/collectors/linux.ts
var linux_exports = {};
__export(linux_exports, {
  collect: () => collect
});
import { readFile } from "node:fs/promises";
async function memory() {
  const text = await readFile("/proc/meminfo", "utf8");
  const kb = (key) => Number(new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text)?.[1]) * 1024;
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
async function collect() {
  return {
    ...cpuTicks(),
    ...await memory(),
    ...await attempt(disk),
    ...await attempt(network)
  };
}
var PHYSICAL_DISK, VIRTUAL_NIC;
var init_linux = __esm({
  "src/collectors/linux.ts"() {
    "use strict";
    init_util();
    PHYSICAL_DISK = /^(sd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;
    VIRTUAL_NIC = /^(lo|docker|br-|veth)/;
  }
});

// src/collectors/darwin.ts
var darwin_exports = {};
__export(darwin_exports, {
  collect: () => collect2
});
import { totalmem } from "node:os";
async function memory2() {
  const out2 = await run("vm_stat", []);
  const pageSize = Number(/page size of (\d+) bytes/.exec(out2)?.[1]);
  const pages = (label) => Number(new RegExp(`^Pages ${label}:\\s+(\\d+)`, "m").exec(out2)?.[1]);
  const available = (pages("free") + pages("inactive") + pages("speculative")) * pageSize;
  const memTotal = totalmem();
  return { memTotal, memUsed: memTotal - available };
}
async function network2() {
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
async function collect2() {
  return {
    ...cpuTicks(),
    ...await memory2(),
    ...await attempt(network2)
  };
}
var init_darwin = __esm({
  "src/collectors/darwin.ts"() {
    "use strict";
    init_util();
  }
});

// src/collectors/win32.ts
var win32_exports = {};
__export(win32_exports, {
  collect: () => collect3
});
import { freemem, totalmem as totalmem2 } from "node:os";
async function counters() {
  const out2 = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT], 2e4);
  const j = JSON.parse(out2);
  return { diskRead: j.dr, diskWrite: j.dw, netRx: j.rx, netTx: j.tx };
}
async function collect3() {
  const memTotal = totalmem2();
  return {
    ...cpuTicks(),
    memTotal,
    memUsed: memTotal - freemem(),
    ...await attempt(counters)
  };
}
var SCRIPT;
var init_win32 = __esm({
  "src/collectors/win32.ts"() {
    "use strict";
    init_util();
    SCRIPT = [
      "$d = Get-CimInstance Win32_PerfRawData_PerfDisk_PhysicalDisk | Where-Object Name -eq '_Total'",
      "$n = Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface",
      "ConvertTo-Json -Compress @{",
      "dr = [double]$d.DiskReadBytesPersec; dw = [double]$d.DiskWriteBytesPersec;",
      "rx = [double]($n | Measure-Object BytesReceivedPersec -Sum).Sum;",
      "tx = [double]($n | Measure-Object BytesSentPersec -Sum).Sum }"
    ].join(" ");
  }
});

// src/sampler.ts
import { appendFileSync } from "node:fs";

// src/collectors/index.ts
async function collect4() {
  switch (process.platform) {
    case "linux":
      return (await Promise.resolve().then(() => (init_linux(), linux_exports))).collect();
    case "darwin":
      return (await Promise.resolve().then(() => (init_darwin(), darwin_exports))).collect();
    case "win32":
      return (await Promise.resolve().then(() => (init_win32(), win32_exports))).collect();
    default:
      throw new Error(`unsupported platform: ${process.platform}`);
  }
}

// src/sampler.ts
var out = process.env.EKG_SAMPLES;
var intervalMs = Number(process.env.EKG_INTERVAL ?? "5") * 1e3;
if (!out) throw new Error("EKG_SAMPLES not set");
var busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    appendFileSync(out, JSON.stringify({ t: Date.now(), ...await collect4() }) + "\n");
  } catch (e) {
    console.error(e);
  } finally {
    busy = false;
  }
}
await tick();
setInterval(tick, intervalMs);
