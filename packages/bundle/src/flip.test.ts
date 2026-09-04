/**
 * A ROW TURNED OFF AND BACK ON WHILE THE PROCESS RUNS — the loader surface's
 * one mechanism, benched where its two halves meet.
 *
 * ## What is actually being asked
 *
 * Not "does the fiber stop", which Cordis has always done. The phase's claim is
 * about the ROWS AROUND IT: a row stands behind a door, every row that names
 * that door is held on it, and turning the first one off has to unload the
 * others — naming the tag they are short of — and turning it back on has to
 * bring them back and re-run their work. That is the reactive half of the paper
 * being the reason this is one verb rather than a restart, and this file is
 * where the claim is benched rather than argued.
 *
 * The pair below is `./settle.test.ts`'s, deliberately: one row provides a toy
 * door, the other names it and writes a line from inside its `apply`. The line
 * is what makes "it came back" checkable — a state can be read off a fiber a
 * beat early and look right, and a second line in the list cannot.
 *
 * ## THE FILE IS THE OTHER SUBJECT
 *
 * A flip is session-only by ruling (the human, 2026-09-04): it writes nothing,
 * and a restart comes back to `olai.yml`, the flag or nix. That is not a
 * property anybody can see by reading `setRow`, because the thing that would
 * break it is upstream's — `EntryTree.update` writes the tree, and the loader
 * writes the tree again when it sees a dispose it did not cause. Both are one
 * call away from the code under test. So the bytes on disk are read before and
 * after, and compared.
 *
 * ## Why a temp bundle
 *
 * `./settle.test.ts`'s reason, unchanged: this build's own rows dial real
 * daemons, so a suite that mounted them would depend on which machine it ran on.
 * Two toy rows in a temp file, and a resolver that answers with plugins rather
 * than with modules on a disk — the same seam `./bundle.ts` fills with a real
 * `import()`.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// THE TWO VERBS THE PLUGIN DOOR WITHHOLDS, and the loader's own — see
// `./bundle.ts`'s imports, which spend all three for real and say why each is
// where it is. A bench that stands a bundle up is standing where they are spent.
import { provide, settled } from "@olai/effect-cordis"
import { flipRow, mountRows } from "@olai/effect-cordis/loader"
import {
  definePlugin,
  type Host,
  openPlugins,
  type Plugin,
  rowReport,
  serviceTag,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

/** The key one toy row stands behind and the other names. */
const DOOR = serviceTag<{ readonly open: Effect.Effect<void> }>("aRowStandsBehindThis")

const UPSTAIRS = "upstairs"
const DOWNSTAIRS = "downstairs"

/** THE PAIR. No sleeps here, unlike the settle bench's: what that file was
 *  measuring was the gap between a mount and an apply, and what this one is
 *  about is what happens to the SECOND row when the first one leaves. The
 *  consumer writes a line each time it applies, and the number of lines is the
 *  claim. */
const pair = (host: Host, said: Array<string>): ReadonlyMap<string, Plugin> =>
  new Map([
    [UPSTAIRS, definePlugin({
      name: UPSTAIRS,
      needs: [],
      apply: provide(host, DOOR, () => ({
        open: Effect.sync(() => void said.push("the door was opened")),
      })),
    })],
    [DOWNSTAIRS, definePlugin({
      name: DOWNSTAIRS,
      needs: [DOOR],
      apply: Effect.flatMap(DOOR, (door) => door.open),
    })],
  ])

const BUNDLE = `- id: ${UPSTAIRS}\n  name: ${UPSTAIRS}\n- id: ${DOWNSTAIRS}\n  name: ${DOWNSTAIRS}\n`

/** One runtime with the toy bundle mounted and settled — the state every case
 *  below starts from, which is a serve that has finished booting. */
const booted = async (dir: string, said: Array<string>) => {
  writeFileSync(join(dir, "olai.yml"), BUNDLE)
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const rows = pair(opened.host, said)
  await run(mountRows(opened.host, {
    baseUrl: pathToFileURL(join(dir, "/")).href,
    path: "olai.yml",
    patches: [],
    resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
  }))
  await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))
  return { run, host: opened.host }
}

/** The two rows' states, as one value to assert about. */
const stateOf = (report: ReadonlyMap<string, { readonly state: string }>) => ({
  [UPSTAIRS]: report.get(UPSTAIRS)?.state,
  [DOWNSTAIRS]: report.get(DOWNSTAIRS)?.state,
})

/** A temp directory for one case, cleaned up whatever happens. */
const inADirectory = async (body: (dir: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "olai-flip-"))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * THE WHOLE OF THE PHASE, IN ONE CASE: the row that offers goes, and the row
 * that named its door goes with it — saying which door it is now short of.
 *
 * `waiting` and not `off` for the consumer is the load-bearing half. It was not
 * turned off; nobody asked anything of it. It is a fiber whose coeffect stopped
 * being satisfied, which is a state a person can act on ("compose the row that
 * offers this") and which the panel draws differently.
 */
test("turning a row off unloads the rows that named its door, naming the door", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)
    expect(said).toEqual(["the door was opened"])

    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(await run(flipRow(host, UPSTAIRS, true))).toBe(true)
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "off", [DOWNSTAIRS]: "waiting" })
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
    // ...and nothing ran a second time on the way down.
    expect(said).toEqual(["the door was opened"])
  })
})

/**
 * ...AND IT HAS ALREADY HAPPENED WHEN THE FLIP RETURNS, with no settle at all.
 *
 * ## The gap this is written from
 *
 * `Entry.update`'s disable arm is `this.fiber?.dispose(); return` — fired and
 * not awaited — so the `await` on it returns while the plugin's scope is still
 * unwinding. And Cordis takes the fiber out of the REGISTRY before it closes
 * that scope, so `settled` has nothing left to find and returns at once too.
 * Between them, a flip used to hand its caller a bundle mid-unwind and call it
 * settled.
 *
 * What that came to on the real bundle, measured: switch the chat row off, read
 * the offers table, and three of the four doors it stands behind are still
 * claimed — finalizers run LIFO, so the door offered LAST is released first and
 * the read lands after exactly that one. Fifty milliseconds later the table is
 * empty. Everything downstream believed the first reading: the engines drew
 * `running` on a serve with no chat in it, and the panel said one tenant was
 * waiting on one door when it was about to be waiting on two.
 *
 * ## Why the assertion is deliberately BEFORE the settle
 *
 * Because a settle would hide it. Every other case here calls `settled` after
 * the flip, which is what `setRow` does and is right; this one asks whether the
 * flip ALONE is honest about the row it just took away — which is the property
 * the settle cannot supply, since the fiber it would wait on is already gone.
 *
 * The consumer's state is the observable and not the provider's: a revoke awaits
 * the fibers that named the key, so `DOWNSTAIRS` being `waiting` is the whole
 * cascade having run rather than merely having started.
 */
test("the flip alone has finished unwinding the row it turned off", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    await run(flipRow(host, UPSTAIRS, true))

    // NO SETTLE HERE. This is the flip's own promise, kept.
    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
  })
})

/**
 * ...AND BACK, which is the half a dispose alone does not give.
 *
 * The SECOND LINE is the claim. Both rows reading `running` again would hold
 * against a runtime that had brought the fibers back without re-running the
 * consumer's `apply` — and re-applying is the whole of what "the dependents come
 * back" means, because everything a plugin does is installed by that Effect.
 */
test("turning it back on re-applies the rows that were waiting on it", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    await run(flipRow(host, UPSTAIRS, true))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    await run(flipRow(host, UPSTAIRS, false))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened", "the door was opened"])
  })
})

/**
 * THE RULING, HELD AS BYTES.
 *
 * A flip is session-only and writes nothing. Two things upstream would break
 * that and both are one call away from `flipRow`: `EntryTree.update` — the
 * tree-level verb, which the entry-level one is deliberately used instead of —
 * dumps the entry list back over the file, and the loader writes it again when
 * it reads a dispose as the plugin having turned ITSELF off. Neither is visible
 * in the code under test, so the file is the only honest assertion.
 *
 * BOTH DIRECTIONS, and after a settle: the include's own write is on a
 * `setTimeout(0)`, so a comparison taken synchronously after the flip would pass
 * against a version that writes.
 */
test("a flip writes nothing — the bundle file is byte-identical after both directions", async () => {
  await inADirectory(async (dir) => {
    const at = join(dir, "olai.yml")
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)

    await run(flipRow(host, UPSTAIRS, true))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)

    await run(flipRow(host, UPSTAIRS, false))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)
  })
})

/**
 * A NAME THIS BUILD DOES NOT HAVE IS ANSWERED, not thrown at.
 *
 * The panel walks the roster, so the only way to reach this is a reader that
 * outlived the build it was drawn from. What it is owed is a refusal it can
 * show, and what the rows are owed is that nothing moved — which is the second
 * assertion here and the reason this case is not just about the return value.
 */
test("a row this build does not have answers no, and moves nothing", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    expect(await run(flipRow(host, "no-such-row", true))).toBe(false)

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened"])
  })
})

/**
 * ...AND IT GOES AGAINST THE FLAG, which is the direction nobody would guess is
 * available and is the one a person actually wants.
 *
 * A row `--plugins` left out is a row the patch wrote `disabled` onto, and the
 * switch writes the SAME FIELD — the built-in default, the operator's overlay
 * and the press are one mechanism, which is what `pluginsPatch` has said since
 * the bundle became rows. So there is no state the panel can reach that a flag
 * could not have started you in, and none it cannot reach: a serve begun with
 * `--plugins=<one thing>` can have the rest back without stopping.
 *
 * WHAT MAKES IT WORTH A CASE OF ITS OWN is the second assertion. The consumer
 * did not start either — it was `waiting`, naming the door nobody was behind —
 * and nothing here presses anything on its behalf. Turning the PROVIDER on is
 * the whole of what brings it up, which is the reactive coeffect arriving at a
 * row that was never disabled at all.
 */
test("a row the flag left out can be switched on, and its dependants start", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    writeFileSync(join(dir, "olai.yml"), BUNDLE)
    const run = standing()
    const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
    const rows = pair(opened.host, said)
    // `--plugins=downstairs`: the consumer named, the provider left out. Both
    // directions of the patch, which is what the flag writes.
    await run(mountRows(opened.host, {
      baseUrl: pathToFileURL(join(dir, "/")).href,
      path: "olai.yml",
      patches: [{ id: UPSTAIRS, disabled: true }, { id: DOWNSTAIRS, disabled: false }],
      resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
    }))
    await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))

    const before = await run(rowReport(opened.host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(before)).toEqual({ [UPSTAIRS]: "off", [DOWNSTAIRS]: "waiting" })
    expect(said).toEqual([])

    expect(await run(flipRow(opened.host, UPSTAIRS, false))).toBe(true)
    await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))

    const after = await run(rowReport(opened.host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(after)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened"])
  })
})

/**
 * A HOST THAT MOUNTED NO BUNDLE HAS NO ROWS TO FLIP — the `mountPlugin` case,
 * which is every bench in this tree and every headless face.
 *
 * It is the same `false`, and deliberately: a fiber that is not a loader entry
 * is not a row, whatever it is called. Asserted because the alternative
 * implementation — reaching for the fiber by name — would happily turn one off
 * and then have no way to bring it back.
 */
test("a host with no bundle mounted has no row to flip", async () => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  expect(await run(flipRow(opened.host, UPSTAIRS, true))).toBe(false)
})
