#!/usr/bin/env bash
set -euo pipefail

# bun's per-test default is 5s. On a loaded odu host (ekapkgs from-source
# builds sharing the box) several tests land at 6–20s and fail as timeouts
# while still passing. 30s is above the slowest estimate in `seconds` below.
bun_timeout=(--timeout 30000)

if [[ -z "${ODU_SHARD_INDEX+x}" && -z "${ODU_SHARD_TOTAL+x}" ]]; then
  bun test "${bun_timeout[@]}"
  browser_paths=$(git ls-files '*.browsertest.ts')
  if [[ -n "$browser_paths" ]]; then
    mapfile -t browser_files <<< "$(printf '%s\n' "$browser_paths" | LC_ALL=C sort | sed 's|^|./|')"
    bun test "${bun_timeout[@]}" --conditions browser "${browser_files[@]}"
  fi
  exit
fi

# Per-member heavy-test weights live in each workspace's `test-weights.json`
# (a `{ "key": seconds }` map), keyed by the REPO-RELATIVE path as produced by
# `git ls-files` — so no path translation is needed when partitioning. The
# default for files with no weight is 0.1s (an average ~0.07s plus margin).
# Members with no heavy tests simply omit the file. Git determines coverage,
# so absent/stale estimates cannot skip tests.
exec bun - <<'JS'
const index = Number(process.env.ODU_SHARD_INDEX)
const total = Number(process.env.ODU_SHARD_TOTAL)
if (!/^(0|[1-9][0-9]*)$/.test(process.env.ODU_SHARD_INDEX ?? "") ||
    !/^[1-9][0-9]*$/.test(process.env.ODU_SHARD_TOTAL ?? "") ||
    !Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index >= total)
  throw new Error("invalid ODU_SHARD_INDEX / ODU_SHARD_TOTAL")
let seconds = {}
// merged value = { member, seconds }; carrying the owning member makes a
// collision across two members report both names instead of just the loser.
const membersOut = Bun.spawnSync(["sh", "scripts/workspace-members.sh"])
for (const dir of membersOut.stdout.toString().split("\n")) {
  if (!dir) continue
  const weightsFile = `${dir}/test-weights.json`
  if (!(await Bun.file(weightsFile).exists())) continue
  let weights
  try {
    weights = JSON.parse(await Bun.file(weightsFile).text())
  } catch (e) {
    throw new Error(`${weightsFile}: ${e.message}`)
  }
  if (typeof weights !== "object" || weights === null || Array.isArray(weights))
    throw new Error(`${weightsFile} must be a JSON object of { "repo/relative/path": seconds }`)
  for (const [file, secs] of Object.entries(weights)) {
    if (typeof secs !== "number")
      throw new Error(`${weightsFile}: weight for "${file}" must be a number`)
    if (file in seconds)
      throw new Error(`test "${file}" has a weight in both ${seconds[file].member} and ${dir}`)
    if (!file.startsWith(dir + "/"))
      throw new Error(`${weightsFile}: weight for "${file}" is not under ${dir}/`)
    seconds[file] = { member: dir, seconds: secs }
  }
}
const tracked = Bun.spawnSync(["git", "ls-files", "-z"])
if (tracked.exitCode) throw new Error(tracked.stderr.toString())
const browser = file => file.endsWith(".browsertest.ts")
const files = tracked.stdout.toString().split("\0").filter(file =>
  browser(file) || /(?:\.test\.|_test\.|\.spec\.|_spec\.)[jt]sx?$/.test(file))
if (!files.length) throw new Error("no tracked test files found")
// Allocation is pure; discovery and Bun's execution conditions stay outside it.
function partition(files, total, cost) {
  const ordered = [...files].sort((a, b) => cost(b) - cost(a) || (a < b ? -1 : a > b ? 1 : 0))
  const shards = Array.from({ length: total }, () => ({ files: [], seconds: 0 }))
  for (const file of ordered) {
    const shard = shards.reduce((a, b) => a.seconds <= b.seconds ? a : b)
    shard.files.push(file)
    shard.seconds += cost(file)
  }
  return shards
}
const shard = partition(files, total, file => seconds[file]?.seconds ?? 0.1)[index]
console.log(`test shard ${index + 1}/${total}: ${shard.files.length} files, estimated ${shard.seconds.toFixed(1)}s`)
for (const condition of [false, true]) {
  const selected = shard.files.filter(file => browser(file) === condition).sort()
  if (!selected.length) continue
  const child = Bun.spawn([process.execPath, "test", "--timeout", "30000",
    ...(condition ? ["--conditions", "browser"] : []),
    ...selected.map(file => `./${file}`)], { stdout: "inherit", stderr: "inherit" })
  const status = await child.exited
  if (status) process.exit(status)
}
JS
