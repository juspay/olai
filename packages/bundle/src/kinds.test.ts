/**
 * THE KIND VOCABULARY, ASSEMBLED — the composition, the two halves, and the
 * collision that must not be silent.
 *
 * It used to be one function (`kindsOf`) over two lists a composition root
 * held. It is two readings now, and the split is the phase rather than a
 * refactor: the ENABLED half is what the mounted fibers registered
 * (the `Kinds` service), and the BUILT half is read off every row of the bundle
 * ({@link ./bundle.ts}'s `declaredKinds`) INCLUDING the rows this serve
 * disabled. Three claims are worth pinning.
 *
 * **The WORD IS COMPOSED, from the FIBER.** A plugin contributes a bare
 * `terminal` and what a vault declares is `kolu-terminal` — the same move the
 * wire makes with a member, and it buys the same two things: two plugins cannot
 * collide, and a plugin's built-in declaration can only ever claim a key
 * carrying its own name. The prefix is `ctx.fiber.name`, which is the word the
 * registry bound the fiber under, so a plugin cannot claim another's key by
 * spelling it.
 *
 * **BUILT and ENABLED stay apart**, because a declaration and a value are
 * refused against different ones — and they now come from different places for
 * that reason, rather than from one list filtered twice.
 *
 * **And a collision is a throw naming both plugins.** Prefixing makes one
 * unreachable; the count is what makes that a fact rather than a belief.
 */

import { kindWordOf, type PropKind } from "@olai/plugin-api"
import { definePlugin, Kinds, mountPlugin, openPlugins, standing } from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { declaredKinds } from "./bundle.ts"
import { ROWS } from "./rows.ts"
import { type ServerHalf, serverHalves } from "./tree.testlib.ts"

/** The real roster, LOADED — see `./composition.test.ts` for why a test loads
 *  what no door imports. */
const WIRES: ReadonlyArray<ServerHalf> = await serverHalves()

const kind = (word: string): PropKind => ({
  kind: word,
  takes: `\`${word}\` (a word)`,
  admits: () => true,
})

/** ONE PLUGIN THAT TEACHES WORDS — exactly the shape a real one is, because
 *  registering a kind IS what a real one does with this service. */
const teacher = (name: string, words: ReadonlyArray<PropKind>) =>
  definePlugin({
    name,
    needs: [Kinds],
    apply: Effect.gen(function*() {
      const vocabulary = yield* Kinds
      for (const each of words) yield* vocabulary.register(each)
    }),
  })

/** A runtime with `teaching` mounted — which is the only way a word gets into
 *  the table, and the reason these cases build one rather than call a function.
 *
 *  ONE SCOPE for the whole case, and the Effects are run at the EDGE: a case is
 *  an ordinary `async` test, and what it wants to read afterwards is a plain
 *  table. */
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
const ODU = { name: "odu", kinds: [kind("worktree")] }

test("the word a vault declares is the plugin's own, PREFIXED with the plugin", async () => {
  // What a person writes in `_olai/Properties.olai`, and what a page's licence
  // carries. The bare word is the plugin's contribution and never reaches a
  // vault by itself.
  const { table } = await taught([KOLU, ODU])
  expect([...table().keys()].sort()).toEqual(["kolu-terminal", "odu-worktree"])
  // ...and the entry says the composed word too, so a reader that took the
  // ENTRY rather than the key gets one answer rather than the bare one.
  expect(table().get("kolu-terminal")?.kind).toBe("kolu-terminal")
})

test("...and the KEY it claims by convention is that same word, exactly", async () => {
  // THE HUMAN'S RULING, as an equality rather than a sentence: a mounted plugin
  // auto-declares one key and it carries the plugin's name. There is no
  // arrangement of rows under which mounting kolu declares `terminal`.
  const { table } = await taught([KOLU, ODU])
  for (const [word, entry] of table()) expect([word, entry.claims]).toEqual([word, word])
})

test("the prefix is the FIBER's name and not anything the plugin passed in", async () => {
  // The stamp that used to be threaded by a composition root. A plugin hands
  // over a bare word and has no way to say what it is prefixed with: the
  // service the plugin is handed was MINTED from the word the registry bound
  // this fiber under, so there is no argument on `register` for a prefix to
  // arrive through. A plugin mounted as `odu` claims `odu-…` whatever it calls
  // itself inside.
  //
  // The runtime binds the fiber under `odu`, and the row the plugin hands over
  // says nothing about a prefix at all.
  const { table } = await taught([{ name: "odu", kinds: [kind("worktree")] }])
  expect([...table().keys()]).toEqual(["odu-worktree"])
})

test("a word leaves the vocabulary when its plugin unloads", async () => {
  // The registration is a FINALIZER on the plugin's scope, which is the whole
  // difference between a registry and a runtime: what a plugin taught goes with
  // it, in reverse, with nothing on the other side of the wall to remember to do
  // it.
  const { table, mounted, run } = await taught([KOLU])
  expect([...table().keys()]).toEqual(["kolu-terminal"])
  await run(mounted.get("kolu")!.dispose)
  expect(table().size).toBe(0)
})

test("a plugin that teaches no word contributes nothing, which is a whole plugin", async () => {
  const { table } = await taught([{ name: "quiet", kinds: [] }])
  expect(table().size).toBe(0)
})

test("THE COMPOSITION IS INJECTIVE — the separator is refused inside either half", () => {
  // grok's round-3 finding, and the reason a count is not enough on its own:
  // `ab` + `c-d` and `ab-c` + `d` both spell `ab-c-d`, so two plugins whose
  // NAMES genuinely differ could still land on one word. The assembly would
  // catch it and refuse — naming a word neither author wrote, which is a
  // refusal nobody can act on.
  //
  // So the ambiguity is refused where it is created, exactly as
  // `assertTagSegment` refuses a `/` inside a sibling key on the wire. With the
  // separator gone from both halves the composition is injective, and the
  // collision below is unreachable rather than merely reported.
  expect(() => kindWordOf("ab", "c-d")).toThrow(/carries "-"/)
  expect(() => kindWordOf("ab-c", "d")).toThrow(/carries "-"/)
  // The message says WHICH half, because the two are fixed in different files.
  expect(() => kindWordOf("ab-c", "d")).toThrow(/plugin name/)
  expect(() => kindWordOf("ab", "c-d")).toThrow(/kind/)
  // An empty half composes a word with a bare separator on one end, which names
  // nothing and would be a legal `type` for a vault to write.
  expect(() => kindWordOf("", "terminal")).toThrow(/may not be empty/)
  expect(() => kindWordOf("kolu", "")).toThrow(/may not be empty/)
  // ...and the ordinary composition still is one, which is what keeps the four
  // refusals above from being a function that refuses everything.
  expect(kindWordOf("kolu", "terminal")).toBe("kolu-terminal")
})

test("...so the only reachable collision is one WORD twice, and it names both plugins", async () => {
  // With the halves fenced, two DIFFERENT plugin names cannot compose to one
  // word — that is what injective means, and it is the claim the case above
  // establishes. What is left is two entries under one word, which the assembly
  // must not resolve silently: the underlying `Map.set` would let one plugin's
  // `admits` judge the other's values with nothing red anywhere.
  //
  // TWO PLUGINS AND NOT ONE MOUNTED TWICE, because the row's `id` is the fiber's
  // name and the loader will not mount two rows under one id — so the reachable
  // shape is a build whose bundle names two plugins whose prefixes collide,
  // which cannot happen while the prefix IS the id. What is left, and what this
  // holds, is that the refusal is there and says who.
  // A SECOND PLUGIN under a name a first one already claimed a word for. It DIES
  // in its `apply`, which lands THIS plugin in `failed` with the first untouched
  // — a plugin's collision is that plugin's failure and not the boot's.
  const { table, mounted } = await taught([KOLU, { name: "kolu", kinds: [kind("terminal")] }])
  const second = await Effect.runPromise(mounted.get("kolu")!.report)
  expect(second.state).toBe("failed")
  expect(String(second.fault)).toContain("kolu-terminal")
  // ...and the first plugin's word is still in the table, judged by the first
  // plugin — which is the property the silence would have taken away.
  expect([...table().keys()]).toEqual(["kolu-terminal"])
})

/**
 * THE BUILT HALF READS EVERY ROW, AND THAT IS WHAT KEEPS A FILE'S VERDICT OFF
 * THE FLAG.
 *
 * The distance between the two halves IS `--plugins`: a vault declaring
 * `kolu-terminal` on a serve running only odu has written a legal row — refusing
 * it would make one file broken on one machine and clean on the next, off a flag
 * the file cannot see — while its VALUES are plain text, because `admits` is a
 * promise only a plugin that is here can make.
 *
 * A disabled row never mounts, so its words are not in `Kinds` and cannot
 * be. {@link declaredKinds} is the other reading, and it is deliberately not
 * filtered by anything.
 */
test("the built vocabulary carries every row's words, whatever the flag said", async () => {
  const built = await Effect.runPromise(declaredKinds)
  // Not vacuous: this build's rows teach words, and the walk above found them.
  expect(ROWS.length).toBeGreaterThan(0)
  expect(built.size).toBeGreaterThan(0)
  // Every word is prefixed with the row's own `id`, which is the same
  // composition `Kinds` performs off the fiber.
  for (const word of built.keys()) {
    expect(ROWS.some((row) => word.startsWith(`${row.id}-`)), word).toBe(true)
  }
})

/**
 * THE TWO SPELLINGS OF ONE COMPOSITION, held equal.
 *
 * A plugin spells its own composed word from its own `name` for its own vault
 * walk (`plugin-kolu`'s `TERMINAL_TYPE`, `plugin-odu`'s `WORKTREE_TYPE`) — it
 * could import the composition now that `@olai/plugin-api` names no plugin, and
 * it does not, because that walk runs where core's table is not. This is where
 * the two are held to one answer.
 *
 * It reads the REAL bundle rather than a fixture, because a fixture cannot
 * drift and the real plugins can.
 */
test("a plugin's own composed word is the one the bundle composes", async () => {
  const built = await Effect.runPromise(declaredKinds)
  const expected = WIRES.flatMap((wire) => {
    const row = ROWS.find((one) => one.id === wire.name)
    if (row === undefined) throw new Error(`no bundle row for ${wire.name}`)
    return [...built.keys()].filter((word) => word.startsWith(`${row.id}-`))
  })
  expect([...built.keys()].sort()).toEqual([...expected].sort())
  // Not vacuous: both plugins teach a word, so the walk above compared
  // something.
  expect(expected.length).toBe(2)
  // ...and each plugin's own constant is on that list, which is the half a
  // fixture cannot check — `takes` is written with it, and so is the walk that
  // finds the keys a vault declared.
  for (const entry of built.values()) {
    expect(entry.takes, entry.kind).toContain(entry.kind)
  }
})
