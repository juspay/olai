/**
 * MOUNTING A BUNDLE RETURNS WHEN THE ROWS HAVE APPLIED — the fence for the whole
 * ordering answer, and the one claim in this package that is about a moment
 * rather than about a table.
 *
 * ## What was wrong, and how it was found
 *
 * `mountBundle`'s doc has always promised that a caller can read the kind and
 * surface registries on the next line and get the whole build. That promise was
 * kept by coincidence: `mountRows` awaits the include's entries being CREATED —
 * the module imported, the fiber constructed — and never awaits a fiber, because
 * `Entry.init`'s own `this.fiber?.await()` is deliberately not awaited. Every
 * row's `apply` in this build finished inside the mount's own microtask chain,
 * so every reading afterwards was accidentally right.
 *
 * It was found by measurement rather than by reading: two rows through
 * `mountRows` with one providing a key the other names, both applies
 * microtask-only, read `running` on return; one `Effect.sleep("5 millis")` in
 * the PROVIDER's apply and BOTH read `waiting`. So the macrotask in each toy
 * apply below is the subject of these cases and not decoration — take it out and
 * they pass against a `mountBundle` that waits for nothing.
 *
 * ## Why a temp bundle, and why the last case is not one
 *
 * The first two cases go through the LOADER, because what is being asked is
 * about the loader's own guarantee, and they cannot ask it of this build's rows:
 * those dial real daemons, and a suite that mounted them would be a suite that
 * depended on which machine it ran on. So they write two toy rows to a temp file
 * and hand `mountRows` a resolver that answers with plugins rather than with
 * modules on a disk — the same seam `./bundle.ts` fills with a real `import()`.
 *
 * The last case is about `mountBundle` ITSELF, which reads this package's own
 * `olai.yml` and can be pointed at nothing else. It runs it with `--plugins=`,
 * which disables every row — so no plugin of this build is imported, mounted or
 * dialed — and puts the provider/consumer pair on the registry by hand under two
 * row ids beforehand. What that leaves `mountBundle` to do is exactly the settle,
 * which is what the case is for.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// THE TWO VERBS THE PLUGIN DOOR WITHHOLDS, and the loader's own — see
// `./bundle.ts`'s imports, which spend all three for real and say why each is
// where it is. A bench that stands a bundle up is standing where they are spent.
import { provide, settled } from "@olai/effect-cordis"
import { mountRows } from "@olai/effect-cordis/loader"
import {
  definePlugin,
  type Host,
  mountPlugin,
  openPlugins,
  type Plugin,
  rowReport,
  serviceTag,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { mountBundle } from "./bundle.ts"
import { BUNDLE_NAMES } from "./rows.ts"

/** The key one toy row stands behind and the other names. A TOY, because the
 *  question is the ORDERING and not which olai service travels this way. */
const DOOR = serviceTag<{ readonly open: Effect.Effect<void> }>("aRowStandsBehindThis")

/** The two toy rows, by id. They are also the plugins' `name`s, which is what
 *  makes them the words the registry — and so `rowReport` — knows them by. */
const UPSTAIRS = "upstairs"
const DOWNSTAIRS = "downstairs"

/** THE PAIR, and every non-obvious thing about it is deliberate.
 *
 *  The PROVIDER sleeps before it provides, so the row that names its key is
 *  woken a macrotask after the mount was told about it; the CONSUMER sleeps
 *  after it is woken, so its own `apply` is unfinished at the moment a caller
 *  would read the registries. Those are the two shapes the probe found, and
 *  either alone leaves a row `waiting` on return from a mount that does not
 *  settle.
 *
 *  `host` is a parameter because a plugin cannot provide anything — that door is
 *  `@olai/plugin-api`'s to open and not this file's to invent. What the pair is
 *  standing in for is a ROW that provides, and the bridge's own verb is the
 *  honest way to say so from outside a plugin. */
const pair = (host: Host, said: Array<string>): ReadonlyMap<string, Plugin> =>
  new Map([
    [UPSTAIRS, definePlugin({
      name: UPSTAIRS,
      needs: [],
      apply: Effect.gen(function*() {
        yield* Effect.sleep("5 millis")
        yield* provide(host, DOOR, () => ({
          open: Effect.sync(() => void said.push("the door was opened")),
        }))
      }),
    })],
    [DOWNSTAIRS, definePlugin({
      name: DOWNSTAIRS,
      needs: [DOOR],
      apply: Effect.gen(function*() {
        const door = yield* DOOR
        yield* Effect.sleep("5 millis")
        yield* door.open
      }),
    })],
  ])

/** A BUNDLE FILE with those two rows in it, in a directory of its own. The
 *  module specifiers are the ids, because the resolver below is a lookup in the
 *  pair rather than an `import()` — a row's `name` is a string until somebody
 *  resolves it, which is the whole reason that seam is a parameter. */
const bundleAt = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-settle-"))
  writeFileSync(
    join(dir, "olai.yml"),
    `- id: ${UPSTAIRS}\n  name: ${UPSTAIRS}\n- id: ${DOWNSTAIRS}\n  name: ${DOWNSTAIRS}\n`,
  )
  return dir
}

/** One runtime with the toy bundle's rows mounted on it, stopping short of the
 *  settle — which is what the two cases below differ by. */
const loaded = async (dir: string, said: Array<string>) => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const rows = pair(opened.host, said)
  await run(mountRows(opened.host, {
    baseUrl: pathToFileURL(join(dir, "/")).href,
    path: "olai.yml",
    patches: [],
    resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
  }))
  return { run, host: opened.host }
}

/**
 * THE FINDING, HELD AS A CLAIM so the settle cannot be quietly taken back out.
 *
 * This is what `mountBundle` did for two phases. It is asserted rather than
 * described because a comment saying "the mount does not wait" is a sentence
 * somebody deletes when a refactor makes it look untrue for a week.
 */
test("mounting the rows alone leaves a row waiting on its sibling still applying", async () => {
  const dir = bundleAt()
  try {
    const said: Array<string> = []
    const { run, host } = await loaded(dir, said)
    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    // BOTH of them, which is the measured shape: the provider has not finished
    // starting, and the row that names its key can say exactly which key it is
    // still short of.
    expect(report.get(UPSTAIRS)).toEqual({ state: "waiting" })
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
    expect(said).toEqual([])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * ...AND THE SETTLE IS WHAT MAKES THE SENTENCE TRUE.
 *
 * Both rows `running` and the consumer's work DONE, which is the stronger half:
 * a state can be read off a fiber a beat early and look right, but a line the
 * consumer writes from inside its `apply` is either there or it is not.
 */
test("every row is running, and has applied, once the mount has settled", async () => {
  const dir = bundleAt()
  try {
    const said: Array<string> = []
    const { run, host } = await loaded(dir, said)
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(report.get(UPSTAIRS)).toEqual({ state: "running" })
    expect(report.get(DOWNSTAIRS)).toEqual({ state: "running" })
    expect(said).toEqual(["the door was opened"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * ...AND `mountBundle` IS BOTH HALVES, which is the claim a composition root
 * actually rests on.
 *
 * The two above would hold against a `mountBundle` that had never learned to
 * settle, because they call the two halves themselves. This one calls the door
 * `@olai/server` calls and asks the same question of it.
 *
 * THE SLEEP IS LONG on purpose. `mountBundle` reads a file, mounts two loader
 * plugins and parses YAML before it settles anything, so a five-millisecond
 * consumer would be finished by then whether or not anybody waited for it — and
 * the case would pass on a mount that waits for nothing. What is being asked is
 * whether the call WAITS, so the thing it must wait for has to outlast
 * everything else the call does.
 */
test("mountBundle returns with a row's sibling-woken apply already finished", async () => {
  const [first, second] = BUNDLE_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this suite needs a build with two rows")
  }
  const said: Array<string> = []
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: second,
      needs: [DOOR],
      apply: Effect.gen(function*() {
        const door = yield* DOOR
        yield* Effect.sleep("100 millis")
        yield* door.open
      }),
    }),
  ))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: first,
      needs: [],
      apply: provide(opened.host, DOOR, () => ({
        open: Effect.sync(() => void said.push("the door was opened")),
      })),
    }),
  ))
  // The provider's own mount is awaited and says nothing about the row it woke.
  expect(said).toEqual([])

  // ...AND `--plugins=` MOUNTS NONE OF THIS BUILD'S ROWS, so what is left for
  // this call to do is the settle, over the two rows already on the registry.
  await run(mountBundle(opened.host, []))
  expect(said).toEqual(["the door was opened"])
  const report = await run(rowReport(opened.host, [first, second]))
  expect(report.get(second)).toEqual({ state: "running" })
})
