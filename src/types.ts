/** Cumulative counters read from the OS. Optional fields are unavailable on the current platform or privilege level. */
export interface Counters {
  cpuBusy: number;
  cpuTotal: number;
  coreBusy?: number[];
  coreTotal?: number[];
  memUsed: number;
  memTotal: number;
  diskRead?: number;
  diskWrite?: number;
  netRx?: number;
  netTx?: number;
}

export interface Sample extends Counters {
  t: number;
}

export interface Meta {
  startedAt: number;
  platform: string;
  arch: string;
  cpus: number;
  memTotal: number;
  interval: number;
}

export interface Step {
  number: number;
  name: string;
  start: number;
  end: number;
}

/** Rates for the interval ending at `t`. */
export interface Point {
  t: number;
  dt: number;
  cpu: number;
  /** Busy fraction (0..1) per core. */
  cores?: number[];
  memUsed: number;
  memTotal: number;
  diskRead?: number;
  diskWrite?: number;
  netRx?: number;
  netTx?: number;
}
