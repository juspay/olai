import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

export const isBrowser = file => file.endsWith(".browsertest.ts")
export const isTest = file => isBrowser(file) || /(?:\.test\.|_test\.|\.spec\.|_spec\.)[jt]sx?$/.test(file)
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0

export function shardSettings(env) {
  const index = env.ODU_SHARD_INDEX
  const total = env.ODU_SHARD_TOTAL
  if (!/^(0|[1-9][0-9]*)$/.test(index ?? "") || !/^[1-9][0-9]*$/.test(total ?? "") ||
      !Number.isSafeInteger(Number(index)) || !Number.isSafeInteger(Number(total)) || Number(index) >= Number(total)) {
    throw new Error("ODU_SHARD_INDEX and ODU_SHARD_TOTAL must name a valid zero-based shard")
  }
  return { index: Number(index), total: Number(total) }
}

// Every worker reads the same committed estimates. Timings affect assignment,
// never discovery: new files receive a conservative one-second estimate.
export function balance(files, milliseconds, total) {
  if (!Number.isSafeInteger(total) || total < 1) throw new Error("invalid shard total")
  const jobs = [...new Set(files)].map(file => {
    const ms = milliseconds[file] ?? 1000
    if (!Number.isFinite(ms) || ms < 0) throw new Error(`invalid timing for ${file}`)
    return { file, ms: Math.max(1, ms) }
  }).sort((a, b) => b.ms - a.ms || compare(a.file, b.file))
  const shards = Array.from({ length: total }, () => ({ files: [], ms: 0 }))
  for (const job of jobs) {
    const shard = shards.reduce((best, candidate) =>
      candidate.ms < best.ms || (candidate.ms === best.ms && candidate.files.length < best.files.length)
        ? candidate : best)
    shard.files.push(job.file)
    shard.ms += job.ms
  }
  for (const shard of shards) shard.files.sort(compare)
  return shards
}

// Bun reports elapsed time per test case. Sum it by file as a scheduling hint;
// module loading and process startup remain outside this estimate.
export function timingsFromLogs(logs) {
  const milliseconds = {}
  for (const log of logs) {
    let file
    const sample = {}
    for (const line of log.replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
      if (line.endsWith(":") && isTest(line.slice(0, -1))) {
        file = line.slice(0, -1).replace(/^\.\//, "")
        sample[file] = 0
      }
      const match = /^\(pass\).*\[([\d.]+)ms\]$/.exec(line)
      if (file && match) sample[file] += Number(match[1])
    }
    for (const [file, ms] of Object.entries(sample)) {
      milliseconds[file] = Math.max(milliseconds[file] ?? 0, Math.ceil(ms), 1)
    }
  }
  if (!Object.keys(milliseconds).length) throw new Error("no test-file timings found")
  return Object.fromEntries(Object.entries(milliseconds).sort(([a], [b]) => compare(a, b)))
}

if (import.meta.main) {
  if (process.argv[2] === "--record") {
    const logs = process.argv.slice(3).map(file => readFileSync(file, "utf8"))
    console.log(JSON.stringify(timingsFromLogs(logs), null, 2))
  } else {
    const { index, total } = shardSettings(process.env)
    const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    if (tracked.error) throw tracked.error
    if (tracked.status !== 0) throw new Error(`cannot list tracked tests: ${tracked.stderr}`)
    const files = tracked.stdout.split("\0").filter(isTest)
    if (!files.length) throw new Error("no tracked test files found")
    const timings = JSON.parse(readFileSync(new URL("./test-timings.json", import.meta.url), "utf8"))
    const shard = balance(files, timings, total)[index]
    console.log(`test shard ${index + 1}/${total}: ${shard.files.length} files, estimated ${(shard.ms / 1000).toFixed(1)}s`)
    for (const browser of [false, true]) {
      const selected = shard.files.filter(file => isBrowser(file) === browser)
      if (!selected.length) continue
      const result = spawnSync(process.execPath, ["test", ...(browser ? ["--conditions", "browser"] : []),
        ...selected.map(file => `./${file}`)], { stdio: "inherit" })
      if (result.error) throw result.error
      if (result.status !== 0) process.exit(result.status ?? 1)
    }
  }
}
