import { readFileSync } from "node:fs";

const MAX_TEXT = 65_000;

export interface CheckRunInput {
  name: string;
  title: string;
  summary: string;
}

/** The commit a check must attach to for the PR to show it: the PR head, not the merge commit. */
function headSha(env: NodeJS.ProcessEnv): string {
  try {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? "", "utf8")) as { pull_request?: { head?: { sha?: string } } };
    if (event.pull_request?.head?.sha) return event.pull_request.head.sha;
  } catch {
    // no event payload
  }
  return env.GITHUB_SHA ?? "";
}

export async function createCheckRun(token: string, input: CheckRunInput, env = process.env): Promise<string> {
  const { GITHUB_API_URL = "https://api.github.com", GITHUB_REPOSITORY } = env;
  const summary = input.summary.length > MAX_TEXT ? input.summary.slice(0, MAX_TEXT) + "\n\n_Report truncated._" : input.summary;
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/check-runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      head_sha: headSha(env),
      status: "completed",
      conclusion: "neutral",
      output: { title: input.title, summary },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 404 ? " (the token needs `checks: write`; tokens for pull requests from forks are read-only)" : "";
    throw new Error(`check runs API returned ${res.status}${hint}`);
  }
  return ((await res.json()) as { html_url: string }).html_url;
}
