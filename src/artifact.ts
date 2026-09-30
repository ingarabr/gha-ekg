/** Artifact names are unique per workflow run, so two jobs that ran on the same runner must not share one. */
export function artifactName(env = process.env): string {
  const { GITHUB_JOB = "job", RUNNER_NAME = "runner" } = env;
  return ["gha-ekg", GITHUB_JOB, RUNNER_NAME].map((part) => part.replace(/[^A-Za-z0-9._-]/g, "-")).join("-");
}
