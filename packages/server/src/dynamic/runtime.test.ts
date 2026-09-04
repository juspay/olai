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
import { openPlugins } from "@olai/plugin-api/services"
import { REGISTRY } from "@olai/plugin-build/shared"
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

/** One runtime over a host of its own, for the length of one bench. */
const bench = <A>(
  use: (dynamic: ReturnType<typeof openDynamic>) => Effect.Effect<A>,
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
      return yield* use(openDynamic(plugins.host, []))
    })),
  )

describe("a definition waits for a person", () => {
  test("nobody has approved it: pending, and nothing has been imported", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({}))
        return dynamic.rows()
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
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: versionOf(SERVER, null) }))
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("running")
    expect(rows[0]?.running).toBe(true)
  })

  test("an edit after an approval is pending again", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        // Approved at the version it HAD, then edited.
        yield* dynamic.follow(vault({ approved: versionOf(SERVER, null) }))
        yield* dynamic.follow(
          vault({ approved: versionOf(SERVER, null), server: `${SERVER}\n// and more` }),
        )
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("pending")
    expect(rows[0]?.running).toBe(false)
  })
})

describe("a browser half is compiled and served", () => {
  test("the chunk is bound to the host's own modules, and named by the version", async () => {
    const { rows, chunk } = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ browser: BROWSER, approved: ALWAYS }))
        const rows = dynamic.rows()
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

describe("what goes wrong lands on the row, with a sentence", () => {
  test("a module olai does not bind is refused by name", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }),
        )
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain(`"left-pad"`)
  })

  test("a half with no plugin in it says what to write instead", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ server: `export const nothing = 1`, approved: ALWAYS }))
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain("definePlugin")
  })

  test("a half that calls itself something else may not sign another word", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: SERVER.replace(`"swatch"`, `"kolu"`), approved: ALWAYS }),
        )
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain(`calls itself "kolu"`)
  })

  test("an `apply` that throws is the RUNTIME's containment, and it is quoted", async () => {
    const rows = await bench((dynamic) =>
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
        return dynamic.rows()
      })
    )
    expect(rows[0]?.state).toBe("failed")
    expect(rows[0]?.fault).toContain("the socket is gone")
  })
})

describe("the switch reaches a definition too", () => {
  test("off is off for this process, and on brings it back", async () => {
    const said = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        const found = yield* dynamic.set("swatch", false)
        const off = dynamic.rows()[0]?.state
        yield* dynamic.set("swatch", true)
        return { found, off, on: dynamic.rows()[0]?.state }
      })
    )
    expect(said.found).toBe(true)
    expect(said.off).toBe("switched")
    expect(said.on).toBe("running")
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
})

describe("a definition that goes away takes its fiber with it", () => {
  test("the row is gone and nothing is left mounted", async () => {
    const rows = await bench((dynamic) =>
      Effect.gen(function*() {
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        yield* dynamic.follow(readingOfVault(new Map([["plugins.olai", ""]])).derived)
        return dynamic.rows()
      })
    )
    expect(rows).toEqual([])
  })
})
