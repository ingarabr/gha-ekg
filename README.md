# gha-ekg

Monitors CPU, memory, disk and network while a GitHub Actions job runs, and posts a report to the job summary with a per-step breakdown. The raw samples are uploaded as an artifact.

```yaml
permissions:
  actions: read   # for the per-step breakdown

steps:
  - uses: ingarabr/gha-ekg@v0   # first step in the job
  - run: ./build.sh
```

## Demo

- **Live runs:** the [demo workflow](https://github.com/ingarabr/gha-ekg/actions/workflows/demo.yml) runs the action on Linux (x64 and arm64), macOS and Windows on every push to `main`. Open a run, then a job's *Summary* tab to see the report.
- **Sample output:** [docs/demo.md](docs/demo.md) contains the summaries from one run as committed text, so the charts render on GitHub and never expire. Run logs and summaries on GitHub are kept for the repository's retention period (90 days at most), which is why the sample is committed.

To refresh the sample from the latest run:

```
gh run download <run-id> -D artifacts
gh api "repos/ingarabr/gha-ekg/actions/runs/<run-id>/jobs?per_page=100" > jobs.json
node scripts/render-demo.ts artifacts jobs.json docs/demo.md
```

## Inputs

| Input | Default | |
|---|---|---|
| `interval` | `5` | Sampling interval in seconds |
| `output` | `ascii` | Chart format in the summary: `ascii` (sparklines) or `mermaid` (line and bar charts, per-core CPU, step gantt) |
| `report-to` | `summary` | Where the report goes: `summary`, `check`, `both` or `none` (see below) |
| `upload-artifact` | `true` | Upload `samples.jsonl` and `meta.json` as an artifact |
| `github-token` | `${{ github.token }}` | Reads step timings (`actions: read`) and creates the check run (`checks: write`). Empty disables both |

## Output formats

Set `output` to choose how the timeline is drawn in the job summary. The overview table and the per-step table are the same in both.

| Value | Timeline |
|---|---|
| `ascii` (default) | One text sparkline per metric in a code block. Compact, works everywhere, and stays readable for large matrix builds. |
| `mermaid` | Rendered charts: CPU as one line per core plus a total on a cores axis, memory as bars, disk and network as read/write and rx/tx lines, and a gantt chart of the steps. Charts are downsampled to about 30 points. |

```yaml
- uses: ingarabr/gha-ekg@v0
  with:
    output: mermaid
```

Mermaid renders one iframe per chart, so for jobs that produce many summaries (large matrices) `ascii` is the lighter choice. The raw samples are always available in the artifact, independent of the chosen format.

## Where the report goes

`report-to` picks the destination:

| Value | Result |
|---|---|
| `summary` (default) | The report is written to the job summary. Needs no extra permissions. |
| `check` | The report becomes a check run named `gha-ekg · <job>` with its own details page, shown in the pull request's checks. The job summary only gets a link to it. |
| `both` | The full report in the job summary plus the check run. |
| `none` | No report. Samples are still uploaded as an artifact. |

Creating a check run needs `checks: write`, and pull requests from forks get a read-only token. When the check run cannot be created, the report is written to the job summary instead and a warning explains why, so it is never lost.

```yaml
permissions:
  actions: read
  checks: write

steps:
  - uses: ingarabr/gha-ekg@v0
    with:
      report-to: check
```

## How it works

`main` starts a detached Node process that appends a JSON line of cumulative OS counters every interval. `post` (always runs) stops it, takes a final sample, converts counters to rates, and renders the report. Step boundaries come from the jobs API and are matched to samples by timestamp, so steps shorter than the interval show no data.

No dependencies on the runner and no sudo. Metrics a platform or privilege level cannot provide are shown as `n/a`.

| Metric | Linux | macOS | Windows |
|---|---|---|---|
| CPU | `os.cpus()` | `os.cpus()` | `os.cpus()` |
| Memory | `/proc/meminfo` | `vm_stat` | `os.freemem()` |
| Disk | `/proc/diskstats` | n/a | PowerShell perf counters |
| Network | `/proc/net/dev` | `netstat -ib` | PowerShell perf counters |

## Development

```
npm install
npm run typecheck && npm test
npm run build      # dist/ is committed; CI fails if it is stale
```

The `demo` workflow runs the action on Linux (x64 and arm64), macOS and Windows around a synthetic CPU, memory, disk and network workload (`demo/workload.mjs`).
