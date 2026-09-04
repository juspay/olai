/**
 * A PLUGIN NOBODY COMPILED IN, all the way through — written into a vault,
 * pending, approved, mounted, edited, switched off.
 *
 * The one bench in this tree where a fiber comes from text: the definition is
 * outline records, the halves are notes, and what comes out the far end is a
 * plugin in the same registry the bundle's rows are in. Everything the phase
 * claims is checkable here except the two ends that need a browser — the chunk
 * being FETCHED and the chip being DRAWN — and the chunk's text is asserted
 * because that is what the tab is handed.
 */

import { readingOfVault } from "@olai/format/testlib/scope"
import {
  Agents,
  definePlugin,
  type Host,
  mountPlugin,
  Offers,
  openPlugins,
  rowReport,
} from "@olai/plugin-api/services"
import { REGISTRY, SERVER_MODULES } from "@olai/plugin-build/shared"
import type { BuiltPlugin } from "@olai/surface"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { openDynamic } from "./runtime.ts"
import { ALWAYS, versionOf } from "./source.ts"

/** A plugin that mounts and registers nothing — the smallest whole server half,
 *  and the shape a `plugins.inspect` answer tells an agent to write. */
const SERVER = [
  `import { definePlugin } from "@olai/plugin-api"`,
  `import { Effect } from "effect"`,
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

/** The vault, as an agent's writes leave it: a node with the property, and a
 *  child per half carrying its source in the note. */
const vault = (options: {
  readonly server?: string
  readonly browser?: string | null
  readonly approved?: string | null
  readonly word?: string
}) => {
  const custom = options.approved == null
    ? { plugin: options.word ?? "swatch" }
    : { plugin: options.word ?? "swatch", approved: options.approved }
  const rows = [
    `{"id":"p","ord":"a0","title":"A swatch","custom":${JSON.stringify(custom)}}`,
    `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":${
      JSON.stringify(options.server ?? SERVER)
    }}`,
  ]
  if (options.browser !== null && options.browser !== undefined) {
    rows.push(
      `{"id":"b","ord":"a1","parent":"p","title":"browser.tsx","desc":${
        JSON.stringify(options.browser)
      }}`,
    )
  }
  return readingOfVault(new Map([["plugins.olai", rows.join("\n")]])).derived
}

/**
 * ONE RUNTIME OVER A HOST OF ITS OWN, for the length of one bench — and the
 * rows READ THE WAY A SERVE READS THEM.
 *
 * `rows()` takes the report rather than remembering one, so `now()` is the
 * composition root's re-read spelled for one host: `rowReport` over whatever
 * words the vault currently defines. That is not a convenience here, it is the
 * subject — the state a definition's row wears comes off the live registry, and
 * a bench that passed a map it had built itself would be asserting against its
 * own memory of what the fiber was doing.
 */
const bench = <A>(
  use: (
    dynamic: ReturnType<typeof openDynamic>,
    now: () => Effect.Effect<ReadonlyArray<BuiltPlugin>>,
    host: Host,
  ) => Effect.Effect<A>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* openPlugins({
        vars: {},
        now: () => "2026-09-05T00:00:00.000Z",
        served: "/nowhere",
      })
      // NO BUILT WORDS: this bench's build has no rows, so nothing is taken and
      // the definition may have any word it likes.
      const dynamic = openDynamic(plugins.host, [])
      return yield* use(
        dynamic,
        () => Effect.map(rowReport(plugins.host, dynamic.names()), dynamic.rows),
        plugins.host,
      )
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

describe("a definition waits for a person", () => {
  test("nobody has approved it: pending, and nothing has been imported", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({}))
        return yield* now()
      })
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe("swatch")
    expect(rows[0]?.running).toBe(false)
    expect(rows[0]?.state).toBe("pending")
    // The SOURCE travels, because approving is reading — see
    // `@olai/surface`'s `BuiltPlugin.source`.
    expect(rows[0]?.source?.server).toBe(SERVER)
    expect(rows[0]?.source?.approved).toBe(false)
    // ...and no chunk, because nothing was built.
    expect(rows[0]?.source?.chunk).toBeUndefined()
  })

  test("approved at this version: it mounts, and it is a row like any other", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: versionOf(SERVER, null) }))
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("running")
    expect(rows[0]?.running).toBe(true)
  })

  test("an edit after an approval is pending again", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        // Approved at the version it HAD, then edited.
        yield* dynamic.follow(vault({ approved: versionOf(SERVER, null) }))
        yield* dynamic.follow(
          vault({ approved: versionOf(SERVER, null), server: `${SERVER}\n// and more` }),
        )
        return yield* now()
      })
    )
    expect(rows[0]?.state).toBe("pending")
    expect(rows[0]?.running).toBe(false)
  })
})

/**
 * A ROW'S WORD IS ITS FIBER'S, AT THE MOMENT IT IS ASKED — the bench for the
 * defect that made `rows` take the report rather than remember one.
 *
 * The state used to be read once, when the mount returned, and stored on the
 * live entry. That is a second clock, and it was wrong in both directions the
 * moment a fiber moved afterwards. This is the case that matters: a definition
 * that NAMES a door nobody is behind mounts `waiting` — legitimately, and the
 * runtime's reactive half will wake it — and when something stands behind that
 * door the fiber goes ACTIVE with nothing about the definition having changed.
 * With a remembered report the row went on saying `waiting` with `running:
 * false`, so the tab never loaded the chunk of a plugin that was serving.
 */
describe("a row's word follows its fiber, not the mount", () => {
  /** A half that names a door this bench does not provide — so it mounts and
   *  waits, which is a legitimate resting state and not a fault. */
  const NEEDS_A_DOOR = [
    `import { Agents, definePlugin } from "@olai/plugin-api"`,
    `import { Effect } from "effect"`,
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
        // a real serve — and the definition's fiber wakes on its own.
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
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ browser: BROWSER, approved: ALWAYS }))
        return dynamic.chunk("/_olai/plugins/swatch-deadbeef.js")
      })
    )
    expect(said).toBeNull()
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

describe("the switch reaches a definition too", () => {
  test("off is off for this process, and on brings it back", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        const found = yield* dynamic.set("swatch", false)
        const off = (yield* now())[0]?.state
        yield* dynamic.set("swatch", true)
        return { found, off, on: (yield* now())[0]?.state }
      })
    )
    expect(said.found).toBe(true)
    expect(said.off).toBe("switched")
    expect(said.on).toBe("running")
  })

  test("a word this vault does not define is not this door's to flip", async () => {
    const found = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        return yield* dynamic.set("kolu", false)
      })
    )
    expect(found).toBe(false)
  })
})

describe("a definition that goes away takes its fiber with it", () => {
  test("the row is gone and nothing is left mounted", async () => {
    const rows = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        yield* dynamic.follow(readingOfVault(new Map([["plugins.olai", ""]])).derived)
        return yield* now()
      })
    )
    expect(rows).toEqual([])
  })
})
