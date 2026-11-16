/**
 * WHAT THE VAULT DEFINES, read — the pure half of this row.
 *
 * A reading is a function of a revision, so every claim here is made against a
 * vault written out as text and nothing else: no host, no compiler, no mount.
 */
import { readingOfVault } from "@olai/format/testlib/scope"
import { describe, expect, test } from "bun:test"

import { ALWAYS, definedIn, isApproved, refusalFor, toldBy, versionOf } from "./source.ts"

/** One vault, as its files. A plugin is three of them in a folder; the settings
 *  file is an outline, a record per line, which is what the settings reader and
 *  every other row's consent already is. */
const vault = (files: Readonly<Record<string, string>>) =>
  readingOfVault(new Map(Object.entries(files)))

const settings = (...lines: ReadonlyArray<string>) => ({ "_olai/Settings.olai": lines.join("\n") })

const NOTHING_BUILT: ReadonlyArray<string> = []

const SERVER = `export default 1`
const BROWSER = `export default 2`

describe("a plugin is a folder under plugins/", () => {
  test("its word, its prose, its two halves and its version", () => {
    const [one] = definedIn(
      vault({
        "plugins/swatch/README.md": "# Hex swatch\n\nA colour swatch beside any hex colour.\n\nMore prose.\n",
        "plugins/swatch/server.ts": SERVER,
        "plugins/swatch/browser.tsx": BROWSER,
      }),
      NOTHING_BUILT,
    )
    expect(one?.name).toBe("swatch")
    expect(one?.folder).toBe("plugins/swatch/")
    expect(one?.title).toBe("Hex swatch")
    expect(one?.description).toBe("A colour swatch beside any hex colour.")
    expect(one?.server).toBe(SERVER)
    expect(one?.browser).toBe(BROWSER)
    expect(one?.fault).toBeNull()
    expect(one?.version).toBe(versionOf(SERVER, BROWSER))
  })

  test("a browser half is optional — a server-only plugin is a whole plugin", () => {
    const [one] = definedIn(
      vault({ "plugins/agenda/server.ts": SERVER }),
      NOTHING_BUILT,
    )
    expect(one?.browser).toBeNull()
    expect(one?.fault).toBeNull()
  })

  test("a folder with no README draws its word", () => {
    const [one] = definedIn(vault({ "plugins/agenda/server.ts": SERVER }), NOTHING_BUILT)
    expect(one?.title).toBe("agenda")
    expect(one?.description).toBe("")
    expect(one?.readme).toBeNull()
  })

  test("a folder with no server half is a fault naming the file it wants", () => {
    const [one] = definedIn(
      vault({ "plugins/swatch/README.md": "# Swatch\n\nNothing else.\n" }),
      NOTHING_BUILT,
    )
    expect(one?.fault).toContain("server.ts")
  })

  test("a word this build already has is a fault rather than an override", () => {
    const [one] = definedIn(vault({ "plugins/journal/server.ts": SERVER }), ["journal"])
    expect(one?.fault).toContain("already has a plugin")
  })

  test("a folder whose name is not a word is a fault naming the grammar", () => {
    const [one] = definedIn(vault({ "plugins/Hex Swatch/server.ts": SERVER }), NOTHING_BUILT)
    expect(one?.fault).toContain("not a plugin word")
  })

  test("a file loose under plugins/, and one nested deeper, define nothing", () => {
    expect(definedIn(vault({ "plugins/notes.md": "# notes\n" }), NOTHING_BUILT)).toEqual([])
    const [one] = definedIn(
      vault({ "plugins/swatch/server.ts": SERVER, "plugins/swatch/lib/helper.ts": "export const x = 1" }),
      NOTHING_BUILT,
    )
    // The helper is vault content this row passes over — the folder holds three
    // files and everything else in it is the author's own business.
    expect(one?.server).toBe(SERVER)
  })

  test("TypeScript outside plugins/ is not a plugin and is not even in the set", () => {
    const reading = vault({ "src/index.ts": "export const x = 1" })
    expect(definedIn(reading, NOTHING_BUILT)).toEqual([])
    expect(reading.set.documents.map(one => one.path)).toEqual([])
  })
})

describe("consent is in the settings file, and does not travel with the folder", () => {
  const folder = { "plugins/swatch/server.ts": SERVER }

  test("a folder nobody has decided about is off and unapproved", () => {
    const [one] = definedIn(vault(folder), NOTHING_BUILT)
    expect(one?.approved).toBeNull()
    expect(one?.on).toBe(false)
    expect(isApproved(one!)).toBe(false)
  })

  test("the approved version is the one a person said yes to, and an edit undoes it", () => {
    const approved = versionOf(SERVER, null)
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${approved}","on":"yes"}}`) }),
      NOTHING_BUILT,
    )
    expect(isApproved(one!)).toBe(true)
    expect(one?.on).toBe(true)

    const [edited] = definedIn(
      vault({
        "plugins/swatch/server.ts": `${SERVER} + 1`,
        ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${approved}","on":"yes"}}`),
      }),
      NOTHING_BUILT,
    )
    expect(isApproved(edited!)).toBe(false)
    // ...AND THE SWITCH IS STILL UP, which is the whole of what "paused" means:
    // the person still wants it, and the code it would run is not the code they
    // read.
    expect(edited?.on).toBe(true)
  })

  test("`always` approves every later version", () => {
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${ALWAYS}"}}`) }),
      NOTHING_BUILT,
    )
    expect(isApproved(one!)).toBe(true)
  })

  test("the conversation building it rides beside the consent", () => {
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"builder":"chat-7"}}`) }),
      NOTHING_BUILT,
    )
    expect(one?.builder).toBe("chat-7")
  })

  test("...and so does the version its builder finished", () => {
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"builder":"chat-7","checked":"abc123"}}`) }),
      NOTHING_BUILT,
    )
    expect(one?.checked).toBe("abc123")
  })
})

/**
 * EVERY VERB THAT WRITES `approved` ASKS THE SAME DOOR, which is the point of
 * reading it here rather than in each handler: *Always trust changes* used to
 * take no version at all, so on a **Ready for you** page it approved this
 * version and every later one with the stale-source refusal skipped.
 */
describe("what may be decided about a plugin's code", () => {
  const one = (custom: string, server: string = SERVER) =>
    definedIn(
      vault({
        "plugins/swatch/server.ts": server,
        ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":${custom}}`),
      }),
      NOTHING_BUILT,
    )[0]!

  const AT = versionOf(SERVER, null)

  test("approving and trusting the version the page drew are both allowed", () => {
    expect(refusalFor(one("{}"), "approve", AT)).toBeNull()
    expect(refusalFor(one("{}"), "trust", AT)).toBeNull()
  })

  test("trusting source that has moved since the page drew it is refused", () => {
    const refusal = refusalFor(one("{}"), "trust", "a-version-nobody-is-looking-at")
    expect(refusal?.kind).toBe("moved")
    expect(refusal?.reason).toContain("has been edited since this page drew it")
  })

  test("trusting a plugin that cannot start is refused, as approving one is", () => {
    // A FOLDER WITH NO `server.ts` is the fault a reading can produce on its
    // own, and the only one this pure test can stand up.
    const broken = definedIn(vault({ "plugins/swatch/README.md": "# S\n" }), NOTHING_BUILT)[0]!
    const refusal = refusalFor(broken, "trust", broken.version)
    expect(refusal?.kind).toBe("usage")
    expect(refusal?.reason).toContain("cannot run as it stands")
  })

  test("stopping trust on a plugin that trusts nothing is refused", () => {
    const refusal = refusalFor(one(`{"approved":"${AT}"}`), "untrust", AT)
    expect(refusal?.kind).toBe("usage")
    expect(refusal?.reason).toContain("is not trusting changes")
  })

  test("...and is allowed on one that is, even where the plugin cannot start", () => {
    expect(refusalFor(one(`{"approved":"${ALWAYS}"}`), "untrust", AT)).toBeNull()
    const broken = definedIn(
      vault({ "plugins/swatch/README.md": "# S\n", ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${ALWAYS}"}}`) }),
      NOTHING_BUILT,
    )[0]!
    expect(refusalFor(broken, "untrust", broken.version)).toBeNull()
  })
})

describe("the version is about the code and nothing else", () => {
  test("a README edit does not move it", () => {
    const read = (readme: string) =>
      definedIn(vault({ "plugins/swatch/README.md": readme, "plugins/swatch/server.ts": SERVER }), NOTHING_BUILT)[0]!
    expect(read("# A\n\nOne.\n").version).toBe(read("# A\n\nAnother sentence entirely.\n").version)
  })

  test("either half moving does move it", () => {
    expect(versionOf(SERVER, BROWSER)).not.toBe(versionOf(SERVER, `${BROWSER} `))
    expect(versionOf(SERVER, BROWSER)).not.toBe(versionOf(`${SERVER} `, BROWSER))
  })

  test("two plugins cannot hash alike by cutting their halves at a different point", () => {
    expect(versionOf("ab", "c")).not.toBe(versionOf("a", "bc"))
  })
})

describe("what the README says this is", () => {
  test("the first heading and the first paragraph under it", () => {
    expect(toldBy("# Hex swatch\n\nA colour swatch.\n\nAnd more.\n")).toEqual({
      title: "Hex swatch",
      description: "A colour swatch.",
    })
  })

  test("a paragraph that wraps is one sentence", () => {
    expect(toldBy("# A\n\nA sentence\nthat wraps.\n").description).toBe("A sentence that wraps.")
  })

  test("a README with a heading and nothing else says nothing rather than inventing a line", () => {
    expect(toldBy("# Only a title\n")).toEqual({ title: "Only a title", description: "" })
  })

  test("prose with no heading still has a sentence", () => {
    expect(toldBy("Just prose.\n")).toEqual({ title: "", description: "Just prose." })
  })
})
