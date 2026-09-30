import assert from "node:assert/strict";
import { test } from "node:test";
import { artifactName } from "../src/artifact.ts";

test("two jobs on the same runner get different artifact names", () => {
  const a = artifactName({ GITHUB_JOB: "build", RUNNER_NAME: "runner-1" });
  const b = artifactName({ GITHUB_JOB: "test", RUNNER_NAME: "runner-1" });
  assert.notEqual(a, b);
});

test("the same job on different runners gets different artifact names", () => {
  const a = artifactName({ GITHUB_JOB: "build", RUNNER_NAME: "runner-1" });
  const b = artifactName({ GITHUB_JOB: "build", RUNNER_NAME: "runner-2" });
  assert.notEqual(a, b);
});

test("characters artifact names reject are replaced", () => {
  assert.equal(artifactName({ GITHUB_JOB: "build/x", RUNNER_NAME: "GitHub Actions 1" }), "gha-ekg-build-x-GitHub-Actions-1");
});

test("missing variables still give a valid name", () => {
  assert.equal(artifactName({}), "gha-ekg-job-runner");
});
