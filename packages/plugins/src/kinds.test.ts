/**
 * THE KIND VOCABULARY, ASSEMBLED — the composition, the two halves, and the
 * collision that must not be silent.
 *
 * `kindsOf` is where two lists this composition root already holds become the
 * table `@olai/format` judges with, and there are three claims worth pinning.
 *
 * **The WORD IS COMPOSED.** A plugin contributes a bare `terminal` and what a
 * vault declares is `kolu-terminal` — the same move the wire makes with a
 * member, and it buys the same two things: two plugins cannot collide, and an
 * enabled plugin's built-in declaration can only ever claim a key carrying its
 * own name. A person's `terminal` column is not something a flag on the machine
 * can take over.
 *
 * **BUILT and ENABLED stay apart**, because a declaration and a value are
 * refused against different ones.
 *
 * **And a collision is a throw naming both plugins.** Prefixing makes one
 * unreachable; the count is what makes that a fact rather than a belief.
 */

import { expect, test } from "bun:test"

import { kinds as koluKinds } from "@olai/plugin-kolu/server"
import { kinds as oduKinds } from "@olai/plugin-odu/server"

import { kindsOf, kindWordOf, type PropKind } from "./server.ts"
import { WIRES } from "./surfaces.ts"

const kind = (word: string): PropKind => ({
  kind: word,
  takes: `\`${word}\` (a word)`,
  admits: () => true,
})

const KOLU = { name: "kolu", kinds: [kind("terminal")] }
const ODU = { name: "odu", kinds: [kind("worktree")] }

test("the word a vault declares is the plugin's own, PREFIXED with the plugin", () => {
  // What a person writes in `_olai/Properties.olai`, and what a page's licence
  // carries. The bare word is the plugin's contribution and never reaches a
  // vault by itself.
  const table = kindsOf([KOLU, ODU], [KOLU, ODU])
  expect([...table.built.keys()]).toEqual(["kolu-terminal", "odu-worktree"])
  // ...and the entry says the composed word too, so a reader that took the
  // ENTRY rather than the key gets one answer rather than the bare one.
  expect(table.built.get("kolu-terminal")?.kind).toBe("kolu-terminal")
})

test("...and the KEY it claims by convention is that same word, exactly", () => {
  // THE HUMAN'S RULING, as an equality rather than a sentence: an enabled plugin
  // auto-declares one key and it carries the plugin's name. There is no
  // arrangement of manifests under which enabling kolu declares `terminal`.
  const table = kindsOf([KOLU, ODU], [KOLU, ODU])
  for (const [word, entry] of table.built) expect([word, entry.claims]).toEqual([word, word])
})

test("BUILT is every plugin's word and ENABLED is only this serve's", () => {
  // The distance between the two IS `--plugins`: a vault declaring
  // `kolu-terminal` on a serve running only odu has written a legal row —
  // refusing it would make one file broken on one machine and clean on the next,
  // off a flag the file cannot see — while its VALUES are plain text, because
  // `admits` is a promise only a plugin that is here can make. It is also why a
  // disabled plugin's CLAIM vanishes: the fold rides `enabled`.
  const table = kindsOf([KOLU, ODU], [ODU])
  expect([...table.built.keys()]).toEqual(["kolu-terminal", "odu-worktree"])
  expect([...table.enabled.keys()]).toEqual(["odu-worktree"])
})

test("a serve with no plugins composes an empty vocabulary rather than a special state", () => {
  const table = kindsOf([KOLU, ODU], [])
  expect([...table.built.keys()]).toEqual(["kolu-terminal", "odu-worktree"])
  expect(table.enabled.size).toBe(0)
})

test("a plugin that teaches no word contributes nothing, which is a whole plugin", () => {
  expect(kindsOf([{ name: "quiet" }], [{ name: "quiet" }]).built.size).toBe(0)
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

test("...so the only reachable collision is one NAME twice, and it is a throw naming both", () => {
  // With the halves fenced, two DIFFERENT plugin names cannot compose to one
  // word — that is what injective means, and it is the claim the case above
  // establishes. What is left is two entries filed under one name, which the
  // assembly must not resolve silently: the underlying `Map.set` would let one
  // plugin's `admits` judge the other's values with nothing red anywhere.
  const twin = { name: "kolu", kinds: [kind("terminal")] }
  expect(() => kindsOf([KOLU, twin], [])).toThrow(/"kolu" and "kolu"/)
  expect(() => kindsOf([KOLU, twin], [])).toThrow(/kolu-terminal/)
  // ...and a plugin that contributes one word twice is the same clash reached
  // from the other side, which is the reachable half on a well-formed registry.
  const twice = { name: "odu", kinds: [kind("worktree"), kind("worktree")] }
  expect(() => kindsOf([twice], [])).toThrow(/odu-worktree/)
  // A REGISTRY WITH A BAD SEGMENT NEVER GETS AS FAR AS THE COUNT, which is the
  // difference between the two cases: the composition refuses first, at the
  // half its author can fix.
  const hyphenated = { name: "ab-c", kinds: [kind("d")] }
  expect(() => kindsOf([hyphenated], [])).toThrow(/carries "-"/)
})

/**
 * THE TWO SPELLINGS OF ONE COMPOSITION, held equal.
 *
 * A plugin cannot import this package — the registry imports every plugin, and
 * a dependency back is a cycle the manifests could not express — so each spells
 * its own composed word from its own `name` for its own vault walk
 * (`plugin-kolu`'s `TERMINAL_TYPE`, `plugin-odu`'s `WORKTREE_TYPE`). This is
 * where the two are held to one answer, and it is the same trade every other
 * structural agreement across that wall makes.
 *
 * It reads the REAL registry rather than the fixtures above, because the
 * fixtures cannot drift and the real plugins can.
 */
test("a plugin's own composed word is the one the registry composes", () => {
  const composed = kindsOf(
    [{ name: "kolu", kinds: koluKinds }, { name: "odu", kinds: oduKinds }],
    [],
  )
  const expected = WIRES.flatMap((wire) =>
    (wire.name === "kolu" ? koluKinds : oduKinds).map((one) => kindWordOf(wire.name, one.kind))
  )
  expect([...composed.built.keys()].sort()).toEqual([...expected].sort())
  // Not vacuous: both plugins teach a word, so the walk above compared
  // something.
  expect(expected.length).toBe(2)
  // ...and each plugin's own constant is on that list, which is the half a
  // fixture cannot check — `takes` is written with it, and so is the walk that
  // finds the keys a vault declared.
  for (const entry of [...composed.built.values()]) {
    expect(entry.takes, entry.kind).toContain(entry.kind)
  }
})
