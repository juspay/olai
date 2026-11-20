import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { itemKey, type WriteRequest } from "@olai/format"
import { readingOfVault } from "@olai/format/testlib/scope"
import {
  Agents,
  type Conversations,
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

import { type DynamicRuntime, openDynamic } from "./runtime.ts"
import { ALWAYS, versionOf } from "./source.ts"

const SERVER = [
  `import { definePlugin } from "@olai/plugin-api"`,
  `import { Effect, Option, Stream } from "effect"`,
  `export default definePlugin({`,
  `  name: "swatch",`,
  `  needs: [],`,
  `  apply: Effect.void,`,
  `})`,
].join("\n")

const BROWSER = [
  `import { createSignal } from "solid-js"`,
  `export const Chip = () => {`,
  `  const [n] = createSignal(1)`,
  `  return <span class="chip">{n()}</span>`,
  `}`,
].join("\n")

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
  const custom = {
    ...(options.approved == null ? {} : { approved: options.approved }),
    ...(options.on === false ? { on: "no" } : options.approved == null && options.on !== true ? {} : { on: "yes" }),
    ...options.props,
  }
  files.set("_olai/Settings.olai", `{"id":"c","ord":"a0","title":"${word}","custom":${JSON.stringify(custom)}}`)
  return readingOfVault(files)
}

const nothing = () => readingOfVault(new Map([["notes.md", "# notes\n"]]))

const bench = <A, E>(
  use: (
    dynamic: DynamicRuntime,
    now: () => Effect.Effect<ReadonlyArray<BuiltPlugin>>,
    host: Host,
    written: ReadonlyArray<WriteRequest>,
    chats: { readonly here: Set<string>; readonly asked: ReadonlyArray<string> },
  ) => Effect.Effect<A, E>,
  door = true,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* openPlugins({
        vars: {},
        now: () => "2026-09-05T00:00:00.000Z",
        served: "/nowhere",
      })
      const written: Array<WriteRequest> = []
      const here = new Set<string>()
      const asked: Array<string> = []
      const chats = {
        here,
        get asked(): ReadonlyArray<string> { return asked },
      }
      const conversations = (): Conversations | undefined => door
        ? {
          open: () => Effect.die(new Error("this bench opens no conversation")),
          say: () => Effect.succeed(false),
          here: ({ about }) =>
            Effect.sync(() => {
              const keys = about.map(itemKey)
              asked.push(...keys)
              return new Set(keys.filter((one) => here.has(one)))
            }),
          engines: () => [],
        }
        : undefined
      const dynamic = openDynamic(
        { mount: (plugin, config) => mountPlugin(plugins.host, plugin, { wait: false, config }) },
        [],
        request => Effect.sync(() => { written.push(request) }),
        conversations,
      )
      return yield* Effect.orDie(use(
        dynamic,
        () => plugins.changes.pipe(
          Stream.mapEffect(() => rowReport(plugins.host, dynamic.names())),
          Stream.filter((report) => ![...report.values()].some((row) => row.state === "waiting" && row.missing === undefined)),
          Stream.take(1),
          Stream.runHead,
          Effect.map((report) => dynamic.rows(Option.getOrThrow(report))),
        ),
        plugins.host,
        written,
        chats,
      ))
    })),
  )

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
    expect(rows[0]?.source?.server).toBe(SERVER)
    expect(rows[0]?.source?.title).toBe("Hex swatch")
    expect(rows[0]?.source?.description).toBe("A colour swatch beside any hex colour.")
    expect(rows[0]?.source?.folder).toBe("plugins/swatch/")
    expect(rows[0]?.source?.approved).toBe(false)
    expect(rows[0]?.source?.on).toBe(false)
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

describe("a row's word follows its fiber, not the mount", () => {
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

describe("a revision that changes what the rows say", () => {
  test("a plugin arrives as a row, and an approval starts it", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({}))
        const arrived = (yield* now())[0]?.state
        yield* dynamic.follow(vault({ approved }))
        return { arrived, turnedOn: (yield* now())[0]?.state }
      })
    )
    expect(said.arrived).toBe("pending")
    expect(said.turnedOn).toBe("running")
  })

  test("a README edit reaches an open page even though no fiber moved", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const approved = versionOf(SERVER, null)
        yield* dynamic.follow(vault({ approved, readme: "# A\n\nOne.\n" }))
        yield* dynamic.follow(vault({ approved, readme: "# A\n\nTwo.\n" }))
        return (yield* now())[0]?.source?.description
      })
    )
    expect(said).toBe("Two.")
  })

  test("a broken plugin keeps its sentence across a revision that changed nothing", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        const broken = { server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }
        yield* dynamic.follow(vault(broken))
        yield* dynamic.follow(vault(broken))
        return (yield* now())[0]
      })
    )
    expect(said?.state).toBe("failed")
    expect(said?.fault).toContain(`"left-pad"`)
  })

  test("...and is tried again the moment its source moves", async () => {
    const said = await bench((dynamic, now) =>
      Effect.gen(function*() {
        yield* dynamic.follow(
          vault({ server: `import pad from "left-pad"\n${SERVER}`, approved: ALWAYS }),
        )
        yield* dynamic.follow(vault({ approved: ALWAYS }))
        return (yield* now())[0]?.state
      })
    )
    expect(said).toBe("running")
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

  test("a plugin being built by a conversation writes no binding", async () => {
    const written = await bench((dynamic, now, _host, written, chats) =>
      Effect.gen(function*() {
        chats.here.add("/plugins/swatch/README.md")
        yield* dynamic.follow(vault({}))
        expect((yield* now())[0]?.source?.building).toBe(true)
        return [...written]
      })
    )
    expect(written).toEqual([])
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

for (const key of ["approved", "on", "checked"]) {
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

test("configure edits the settings node and refuses its reserved keys before writing", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  const server = `import { definePlugin } from "@olai/plugin-api"; import { Effect, Schema } from "effect";
    export default definePlugin({ name: "swatch", needs: [], config: Schema.Struct({ tone: Schema.Literals(["blue", "red"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed("blue")), Schema.annotate({ description: "the tone" })) }), apply: () => Effect.void });`
  yield* dynamic.follow(vault({ server, approved: ALWAYS }))
  expect(yield* Effect.orDie(dynamic.configure("swatch", "tone", "red"))).toBe(true)
  expect(written).toEqual([{ op: "prop", id: "c", key: "tone", value: "red" }])
  for (const key of ["approved", "on", "checked"]) {
    const refused = yield* Effect.orDie(Effect.flip(dynamic.configure("swatch", key, "anything")))
    expect(refused.message).toContain("reserved")
  }
  expect((yield* Effect.orDie(Effect.flip(dynamic.configure("swatch", "builder", "chat-1")))).message)
    .toContain("No editable setting")
  expect((yield* Effect.orDie(Effect.flip(dynamic.configure("swatch", "tone", "green")))).message).toContain("blue")
  expect(written).toHaveLength(1)
  yield* Effect.orDie(dynamic.configure("swatch", "tone", null))
  expect(written[1]).toEqual({ op: "prop", id: "c", key: "tone", value: null })
})))

test("turning on a paused plugin writes the approval and asks for nothing else", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  const approved = versionOf(SERVER, null)
  yield* dynamic.follow(vault({ approved }))
  yield* dynamic.follow(vault({ approved, server: `${SERVER}\n// edited` }))
  yield* dynamic.approve("swatch", false)
  expect(written).toEqual([{
    op: "prop",
    id: "c",
    key: "approved",
    value: versionOf(`${SERVER}\n// edited`, null),
  }])
})))

test("a switch already where it is asked to be writes nothing at all", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  yield* dynamic.follow(vault({ approved: ALWAYS }))
  expect(yield* dynamic.set("swatch", true)).toBe(true)
  expect(written).toEqual([])
})))

test("stopping a plugin that is already stopped writes nothing and refuses nothing", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  yield* dynamic.follow(vault({ approved: ALWAYS, on: false }))
  expect(yield* dynamic.set("swatch", false)).toBe(true)
  expect(written).toEqual([])
})))

describe("the standing decision is about code and nothing else", () => {
  test("always trusting changes does not turn a plugin on", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
    yield* dynamic.follow(vault({ approved: versionOf(SERVER, null), on: false }))
    expect(yield* dynamic.trust("swatch", true)).toBe(true)
    expect(written).toEqual([{ op: "prop", id: "c", key: "approved", value: ALWAYS }])
  })))

  test("...and taking it back pins the version that is running", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
    yield* dynamic.follow(vault({ approved: ALWAYS }))
    expect(yield* dynamic.trust("swatch", false)).toBe(true)
    expect(written).toEqual([{ op: "prop", id: "c", key: "approved", value: versionOf(SERVER, null) }])
  })))
})

test("a pending half that will not compile says so before anybody approves it", () => bench((dynamic, now) => Effect.gen(function*() {
  yield* dynamic.follow(vault({ server: `${SERVER}\nthis is not typescript(` }))
  const rows = yield* now()
  expect(rows[0]?.state).toBe("failed")
  expect(rows[0]?.fault ?? "").not.toBe("")
  expect(rows[0]?.source?.approved).toBe(false)
})))

test("...and one that compiles is still only pending", () => bench((dynamic, now) => Effect.gen(function*() {
  yield* dynamic.follow(vault({}))
  const rows = yield* now()
  expect(rows[0]?.state).toBe("pending")
  expect(rows[0]?.fault).toBeUndefined()
})))

test("deleting a plugin removes its files and its consent", () => bench((dynamic, _now, _host, written) => Effect.gen(function*() {
  yield* dynamic.follow(vault({ approved: ALWAYS, browser: BROWSER, readme: "# Swatch\n\nA chip.\n" }))
  expect(yield* dynamic.remove("swatch")).toBe(true)
  expect(written).toEqual([
    { op: "delete", file: "plugins/swatch/README.md" },
    { op: "delete", file: "plugins/swatch/server.ts" },
    { op: "delete", file: "plugins/swatch/browser.tsx" },
    { op: "trash", id: "c" },
  ])
})))

test("the builder's finished version is written to the plugin's node", () => bench((dynamic, now, _host, written, chats) => Effect.gen(function*() {
  chats.here.add("/plugins/swatch/README.md")
  yield* dynamic.follow(vault({}))
  expect((yield* now())[0]?.source?.building).toBe(true)
  expect(yield* dynamic.checked("swatch", versionOf(SERVER, null))).toBe(true)
  expect(written).toEqual([{ op: "prop", id: "c", key: "checked", value: versionOf(SERVER, null) }])
})))

test("...and a serve that restarts reads it back off the file", () => bench((dynamic, now, _host, _written, chats) => Effect.gen(function*() {
  chats.here.add("/plugins/swatch/README.md")
  yield* dynamic.follow(vault({ props: { checked: versionOf(SERVER, null) } }))
  expect((yield* now())[0]?.source?.building).toBeUndefined()
})))

test("...and a second run at the same version writes nothing", () => bench((dynamic, _now, _host, written, chats) => Effect.gen(function*() {
  chats.here.add("/plugins/swatch/README.md")
  yield* dynamic.follow(vault({ props: { checked: versionOf(SERVER, null) } }))
  expect(yield* dynamic.checked("swatch", versionOf(SERVER, null))).toBe(true)
  expect(written).toEqual([])
})))

describe("the conversation building a plugin is the chat on its README", () => {
  test("it is asked about the plugin's own README, per revision", () => bench((dynamic, now, _host, _written, chats) => Effect.gen(function*() {
    yield* dynamic.follow(vault({}))
    expect((yield* now())[0]?.source?.chat).toBeUndefined()
    expect((yield* now())[0]?.source?.building).toBeUndefined()
    expect(chats.asked).toEqual(["/plugins/swatch/README.md"])
  })))

  test("...and a chat there is a plugin an agent is building", () => bench((dynamic, now, _host, _written, chats) => Effect.gen(function*() {
    chats.here.add("/plugins/swatch/README.md")
    yield* dynamic.follow(vault({}))
    expect((yield* now())[0]?.source?.chat).toBe(true)
    expect((yield* now())[0]?.source?.building).toBe(true)
    chats.here.clear()
    yield* dynamic.follow(vault({}))
    expect((yield* now())[0]?.source?.chat).toBeUndefined()
    expect((yield* now())[0]?.source?.building).toBeUndefined()
  })))

  test("a chat on some other note is not this plugin's", () => bench((dynamic, now, _host, _written, chats) => Effect.gen(function*() {
    chats.here.add("/plugins/other/README.md")
    yield* dynamic.follow(vault({}))
    expect((yield* now())[0]?.source?.chat).toBeUndefined()
  })))

  test("with chat off nothing is asked and nothing is being built", () => bench((dynamic, now, _host, _written, chats) => Effect.gen(function*() {
    yield* dynamic.follow(vault({}))
    const row = (yield* now())[0]
    expect(chats.asked).toEqual([])
    expect(row?.source?.chat).toBeUndefined()
    expect(row?.source?.asking).toBeUndefined()
    expect(row?.source?.building).toBeUndefined()
  }), false))
})

test("a stale builder property is a property nobody reads", () => bench((dynamic, now, _host, written) => Effect.gen(function*() {
  const server = `import { definePlugin } from "@olai/plugin-api"; import { Effect, Schema } from "effect";
    export default definePlugin({ name: "swatch", needs: [], config: Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("blue")), Schema.annotate({ description: "the tone" })) }), apply: () => Effect.void });`
  const approved = versionOf(server, null)
  yield* dynamic.follow(vault({ server, approved, props: { builder: "chat-1" } }))
  const row = (yield* now())[0]
  expect(row?.state).toBe("running")
  expect(row?.fault).toBeUndefined()
  expect(row?.source?.building).toBeUndefined()
  expect(row?.configurationValues).toEqual([expect.objectContaining({ key: "tone", value: "blue", setBy: "default" })])
  expect(yield* dynamic.set("swatch", false)).toBe(true)
  expect(written).toEqual([{ op: "prop", id: "c", key: "on", value: "no" }])
})))
