export type Destination = "summary" | "check" | "both" | "none";

export function parseDestination(value: string): Destination | undefined {
  return value === "summary" || value === "check" || value === "both" || value === "none" ? value : undefined;
}

interface Delivery {
  destination: Destination;
  report: () => string;
  /** Creates the check run and returns its URL; rejects when that is not possible. */
  createCheck: (report: string) => Promise<string>;
  appendSummary: (markdown: string) => void;
  warn: (message: string) => void;
}

/** A check run that cannot be created falls back to the job summary so the report is never lost. */
export async function deliver(d: Delivery): Promise<void> {
  if (d.destination === "none") return;
  const report = d.report();
  let checkUrl: string | undefined;
  if (d.destination === "check" || d.destination === "both") {
    try {
      checkUrl = await d.createCheck(report);
    } catch (e) {
      d.warn(`gha-ekg: could not create a check run (${(e as Error).message}); writing the report to the job summary instead`);
    }
  }
  const fullSummary = d.destination === "summary" || d.destination === "both" || !checkUrl;
  const link = checkUrl ? `[gha-ekg check run](${checkUrl})` : "";
  d.appendSummary(fullSummary ? [report, link].filter(Boolean).join("\n\n") : `gha-ekg report: ${link}`);
}
