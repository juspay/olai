import { afterEach, expect, test } from "bun:test"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const roots: string[] = []
const repo = resolve(import.meta.dirname, "../../..")
const members = ["packages/alpha", "packages/beta", "packages/plugins/one", "packages/plugins/two"]

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "olai-typecheck-shards-"))
  roots.push(root)
  mkdirSync(join(root, "scripts"))
  for (const name of ["typecheck-shard.sh", "workspace-members.sh"]) {
    copyFileSync(join(repo, "scripts", name), join(root, "scripts", name))
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "fixture",
    workspaces: ["packages/*", "packages/plugins/*"],
    scripts: { typecheck: "echo ROOT; bun run --filter './packages/**' typecheck" },
  }))
  for (const [i, member] of members.entries()) {
    mkdirSync(join(root, member), { recursive: true })
    writeFileSync(join(root, member, "package.json"), JSON.stringify({
      name: `member-${i}`,
      dependencies: i > 0 ? { [`member-${i - 1}`]: "workspace:*" } : {},
      scripts: { typecheck: `echo CHECKED:${member}` },
    }))
  }
  return root
}

function run(root: string, shard: Record<string, string | undefined> = {}) {
  const env = { ...process.env }
  delete env.ODU_SHARD_INDEX
  delete env.ODU_SHARD_TOTAL
  const result = Bun.spawnSync(["bash", "scripts/typecheck-shard.sh"], {
    cwd: root, env: { ...env, ...shard }, stdout: "pipe", stderr: "pipe",
  })
  const output = result.stdout.toString() + result.stderr.toString()
  const checked = [...output.matchAll(/CHECKED:(packages\/[^\s]+)/g)].map(match => match[1]!)
  return { status: result.exitCode, output, checked }
}

test("unsharded typechecking retains the root workspace command", () => {
  const result = run(fixture())
  expect(result.status).toBe(0)
  expect(result.output).toContain("ROOT")
  expect(result.checked.sort()).toEqual(members)
})

test.each([1, 2, 6])("%i shards cover every package once, including nested plugins and empty slices", total => {
  const root = fixture()
  const checked: string[] = []
  for (let index = 0; index < total; index++) {
    const result = run(root, { ODU_SHARD_INDEX: String(index), ODU_SHARD_TOTAL: String(total) })
    expect(result.status).toBe(0)
    expect(result.output).not.toContain("ROOT")
    checked.push(...result.checked)
  }
  expect(checked.sort()).toEqual(members)
})

test.each([
  { ODU_SHARD_INDEX: "0" },
  { ODU_SHARD_TOTAL: "2" },
  { ODU_SHARD_INDEX: "", ODU_SHARD_TOTAL: "2" },
  { ODU_SHARD_INDEX: "0", ODU_SHARD_TOTAL: "0" },
  { ODU_SHARD_INDEX: "2", ODU_SHARD_TOTAL: "2" },
  { ODU_SHARD_INDEX: "-1", ODU_SHARD_TOTAL: "2" },
  { ODU_SHARD_INDEX: "x", ODU_SHARD_TOTAL: "2" },
  { ODU_SHARD_INDEX: "01", ODU_SHARD_TOTAL: "2" },
])("invalid shard settings fail before running checks: %j", shard => {
  const result = run(fixture(), shard)
  expect(result.status).toBe(2)
  expect(result.checked).toEqual([])
})

test("a failed workspace expansion cannot become a successful empty slice", () => {
  const root = fixture()
  rmSync(join(root, "packages/plugins"), { recursive: true })
  const result = run(root, { ODU_SHARD_INDEX: "0", ODU_SHARD_TOTAL: "2" })
  expect(result.status).not.toBe(0)
  expect(result.output).toContain("matched no package.json")
  expect(result.checked).toEqual([])
})

test("a package check failure fails its shard", () => {
  const root = fixture()
  writeFileSync(join(root, members[0]!, "package.json"), JSON.stringify({
    name: "member-0", scripts: { typecheck: "exit 7" },
  }))
  expect(run(root, { ODU_SHARD_INDEX: "0", ODU_SHARD_TOTAL: "1" }).status).not.toBe(0)
})
