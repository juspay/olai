/** Every server row that registers a format inherits the record round trip. */
import { expect, test } from "bun:test"
import { readdirSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, Result } from "effect"
import { claims, type Node } from "@olai/format"
import { selectFixtureRows } from "@olai/bundle/testlib"
import { mountBundle, offered, provide, settled } from "@olai/bundle/bundle"
import { FileKinds, openPlugins } from "@olai/plugin-api/services"
import { VaultBoot } from "olai-plugin-vault/boot"
import { runtimePaths } from "./runtime-paths.ts"

const rows = readdirSync(join(import.meta.dirname, "../../plugins")).filter(row => {
  try { return /\bFileKinds\b/.test(readFileSync(join(import.meta.dirname, "../../plugins", row, "src/server.ts"), "utf8")) }
  catch { return false }
})

test("every registered outline format preserves generated records and canonical bytes", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = yield* Effect.acquireRelease(Effect.sync(() => mkdtempSync(join(tmpdir(), "olai-formats-"))), path => Effect.sync(() => rmSync(path, { recursive: true, force: true })))
  const plugins = yield* openPlugins({ vars: {}, now: () => "" })
  yield* provide(plugins.host, VaultBoot, () => ({ root, runtime: runtimePaths }))
  yield* mountBundle(plugins.host, selectFixtureRows(["vault", ...rows]), "test-minimal")
  yield* settled(plugins.host, ["vault", ...rows])
  const registry = offered(plugins.host, FileKinds)
  expect(registry).toBeDefined()
  const table = claims(registry!.current().values())
  const formats = [...table.byKind.values()].filter(claim => claim.holds === "nodes")
  expect(formats.length).toBeGreaterThan(0)
  // A deterministic generator keeps failures reproducible. Combinations cover
  // optional fields, hierarchy, mirrors, escaping, Unicode and empty files.
  let seed = 0x5f3759df
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed }
  const titles = ["plain", "quoted \"title\"", "café 日本語", "#tag", "a\\b", "one\ntwo"]
  for (const claim of formats) {
    const format = claim.format!
    const covered = new Set<string>()
    for (let sample = 0; sample < 160; sample++) {
      const nodes: Node[] = []
      const count = next() % 12
      for (let i = 0; i < count; i++) {
        const id = `record-${i}`, ord = `a${String(i).padStart(2, "0")}`
        if (i > 1 && next() % 5 === 0) nodes.push({ id, ord, mirror: "record-0" })
        else nodes.push({ id, ord, title: titles[next() % titles.length]!,
          ...(i > 0 && next() % 2 ? { parent: "record-0" } : {}),
          ...(next() % 2 ? { desc: "first line\n\nsecond line" } : {}),
          date: "2026-09-12",
          ...(([{ done: true }, { cancelled: true }, { doing: true }, { todo: true }, {}] as const)[sample % 5]!),
          started: "2026-09-12T08:00:00Z", worked: sample,
          repeat: "every day", doc: "notes.md", after: ["record-0"], blocks: ["record-0"], see: ["record-0"],
          created: "2026-09-12T08:00:00Z", changed: "2026-09-12T09:00:00Z",
          ...(next() % 2 ? { custom: { sample: String(sample) } } : {}),
        })
      }
      for (const node of nodes) for (const key of Object.keys(node)) covered.add(key)
      const path = `round-trip${claim.exts[0]}`
      const bytes = format.serialize(nodes)
      const decoded = format.parse(path, bytes, table)
      if (Result.isFailure(decoded)) throw new Error(`${claim.kind}: ${JSON.stringify(decoded.failure)}`)
      expect(decoded.success.nodes.map(located => located.node)).toEqual(nodes)
      expect(format.serialize(decoded.success.nodes.map(located => located.node))).toBe(bytes)
    }
    expect([...covered].sort()).toEqual(["id", "parent", "ord", "title", "mirror", "done", "cancelled", "doing", "todo", "started", "worked", "date", "repeat", "desc", "doc", "after", "blocks", "see", "created", "changed", "custom"].sort())
  }
}))), 30000)
