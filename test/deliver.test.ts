import assert from "node:assert/strict";
import { test } from "node:test";
import { createCheckRun } from "../src/checkrun.ts";
import { deliver, type Destination } from "../src/deliver.ts";

function run(destination: Destination, createCheck: () => Promise<string>) {
  const summaries: string[] = [];
  const warnings: string[] = [];
  return deliver({
    destination,
    report: () => "REPORT",
    createCheck,
    appendSummary: (m) => summaries.push(m),
    warn: (m) => warnings.push(m),
  }).then(() => ({ summaries, warnings }));
}

const ok = async () => "https://example/check/1";
const denied = async () => {
  throw new Error("check runs API returned 403");
};

test("summary never touches the checks API", async () => {
  const { summaries } = await run("summary", async () => assert.fail("called"));
  assert.deepEqual(summaries, ["REPORT"]);
});

test("check success leaves only a link in the summary", async () => {
  const { summaries, warnings } = await run("check", ok);
  assert.deepEqual(summaries, ["gha-ekg report: [gha-ekg check run](https://example/check/1)"]);
  assert.equal(warnings.length, 0);
});

test("check falls back to the full summary with a warning when it cannot be created", async () => {
  const { summaries, warnings } = await run("check", denied);
  assert.deepEqual(summaries, ["REPORT"]);
  assert.match(warnings[0], /403.*job summary/);
});

test("both writes the report and links the check run", async () => {
  const { summaries } = await run("both", ok);
  assert.deepEqual(summaries, ["REPORT\n\n[gha-ekg check run](https://example/check/1)"]);
});

test("none writes nothing", async () => {
  const { summaries } = await run("none", async () => assert.fail("called"));
  assert.deepEqual(summaries, []);
});

test("check run is posted for the pull request head and explains a 403", async () => {
  const calls: { url: string; body: any }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return calls.length === 1 ? Response.json({ html_url: "https://x/1" }) : new Response("no", { status: 403 });
  }) as typeof fetch;
  try {
    const env = { GITHUB_REPOSITORY: "o/r", GITHUB_SHA: "merge", GITHUB_EVENT_PATH: "/nonexistent" } as NodeJS.ProcessEnv;
    assert.equal(await createCheckRun("t", { name: "n", title: "t", summary: "s" }, env), "https://x/1");
    assert.equal(calls[0].url, "https://api.github.com/repos/o/r/check-runs");
    assert.equal(calls[0].body.head_sha, "merge");
    assert.equal(calls[0].body.conclusion, "neutral");
    await assert.rejects(() => createCheckRun("t", { name: "n", title: "t", summary: "s" }, env), /checks: write/);
  } finally {
    globalThis.fetch = original;
  }
});
