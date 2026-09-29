import { freemem, totalmem } from "node:os";
import type { Counters } from "../types.ts";
import { attempt, cpuTicks, run } from "./util.ts";

const SCRIPT = [
  "$d = Get-CimInstance Win32_PerfRawData_PerfDisk_PhysicalDisk | Where-Object Name -eq '_Total'",
  "$n = Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface",
  "ConvertTo-Json -Compress @{",
  "dr = [double]$d.DiskReadBytesPersec; dw = [double]$d.DiskWriteBytesPersec;",
  "rx = [double]($n | Measure-Object BytesReceivedPersec -Sum).Sum;",
  "tx = [double]($n | Measure-Object BytesSentPersec -Sum).Sum }",
].join(" ");

async function counters() {
  const out = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT], 20_000);
  const j = JSON.parse(out) as { dr: number; dw: number; rx: number; tx: number };
  return { diskRead: j.dr, diskWrite: j.dw, netRx: j.rx, netTx: j.tx };
}

export async function collect(): Promise<Counters> {
  const memTotal = totalmem();
  return {
    ...cpuTicks(),
    memTotal,
    memUsed: memTotal - freemem(),
    ...(await attempt(counters)),
  };
}
