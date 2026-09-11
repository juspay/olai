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

# Keep scheduling beside execution. These are the >2s files from the passing
# 0342dac6c run; rounded seconds suffice. Other files average ~0.07s, estimated
# at 0.1s. Git determines coverage, so absent/stale estimates cannot skip tests.
exec bun - <<'JS'
const index = Number(process.env.ODU_SHARD_INDEX)
const total = Number(process.env.ODU_SHARD_TOTAL)
if (!/^(0|[1-9][0-9]*)$/.test(process.env.ODU_SHARD_INDEX ?? "") ||
    !/^[1-9][0-9]*$/.test(process.env.ODU_SHARD_TOTAL ?? "") ||
    !Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index >= total)
  throw new Error("invalid ODU_SHARD_INDEX / ODU_SHARD_TOTAL")
const seconds = {
  "packages/child/src/child.test.ts": 3.9,
  "packages/format/src/splice.test.ts": 3.0,
  "packages/ops/src/standing.equivalence.test.ts": 2.6,
  "packages/plugins/chat/src/deliveries.test.ts": 16.3,
  "packages/plugins/chat/src/scoped.test.ts": 12.7,
  "packages/plugins/chat/src/teaching.send.test.ts": 5.4,
  "packages/plugins/chat/src/wake-lifetime.test.ts": 25.4,
  "packages/plugins/git/src/git/git.test.ts": 20.1,
  "packages/plugins/git/src/ledger/pending.test.ts": 2.5,
  "packages/plugins/navigation/src/scroll.test.ts": 3.4,
  "packages/plugins/outlines/src/browser/settled.browsertest.ts": 3.5,
  "packages/server/src/dieWithParent.test.ts": 4.6,
  "packages/server/src/headless.test.ts": 20.1,
  "packages/server/src/lock.test.ts": 7.7,
  "packages/server/src/logLevel.test.ts": 4.8,
  "packages/server/src/profiles.test.ts": 4.4
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
const shard = partition(files, total, file => seconds[file] ?? 0.1)[index]
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
