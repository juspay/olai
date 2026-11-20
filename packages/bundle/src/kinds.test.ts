import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { KIND_SEPARATOR, kindWordOf, type PropKind } from "@olai/plugin-api"
import { definePlugin, Kinds, mountPlugin, standing } from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { declaredKinds } from "./bundle.ts"
import { ROWS } from "./rows.ts"
import { type ServerHalf, serverHalves } from "./tree.testlib.ts"

const WIRES: ReadonlyArray<ServerHalf> = await serverHalves()

const kind = (word: string): PropKind => ({
  kind: word,
  takes: `\`${word}\` (a word)`,
  admits: () => true,
})

const teacher = (name: string, words: ReadonlyArray<PropKind>) =>
  definePlugin({
    name,
    needs: [Kinds],
    apply: Effect.gen(function*() {
      const vocabulary = yield* Kinds
      for (const each of words) yield* vocabulary.register(each)
    }),
  })

const taught = async (
  teaching: ReadonlyArray<{ readonly name: string; readonly kinds: ReadonlyArray<PropKind> }>,
) => {
  const run = standing()
  const plugins = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const mounted = new Map<string, Awaited<ReturnType<typeof run<{
    readonly report: Effect.Effect<{ readonly state: string; readonly fault?: string }>
    readonly dispose: Effect.Effect<void>
  }>>>>()
  for (const one of teaching) {
    mounted.set(one.name, await run(mountPlugin(plugins.host, teacher(one.name, one.kinds))))
  }
  return { table: plugins.kinds, mounted, run }
}

const KOLU = { name: "kolu", kinds: [kind("terminal")] }
const ODU = { name: "odu", kinds: [kind("run")] }

test("the word a vault declares is the plugin's own, PREFIXED with the plugin", async () => {
  const { table } = await taught([KOLU, ODU])
  expect([...table().keys()].sort()).toEqual(["kolu-terminal", "odu-run"])
  expect(table().get("kolu-terminal")?.kind).toBe("kolu-terminal")
})

test("...and the KEY it claims by convention is that same word, exactly", async () => {
  const { table } = await taught([KOLU, ODU])
  for (const [word, entry] of table()) expect([word, entry.claims]).toEqual([word, word])
})

test("the prefix is the FIBER's name and not anything the plugin passed in", async () => {
  const { table } = await taught([{ name: "odu", kinds: [kind("run")] }])
  expect([...table().keys()]).toEqual(["odu-run"])
})

test("a word leaves the vocabulary when its plugin unloads", async () => {
  const { table, mounted, run } = await taught([KOLU])
  expect([...table().keys()]).toEqual(["kolu-terminal"])
  await run(mounted.get("kolu")!.dispose)
  expect(table().size).toBe(0)
})

test("a plugin that teaches no word contributes nothing, which is a whole plugin", async () => {
  const { table } = await taught([{ name: "quiet", kinds: [] }])
  expect(table().size).toBe(0)
})

test("the separator is refused inside the PLUGIN half, and the refusal names the plugin", () => {
  expect(() => kindWordOf("ab-c", "d")).toThrow(/carries "-"/)
  expect(() => kindWordOf("xyne-spaces", "space")).toThrow(/plugin name "xyne-spaces"/)
  expect(kindWordOf("chat", "agent-session")).toBe("chat-agent-session")
  expect(() => kindWordOf("", "terminal")).toThrow(/may not be empty/)
  expect(() => kindWordOf("kolu", "")).toThrow(/may not be empty/)
  expect(kindWordOf("kolu", "terminal")).toBe("kolu-terminal")
})

const halvesOf = (word: string): readonly [string, string] => {
  const at = word.indexOf(KIND_SEPARATOR)
  return [word.slice(0, at), word.slice(at + KIND_SEPARATOR.length)]
}

test("...so THE COMPOSITION IS INJECTIVE: every legal pair round-trips through its word", () => {
  const pairs = [
    ["kolu", "terminal"],
    ["chat", "agent-session"],
    ["chat", "a-b-c"],
    ["chat", "-leading"],
    ["chat", "trailing-"],
    ["ab", "c-d"],
    ["a", "b-ab-c"],
  ] as const
  const words = pairs.map(([plugin, kind]) => kindWordOf(plugin, kind))
  for (const [at, pair] of pairs.entries()) {
    expect([words[at], halvesOf(words[at]!)]).toEqual([words[at], [...pair]])
  }
  expect(new Set(words).size).toBe(words.length)
})

test("...so the only reachable collision is one WORD twice, and it names both plugins", async () => {
  const { table, mounted } = await taught([KOLU, { name: "kolu", kinds: [kind("terminal")] }])
  const second = await Effect.runPromise(mounted.get("kolu")!.report)
  expect(second.state).toBe("failed")
  expect(String(second.fault)).toContain("kolu-terminal")
  expect([...table().keys()]).toEqual(["kolu-terminal"])
})

test("the built vocabulary carries every row's words, regardless of runtime enablement", async () => {
  const built = await Effect.runPromise(declaredKinds)
  expect(ROWS.length).toBeGreaterThan(0)
  expect(built.size).toBeGreaterThan(0)
  for (const word of built.keys()) {
    expect(ROWS.some((row) => word.startsWith(`${row.id}-`)), word).toBe(true)
  }
})

test("a plugin's own composed word is the one the bundle composes", async () => {
  const built = await Effect.runPromise(declaredKinds)
  const expected = WIRES.flatMap((wire) => {
    const row = ROWS.find((one) => one.id === wire.name)
    if (row === undefined) throw new Error(`no bundle row for ${wire.name}`)
    return [...built.keys()].filter((word) => word.startsWith(`${row.id}-`))
  })
  expect([...built.keys()].sort()).toEqual([...expected].sort())
  expect(expected.length).toBe(6)
  for (const entry of built.values()) {
    expect(entry.takes, entry.kind).toContain(entry.kind)
  }
})
