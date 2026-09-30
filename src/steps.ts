import type { Step } from "./types.ts";

interface ApiStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ApiJob {
  name: string;
  runner_name: string;
  status: string;
  steps?: ApiStep[];
}

/** Finds the current job by runner name; runner names are unique per concurrently running job. */
export async function fetchJob(token: string, env = process.env): Promise<{ name: string; steps: Step[] }> {
  const { GITHUB_API_URL = "https://api.github.com", GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT = "1", RUNNER_NAME } = env;
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}/jobs?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`jobs API returned ${res.status}`);
  const { jobs } = (await res.json()) as { jobs: ApiJob[] };
  const job = jobs.find((j) => j.runner_name === RUNNER_NAME && j.status === "in_progress");
  if (!job?.steps) throw new Error("current job not found in jobs API response");
  const steps = job.steps
    .filter((s) => s.started_at && s.completed_at && s.conclusion !== "skipped")
    .map((s) => ({ number: s.number, name: s.name, start: Date.parse(s.started_at!), end: Date.parse(s.completed_at!) }));
  return { name: job.name, steps };
}
