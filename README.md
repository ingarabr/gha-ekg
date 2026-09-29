# gha-ekg

Monitors CPU, memory, disk and network while a GitHub Actions job runs, and posts a report to the job summary with a per-step breakdown. The raw samples are uploaded as an artifact.

```yaml
permissions:
  actions: read   # for the per-step breakdown

steps:
  - uses: ingarabr/gha-ekg@v0   # first step in the job
  - run: ./build.sh
```

## Inputs

| Input | Default | |
|---|---|---|
| `interval` | `5` | Sampling interval in seconds |
| `output` | `ascii` | Chart format in the summary: `ascii` (sparklines) or `mermaid` (line and bar charts, per-core CPU, step gantt) |
| `job-summary` | `true` | Write the report to the job summary |
| `upload-artifact` | `true` | Upload `samples.jsonl` and `meta.json` as an artifact |
| `github-token` | `${{ github.token }}` | Used to read step timings. Empty disables the step breakdown |

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
