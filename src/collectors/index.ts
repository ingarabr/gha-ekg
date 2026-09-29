import type { Counters } from "../types.ts";

export async function collect(): Promise<Counters> {
  switch (process.platform) {
    case "linux":
      return (await import("./linux.ts")).collect();
    case "darwin":
      return (await import("./darwin.ts")).collect();
    case "win32":
      return (await import("./win32.ts")).collect();
    default:
      throw new Error(`unsupported platform: ${process.platform}`);
  }
}
