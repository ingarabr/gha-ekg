import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendSummary, getInput, getState, warning } from "./actions.ts";
import { toPoints } from "./analyze.ts";
import { collect } from "./collectors/index.ts";
import { renderReport, type OutputFormat } from "./render.ts";
import { fetchSteps } from "./steps.ts";
import type { Meta, Sample, Step } from "./types.ts";

const dir = getState("dir");
const pid = Number(getState("pid"));
if (!dir || !existsSync(join(dir, "samples.jsonl"))) {
  warning("gha-ekg: no samples found, did the main step run?");
  process.exit(0);
}

try {
  process.kill(pid);
} catch {
  // sampler already gone
}

const samplesFile = join(dir, "samples.jsonl");
appendFileSync(samplesFile, JSON.stringify({ t: Date.now(), ...(await collect()) }) + "\n");

const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as Meta;
const samples = readFileSync(samplesFile, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Sample);
const points = toPoints(samples);

let steps: Step[] | undefined;
let note: string | undefined;
const token = getInput("github-token");
if (token) {
  try {
    steps = await fetchSteps(token);
  } catch (e) {
    note = `Step breakdown unavailable: ${(e as Error).message}. The token needs \`actions: read\`.`;
  }
}

if (getInput("job-summary", "true") === "true") {
  const format = getInput("output", "ascii");
  if (format !== "ascii" && format !== "mermaid") warning(`gha-ekg: unknown output "${format}", using ascii`);
  appendSummary(renderReport(meta, points, steps, note, format === "mermaid" ? "mermaid" : "ascii"));
}

if (getInput("upload-artifact", "true") === "true") {
  try {
    const { DefaultArtifactClient } = await import("@actions/artifact");
    const name = `gha-ekg-${(process.env.RUNNER_NAME ?? "runner").replace(/[^A-Za-z0-9._-]/g, "-")}`;
    await new DefaultArtifactClient().uploadArtifact(name, [samplesFile, join(dir, "meta.json")], dir, { retentionDays: 14 });
  } catch (e) {
    warning(`gha-ekg: artifact upload failed: ${(e as Error).message}`);
  }
}
