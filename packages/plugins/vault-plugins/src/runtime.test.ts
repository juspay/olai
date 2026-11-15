/**
 * A PLUGIN NOBODY COMPILED IN, all the way through — written into a vault as
 * three files, pending, turned on, mounted, edited, switched off.
 *
 * The one bench in this tree where a fiber comes from text: the plugin is a
 * folder, the halves are files in it, the consent is a node in the settings
 * file, and what comes out the far end is a plugin in the same registry the
 * bundle's rows are in. Everything this lane claims is checkable here except
 * the two ends that need a browser — the chunk being FETCHED and the chip being
 * DRAWN — and the chunk's text is asserted because that is what the tab is
 * handed.
 */
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import type { WriteRequest } from "@olai/format"
import { readingOfVault } from "@olai/format/testlib/scope"
import {
  Agents,
  definePlugin,
  type Host,
  mountPlugin,
  Offers,

  rowReport,
} from "@olai/plugin-api/services"
import { REGISTRY, SERVER_MODULES } from "@olai/plugin-build/shared"
import type { BuiltPlugin } from "@olai/surface"
import { describe, expect, test } from "bun:test"
import { Effect, Option, Stream } from "effect"

import { type DynamicRuntime, openDynamic, wordsOf } from "./runtime.ts"
import { ALWAYS, definedIn, versionOf } from "./source.ts"

/** A plugin that mounts and registers nothing — the smallest whole server half,
 *  and the shape `vault-plugins_guide` tells an agent to write. */
const SERVER = [
  `import { definePlugin } from "@olai/plugin-api"`,
  `import { Effect, Option, Stream } from "effect"`,
  `export default definePlugin({`,
  `  name: "swatch",`,
  `  needs: [],`,
  `  apply: Effect.void,`,
  `})`,
].join("\n")

/** ...and a face for it, which is what makes the chunk exist. */
const BROWSER = [
  `import { createSignal } from "solid-js"`,
  `export const Chip = () => {`,
  `  const [n] = createSignal(1)`,
  `  return <span class="chip">{n()}</span>`,
  `}`,
].join("\n")

/**
 * THE VAULT, as the three files and the one settings node.
 *
 * `approved` and `on` are two words on a node in `_olai/Settings.olai`, which
 * is where every row this build shipped already keeps its own — so a case that
 * wants a plugin RUNNING says both, and a case that leaves them out is a folder
 * somebody copied in, which is off and unapproved by construction.
 */
const vault = (options: {
  readonly server?: string
  readonly browser?: string | null
  readonly readme?: string
  readonly approved?: string | null
  readonly on?: boolean
  readonly props?: Record<string, string>
  readonly word?: string
}) => {
  const word = options.word ?? "swatch"
  const files = new Map<string, string>([[`plugins/${word}/server.ts`, options.server ?? SERVER]])
  if (options.browser != null) files.set(`plugins/${word}/browser.tsx`, options.browser)
  if (options.readme !== undefined) files.set(`plugins/${word}/README.md`, options.readme)
  // THE SETTINGS ROW EXISTS even when it says nothing, because that is the
  // ordinary state of a vault somebody has opened the settings file in: the
  // node is there and the words a person has not said yet are absent from it.
  // A folder with NO row at all is its own case, and it is written out by hand
  // where it is the subject.
  const custom = {
    ...(options.approved == null ? {} : { approved: options.approved }),
    ...(options.on === false ? { on: "no" } : options.approved == null && options.on !== true ? {} : { on: "yes" }),
    ...options.props,
  }
  files.set("_olai/Settings.olai", `{"id":"c","ord":"a0","title":"${word}","custom":${JSON.stringify(custom)}}`)
  return readingOfVault(files)
}

/** A vault with the plugin's folder gone — what deleting it looks like, which
 *  is the retraction a folder has. */
const nothing = () => readingOfVault(new Map([["notes.md", "# notes\n"]]))

/**
 * ONE RUNTIME OVER A HOST OF ITS OWN, for the length of one bench — and the
 * rows READ THE WAY A SERVE READS THEM.
 *
 * `rows()` takes the report rather than remembering one, so `now()` is the
 * composition root's re-read spelled for one host: `rowReport` over whatever
 * words the vault currently defines. That is not a convenience here, it is the
 * subject — the state a plugin's row wears comes off the live registry, and a
 * bench that passed a map it had built itself would be asserting against its
 * own memory of what the fiber was doing.
 *
 * `written` is every write the runtime made, because consent is a WRITE now:
 * the switch and the approval do not move a fiber, they move a file, and a
 * bench that could not see the file would be asserting about neither.
 */
const bench = <A, E>(
  use: (
    dynamic: DynamicRuntime,
    now: () => Effect.Effect<ReadonlyArray<BuiltPlugin>>,
    host: Host,
    written: ReadonlyArray<WriteRequest>,
  ) => Effect.Effect<A, E>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* openPlugins({
        vars: {},
        now: () => "2026-09-05T00:00:00.000Z",
        served: "/nowhere",
      })
      const written: Array<WriteRequest> = []
      // NO BUILT WORDS: this bench's build has no rows, so nothing is taken and
      // the plugin may have any word it likes.
      const dynamic = openDynamic(
        { mount: (plugin, config) => mountPlugin(plugins.host, plugin, { wait: false, config }) },
        [],
        request => Effect.sync(() => { written.push(request) }),
      )
      // A REFUSAL IS A FAILED CASE, not a value to assert about by accident:
      // the consent verbs write, so they can fail, and a bench that swallowed
      // one would pass having written nothing.
      return yield* Effect.orDie(use(
        dynamic,
        () => plugins.changes.pipe(
          Stream.mapEffect(() => rowReport(plugins.host, dynamic.names())),
          // Follow returns a stop handle during initialization. These assertions
          // read once that work settles; missing dependencies remain waiting.
          Stream.filter((report) => ![...report.values()].some((row) => row.state === "waiting" && row.missing === undefined)),
          Stream.take(1),
          Stream.runHead,
          Effect.map((report) => dynamic.rows(Option.getOrThrow(report))),
        ),
        plugins.host,
        written,
      ))
    })),
  )

/**
 * THE TABLE AND THE LIST HAVE TO AGREE, and nothing but this says so.
 *
 * `@olai/plugin-build` names the specifiers it will BIND; this module fills the
 * table those bindings read. They are two lists on one clock — a fourth module
 * added to one is a plugin destructuring `undefined` at its first line — and
 * they cannot be one list, because the table's values are static imports and the
 * compiler package must not have any of the three on its graph.
 *
 * So: an equality, at the one end that holds both. `@olai/web`'s own entry keeps
 * the browser half of the same promise (`client/plugins/shared.test.ts`).
 */
test("this process binds every module the compiler says a server half may name", () => {
  const table = (globalThis as Record<string, unknown>)[REGISTRY] as Record<string, unknown>
  expect(Object.keys(table).sort()).toEqual([...SERVER_MODULES].sort())
  for (const name of SERVER_MODULES) expect(table[name]).toBeDefined()
})

describe("a plugin waits for a person", () => {
  test("nobody has turned it on: pending, and nothing has been imported", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ readme: "# Hex swatch\n\nA colour swatch beside any hex colour.\n" }))
        return yield* now()
      })
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe("swatch")
    expect(rows[0]?.running).toBe(false)
    expect(rows[0]?.state).toBe("pending")
    // The SOURCE travels, because approving is reading — and so do the words a
    // person reads before they get to it.
    expect(rows[0]?.source?.server).toBe(SERVER)
    expect(rows[0]?.source?.title).toBe("Hex swatch")
    expect(rows[0]?.source?.description).toBe("A colour swatch beside any hex colour.")
    expect(rows[0]?.source?.folder).toBe("plugins/swatch/")
    expect(rows[0]?.source?.approved).toBe(false)
    expect(rows[0]?.source?.on).toBe(false)
    // ...and no chunk, because nothing was built.
    expect(rows[0]?.source?.chunk).toBeUndefined()
  })

  test("approved at this version and on: it mounts, and it is a row like any other", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: versionOf(SERVER, null) }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("running")
    expect(rows[0]?.running).toBe(true)
  })

  test("approved but switched off is off, and says so without asking again", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS, on: false }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("switched")
    expect(rows[0]?.source?.approved).toBe(true)
  })

  test("an edit after an approval is pending again, and the switch stays up", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({ approved }))
        yield* dynamic.follow(vault({ approved, server: `${SERVER}\n// and more` }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("pending")
    expect(rows[0]?.running).toBe(false)
    // PAUSED, which is two facts: the person still wants it, and what it would
    // run is not what they read.
    expect(rows[0]?.source?.on).toBe(true)
  })

  test("the paused row carries the approved halves, so the page can draw a diff", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({ approved }))
        yield* dynamic.follow(vault({ approved, server: `${SERVER}\n// and more` }))
        return yield* now()
      })
    )
    expect(rows[0]?.source?.approvedServer).toBe(SERVER)
    expect(rows[0]?.source?.server).toContain("// and more")
  })

  test("a row nobody has edited carries its source once", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        return yield* now()
      })
    )
    expect(rows[0]?.source?.approvedServer).toBeUndefined()
    expect(rows[0]?.source?.approvedBrowser).toBeUndefined()
  })

  test("a README edit is not a fresh decision", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({ approved, readme: "# A\n\nOne.\n" }))
        yield* dynamic.follow(vault({ approved, readme: "# A\n\nSomething else entirely.\n" }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("running")
    expect(rows[0]?.source?.description).toBe("Something else entirely.")
  })
})

/**
 * A ROW'S WORD IS ITS FIBER'S, AT THE MOMENT IT IS ASKED — the bench for the
 * defect that made `rows` take the report rather than remember one.
 *
 * The state used to be read once, when the mount returned, and stored on the
 * live entry. That is a second clock, and it was wrong in both directions the
 * moment a fiber moved afterwards. This is the case that matters: a plugin that
 * NAMES a door nobody is behind mounts `waiting` — legitimately, and the
 * runtime's reactive half will wake it — and when something stands behind that
 * door the fiber goes ACTIVE with nothing about the plugin having changed. With
 * a remembered report the row went on saying `waiting` with `running: false`,
 * so the tab never loaded the chunk of a plugin that was serving.
 */
describe("a row's word follows its fiber, not the mount", () => {
  /** A half that names a door this bench does not provide — so it mounts and
   *  waits, which is a legitimate resting state and not a fault. */
  const NEEDS_A_DOOR = [
    `import { Agents, definePlugin } from "@olai/plugin-api"`,
    `import { Effect, Option, Stream } from "effect"`,
    `export default definePlugin({`,
    `  name: "swatch",`,
    `  needs: [Agents],`,
    `  apply: Effect.void,`,
    `})`,
  ].join("\n")

  test("waiting on a door, then running when somebody stands behind it", async () => {
    const said = await bench((dynamic, now, host) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS, server: NEEDS_A_DOOR }))
        const waiting = (yield* now())[0]
        // NOBODY FOLLOWS ANYTHING between these two readings. The only thing
        // that happens is another plugin offering the door — which is a flip on
        // a real serve — and the plugin's fiber wakes on its own.
        yield* mountPlugin(
          host,
          definePlugin({
            name: "a-door",
            needs: [Offers],
            apply: Effect.gen(function*() {
              const offers = yield* Offers
              yield* offers.offer(Agents, () => ({ register: () => Effect.void }))
            }),
          }),
        )
        return { waiting, running: (yield* now())[0] }
      })
    )
    expect(said.waiting?.state).toBe("waiting")
    expect(said.waiting?.running).toBe(false)
    expect(said.waiting?.missing).toEqual(["agents"])
    expect(said.running?.state).toBe("running")
    expect(said.running?.running).toBe(true)
  })
})

describe("a browser half is compiled and served", () => {
  test("the chunk is bound to the host's own modules, and named by the version", async () => {
    const { rows, chunk } = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ browser: BROWSER, approved: ALWAYS }))
        const rows = yield* now()
        return { rows, chunk: dynamic.chunk(rows[0]?.source?.chunk ?? "") }
      })
    )
    expect(rows[0]?.running).toBe(true)
    expect(rows[0]?.source?.chunk).toBe(
      `/_olai/plugins/swatch-${versionOf(SERVER, BROWSER)}.js`,
    )
    // WHAT THE TAB IS HANDED: a module with no imports left in it, reading this
    // app's Solid off the table the entry filled. A second Solid here is the
    // failure the whole binding exists to prevent.
    expect(chunk).toContain(REGISTRY)
    expect(chunk).toContain(`["solid-js"]`)
    expect(chunk).not.toMatch(/^\s*import\s/m)
  })

  test("a path nothing is serving is nothing", async () => {
    const said = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ browser: BROWSER, approved: ALWAYS }))
        return dynamic.chunk("/_olai/plugins/swatch-deadbeef.js")
      })
    )
    expect(said).toBeNull()
  })
})

/**
 * WHAT `follow` ANSWERS is what makes the roster move, and a row that changed
 * with nothing to answer reached nobody.
 *
 * The composition root re-composes — which is what republishes the `plugins`
 * cell, which is what an open tab redials on — only when this says something
 * moved. So "moved" has to mean *the rows this runtime draws are not the rows it
 * drew*, and it used to mean *a fiber moved*: the first thing that happens in
 * the whole lane, an agent writing a plugin nobody has approved, moved no fiber
 * and so reached the panel of an open tab never.
 */
describe("a revision that changes what the rows say is a movement", () => {
  test("a plugin arriving, and being turned on, and then saying nothing new", async () => {
    const said = await bench((dynamic) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        const arrived = yield* dynamic.follow(vault({}))
        const turnedOn = yield* dynamic.follow(vault({ approved }))
        const again = yield* dynamic.follow(vault({ approved }))
        return { arrived, turnedOn, again }
      })
    )
    expect(said.arrived).toBe(true)
    expect(said.turnedOn).toBe(true)
    // ...and a revision that touched some other file says so, so a keystroke
    // elsewhere does not redial every tab.
    expect(said.again).toBe(false)
  })

  test("a README edit reaches an open page even though no fiber moved", async () => {
    const moved = await bench((dynamic) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({ approved, readme: "# A\n\nOne.\n" }))
        return yield* dynamic.follow(vault({ approved, readme: "# A\n\nTwo.\n" }))
      })
    )
    expect(moved).toBe(true)
  })

  /**
   * A PLUGIN THAT WILL NOT BUILD IS TRIED ONCE PER VERSION.
   *
   * The failed arm carried no version, so `follow` had nothing to compare it
   * against and ran the Solid transform again on every revision — every
   * keystroke anywhere in the vault paying for one broken `browser.tsx`, for as
   * long as it stayed broken. The version is on both arms now, so a failure is
   * remembered exactly as a mount is.
   */
  test("a broken plugin is compiled once, not once per revision", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const broken = { server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }
        const first = yield* dynamic.follow(vault(broken))
        const second = yield* dynamic.follow(vault(broken))
        return { first, second, rows: yield* now() }
      })
    )
    expect(said.first).toBe(true)
    // NOTHING MOVED, which is the assertion: an unchanged broken plugin is
    // skipped rather than rebuilt, and the row goes on saying what it said.
    expect(said.second).toBe(false)
    expect(said.rows[0]?.state).toBe("failed")
    expect(said.rows[0]?.fault).toContain(`"left-pad"`)
  })

  test("...and is tried again the moment its source moves", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }),
        )
        // Fixed, and approved for every version, so the next follow builds it.
        const fixed = yield* dynamic.follow(vault({ approved: ALWAYS }))
        return { fixed, rows: yield* now() }
      })
    )
    expect(said.fixed).toBe(true)
    expect(said.rows[0]?.state).toBe("running")
  })
})

describe("what goes wrong lands on the row, with a sentence", () => {
  test("a module olai does not bind is refused by name", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }),
        )
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain(`"left-pad"`)
  })

  test("a half with no plugin in it says what to write instead", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ server: `export const nothing = 1`, approved: ALWAYS }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain("definePlugin")
  })

  test("a half that calls itself something else may not sign another word", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: SERVER.replace(`"swatch"`, `"kolu"`), approved: ALWAYS }),
        )
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain(`calls itself "kolu"`)
    expect(rows[0]?.fault).toContain("plugins/swatch/")
  })

  test("an `apply` that throws is the RUNTIME's containment, and it is quoted", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({
            approved: ALWAYS,
            server: SERVER.replace(
              `apply: Effect.void,`,
              `apply: Effect.sync(() => { throw new Error("the socket is gone") }),`,
            ),
          }),
        )
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain("the socket is gone")
  })
})

describe("consent is written down, so it survives a restart", () => {
  test("the switch writes `on`, and the row follows the file rather than this process", async () => {
    const said = await bench((dynamic, now, _host, written) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        const found = yield* dynamic.set("swatch", false)
        // THE WRITE IS THE ACT. Nothing moves until the revision it publishes
        // comes back round, which is what a real serve does and what a bench
        // that flipped a boolean in memory would have hidden.
        const wrote = [...written]
        yield* dynamic.follow(vault({ approved: ALWAYS, on: false }))
        const off = (yield* now())[0]?.state
        yield* dynamic.follow(vault({ approved: ALWAYS, on: true }))
        return { found, wrote, off, on: (yield* now())[0]?.state }
      })
    )
    expect(said.found).toBe(true)
    expect(said.wrote).toEqual([{ op: "prop", id: "c", key: "on", value: "no" }])
    expect(said.off).toBe("switched")
    expect(said.on).toBe("running")
  })

  test("turning it on is approving this version AND the switch, in one write", async () => {
    const written = await bench((dynamic, _now, _host, written) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({}))
        yield* dynamic.approve("swatch", false)
        return [...written]
      })
    )
    expect(written).toEqual([{
      op: "apply",
      ops: [
        { op: "prop", id: "c", key: "approved", value: versionOf(SERVER, null) },
        { op: "prop", id: "c", key: "on", value: "yes" },
      ],
    }])
  })

  test("always trusting changes writes the word rather than a version", async () => {
    const written = await bench((dynamic, _now, _host, written) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({}))
        yield* dynamic.approve("swatch", true)
        return [...written]
      })
    )
    expect(written[0]).toMatchObject({
      op: "apply",
      ops: [{ op: "prop", id: "c", key: "approved", value: ALWAYS }, { op: "prop", id: "c", key: "on", value: "yes" }],
    })
  })

  test("a folder with no settings node yet is given one, holding exactly this", async () => {
    const written = await bench((dynamic, _now, _host, written) =>
      Effect.gen(function*() {
        // No consent anywhere: a folder somebody copied in from another vault.
        yield* dynamic.follow(readingOfVault(new Map([["plugins/swatch/server.ts", SERVER]])))
        yield* dynamic.approve("swatch", true)
        return [...written]
      })
    )
    expect(written[0]).toEqual({
      op: "create",
      file: "_olai/Settings.olai",
      seed: { title: "swatch", props: { approved: ALWAYS, on: "yes" } },
    })
  })

  test("a word this vault does not define is not this door's to flip", async () => {
    const found = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        return yield* dynamic.set("kolu", false)
      })
    )
    expect(found).toBe(false)
  })

  test("the conversation building it is bound on the same node", async () => {
    const written = await bench((dynamic, _now, _host, written) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({}))
        yield* dynamic.bind("swatch", "chat-7")
        return [...written]
      })
    )
    expect(written).toEqual([{ op: "prop", id: "c", key: "builder", value: "chat-7" }])
  })
})

describe("a folder that goes away takes its fiber with it", () => {
  test("the row is gone and nothing is left mounted", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        yield* dynamic.follow(nothing())
        return yield* now()
      })
    )
    expect(rows).toEqual([])
  })

  test("a folder that comes back is off and unapproved, whatever it was called before", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        yield* dynamic.follow(nothing())
        yield* dynamic.follow(readingOfVault(new Map([["plugins/swatch/server.ts", SERVER]])))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("pending")
    expect(rows[0]?.source?.on).toBe(false)
    // ...and no diff against a predecessor nobody approved: the copy left with
    // the folder.
    expect(rows[0]?.source?.approvedServer).toBeUndefined()
  })
})

test("a plugin's initializer that waits forever can be stopped", async () => {
  const server = [
    `import { definePlugin, Kinds } from "@olai/plugin-api"`,
    `import { Effect } from "effect"`,
    `export default definePlugin({ name: "swatch", needs: [Kinds], apply: Effect.gen(function*() {`,
    `  yield* (yield* Kinds).register({ kind: "held", takes: "text", admits: () => true })`,
    `  yield* Effect.never`,
    `}) })`,
  ].join("\n")
  const state = await bench((dynamic, now) => Effect.gen(function*() {
    yield* dynamic.follow(vault({ server, approved: ALWAYS }))
    expect(yield* dynamic.set("swatch", false)).toBe(true)
    yield* dynamic.follow(vault({ server, approved: ALWAYS, on: false }))
    return (yield* now())[0]?.state
  }))
  expect(state).toBe("switched")
})

test("a plugin receives its own schema knobs and edits preserve its approval", () => bench((dynamic, now) => Effect.gen(function*() {
  const server = `import { definePlugin } from "@olai/plugin-api";
    import { Effect, Schema } from "effect";
    const Config = Schema.Struct({ tone: Schema.String.pipe(
      Schema.withDecodingDefaultKey(Effect.succeed("blue")),
      Schema.annotate({ description: "the swatch tone" })) });
    export default definePlugin({ name: "swatch", needs: [], config: Config,
      apply: (config) => config.tone === "blue" ? Effect.void : Effect.die(new Error("tone=" + config.tone)) });`
  const approved = versionOf(server, null)
  yield* dynamic.follow(vault({ server, approved }))
  expect((yield* now())[0]).toMatchObject({ state: "running", configurationValues: [{ key: "tone", value: "blue", setBy: "default" }] })
  yield* dynamic.follow(vault({ server, approved, props: { tone: "red" } }))
  expect((yield* now())[0]).toMatchObject({ state: "failed", source: { approved: true, version: approved } })
  expect((yield* now())[0]?.fault).toContain("tone=red")
  yield* dynamic.follow(vault({ server, approved, props: { tone: "blue" } }))
  expect((yield* now())[0]).toMatchObject({ state: "running", configurationValues: [{ key: "tone", value: "blue", setBy: "vault" }] })
})))

for (const key of ["approved", "on", "builder"]) {
  test(`a plugin cannot declare the reserved ${key} property as configuration`, () => bench((dynamic, now) => Effect.gen(function*() {
    const server = `import { definePlugin } from "@olai/plugin-api";
      import { Effect, Schema } from "effect";
      export default definePlugin({ name: "swatch", needs: [],
        config: Schema.Struct({ ${key}: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))) }),
        apply: () => Effect.void });`
    yield* dynamic.follow(vault({ server, approved: ALWAYS }))
    const row = (yield* now())[0]
    expect(row?.state).toBe("failed")
    expect(row?.fault).toContain(key)
    expect(row?.fault).toContain("reserved")
  })))
}

test("row metadata preserves field boundaries across delimiter-like text", () => {
  const base = definedIn(vault({}), [])[0]!
  for (const separator of ["\n", "\\0"]) {
    const before = { ...base, approved: `pending${separator}fragment`, fault: "tail" }
    const after = { ...base, approved: "pending", fault: `fragment${separator}tail` }
    expect(wordsOf([before])).not.toBe(wordsOf([after]))
    expect(wordsOf([before])).toBe(wordsOf([{ ...before }]))
  }
})

test("configure edits the settings node and refuses its reserved keys before writing", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  const server = `import { definePlugin } from "@olai/plugin-api"; import { Effect, Schema } from "effect";
    export default definePlugin({ name: "swatch", needs: [], config: Schema.Struct({ tone: Schema.Literals(["blue", "red"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed("blue")), Schema.annotate({ description: "the tone" })) }), apply: () => Effect.void });`
  yield* dynamic.follow(vault({ server, approved: ALWAYS }))
  expect(yield* Effect.orDie(dynamic.configure("swatch", "tone", "red"))).toBe(true)
  expect(written).toEqual([{ op: "prop", id: "c", key: "tone", value: "red" }])
  for (const key of ["approved", "on", "builder"]) {
    const refused = yield* Effect.orDie(Effect.flip(dynamic.configure("swatch", key, "anything")))
    expect(refused.message).toContain("reserved")
  }
  expect((yield* Effect.orDie(Effect.flip(dynamic.configure("swatch", "tone", "green")))).message).toContain("blue")
  expect(written).toHaveLength(1)
  yield* Effect.orDie(dynamic.configure("swatch", "tone", null))
  expect(written[1]).toEqual({ op: "prop", id: "c", key: "tone", value: null })
})))
