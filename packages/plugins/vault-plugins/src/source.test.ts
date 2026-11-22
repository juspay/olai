/**
 * WHAT THE VAULT DEFINES, read — the pure half of this row.
 *
 * A reading is a function of a revision, so every claim here is made against a
 * vault written out as text and nothing else: no host, no compiler, no mount.
 */
import { readingOfVault } from "@olai/format/testlib/scope"
import { describe, expect, test } from "bun:test"

import { ALWAYS, definedIn, isApproved, isBuilding, isOn, refusalFor, toldBy, versionOf as versionOfCode } from "./source.ts"

/** One vault, as its files. A plugin is three of them in a folder; the settings
 *  file is an outline, a record per line, which is what the settings reader and
 *  every other row's consent already is. */
const vault = (files: Readonly<Record<string, string>>) =>
  readingOfVault(new Map(Object.entries(files)))

const settings = (...lines: ReadonlyArray<string>) => ({ "_olai/Settings.olai": lines.join("\n") })

const NOTHING_BUILT: ReadonlyArray<string> = []

const SERVER = `export default 1`
const BROWSER = `export default 2`

/** The version of a folder holding these two entries (and any other code
 *  files), spelled the way most cases here name one. */
const versionOf = (server: string, browser: string | null, more: Readonly<Record<string, string>> = {}): string =>
  versionOfCode(new Map(Object.entries({
    "server.ts": server,
    ...(browser === null ? {} : { "browser.tsx": browser }),
    ...more,
  })))

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

  test("a file loose under plugins/ defines nothing, and one nested deeper is the plugin's code", () => {
    expect(definedIn(vault({ "plugins/notes.md": "# notes\n" }), NOTHING_BUILT)).toEqual([])
    const [one] = definedIn(
      vault({ "plugins/swatch/server.ts": SERVER, "plugins/swatch/lib/helper.ts": "export const x = 1" }),
      NOTHING_BUILT,
    )
    expect(one?.server).toBe(SERVER)
    expect([...one!.code.keys()]).toEqual(["lib/helper.ts", "server.ts"])
    expect(one?.holds).toContain("lib/helper.ts")
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
    expect(isOn(one!)).toBe(false)
    expect(isApproved(one!)).toBe(false)
  })

  test("the approved version is the one a person said yes to, and an edit undoes it", () => {
    const approved = versionOf(SERVER, null)
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${approved}","on":"yes"}}`) }),
      NOTHING_BUILT,
    )
    expect(isApproved(one!)).toBe(true)
    expect(isOn(one!)).toBe(true)

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
    expect(isOn(edited!)).toBe(true)
  })

  test("`always` approves every later version", () => {
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${ALWAYS}"}}`) }),
      NOTHING_BUILT,
    )
    expect(isApproved(one!)).toBe(true)
  })

  test("the version its builder finished rides beside it", () => {
    const [one] = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"checked":"abc123"}}`) }),
      NOTHING_BUILT,
    )
    expect(one?.checked).toBe("abc123")
  })

  /** A `builder` property is what this row used to write to bind a chat to a
   *  plugin. Nothing writes it and nothing reads it now — the chat is the one
   *  at the plugin's own address — so one left on a node is a custom property
   *  like any other, and the reading is the same reading without it. */
  test("a `builder` left over from before is read as nothing at all", () => {
    const stale = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"builder":"chat-7","on":"yes"}}`) }),
      NOTHING_BUILT,
    )[0]!
    const without = definedIn(
      vault({ ...folder, ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"on":"yes"}}`) }),
      NOTHING_BUILT,
    )[0]!
    expect(isOn(stale)).toBe(true)
    expect(stale.fault).toBeNull()
    expect({ ...stale, consent: null }).toEqual({ ...without, consent: null })
  })
})

/**
 * WHETHER AN AGENT IS STILL WRITING THE FOLDER — the serve's answer, because
 * the protocol it encodes is the serve's: which call means *done*, and in what
 * order a build writes its files.
 *
 * THE CHAT IS ASKED FOR, not read off the folder: a plugin is being built by
 * the chat at its own page's address, which is a row in the vault and not a
 * word on the plugin's node, so the caller passes the answer in
 * (`./runtime.ts`).
 */
describe("a folder an agent is still writing", () => {
  const SETTINGS = (custom: string) => settings(`{"id":"s","ord":"a0","title":"swatch","custom":${custom}}`)
  const one = (custom: string, files: Readonly<Record<string, string>> = { "plugins/swatch/server.ts": SERVER }) =>
    definedIn(vault({ ...files, ...SETTINGS(custom) }), NOTHING_BUILT)[0]!

  test("a chat is at its address and nobody has said it is finished", () => {
    expect(isBuilding(one("{}"), true)).toBe(true)
  })

  test("...and a README with no server half is a folder with nothing to run yet", () => {
    expect(isBuilding(one("{}", { "plugins/swatch/README.md": "# S\n" }), true)).toBe(true)
  })

  test("the builder saying so at the version on disk ends it", () => {
    expect(isBuilding(one(`{"checked":"${versionOf(SERVER, null)}"}`), true)).toBe(false)
  })

  test("...and saying so at a version that has since moved does not", () => {
    expect(isBuilding(one(`{"checked":"an-older-version"}`), true)).toBe(true)
  })

  test("a folder nobody built with an agent was never being built", () => {
    expect(isBuilding(one("{}"), false)).toBe(false)
  })

  test("and an agent editing a plugin somebody approved is a change, not a build", () => {
    expect(isBuilding(one(`{"approved":"an-older-version"}`), true)).toBe(false)
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

  test("two folders that differ only in where a file ends cannot have one version", () => {
    // The bytes in between are the same either way: a file `a.ts` whose text
    // carries the next file's path and text after a NUL, against the two files
    // themselves. Nothing here relies on a byte no file can hold.
    const joined = new Map([["a.ts", "x\u0000b.ts\u0000y"]])
    const apart = new Map([["a.ts", "x"], ["b.ts", "y"]])
    expect(versionOfCode(joined)).not.toBe(versionOfCode(apart))
    // ...and the same holds for where a PATH ends and its text begins.
    expect(versionOfCode(new Map([["a.ts\u0000x", ""]]))).not.toBe(versionOfCode(new Map([["a.ts", "x\u0000"]])))
  })

  /** The folder as a reading, so the version is the one the serve computes off
   *  the files on disk rather than one this case assembled itself. */
  const read = (files: Readonly<Record<string, string>>) =>
    definedIn(vault(Object.fromEntries(Object.entries(files).map(([path, text]) => [`plugins/reader/${path}`, text]))), NOTHING_BUILT)[0]!
  const BASE = {
    "README.md": "# Reader\n\nOne.\n",
    "server.ts": `import { scheduled } from "./lib/sm2.ts"\nexport default scheduled`,
    "lib/sm2.ts": `export const scheduled = 1`,
  }

  test("adding, editing, renaming or removing any code file moves it", () => {
    const was = read(BASE).version
    expect(read({ ...BASE, "types.ts": `export const GRADES = []` }).version).not.toBe(was)
    expect(read({ ...BASE, "lib/sm2.ts": `export const scheduled = 2` }).version).not.toBe(was)
    const { "lib/sm2.ts": moved, ...rest } = BASE
    expect(read({ ...rest, "lib/sm-2.ts": moved }).version).not.toBe(was)
    expect(read(rest).version).not.toBe(was)
  })

  test("a file nothing imports moves it too, and the README still does not", () => {
    const was = read(BASE).version
    expect(read({ ...BASE, "unused.tsx": `export const Nothing = () => null` }).version).not.toBe(was)
    expect(read({ ...BASE, "README.md": "# Reader\n\nTwo.\n" }).version).toBe(was)
  })

  test("a version names every file by path, so moving text between files moves it", () => {
    expect(versionOfCode(new Map([["a.ts", "x"], ["b.ts", ""]]))).not.toBe(versionOfCode(new Map([["a.ts", ""], ["b.ts", "x"]])))
  })

  test("an approval made by the two-file formula is not an approval of any folder now", () => {
    const OLD_SEPARATOR = "\u0000"
    const oldFormula = new Bun.CryptoHasher("sha256").update(SERVER).update(OLD_SEPARATOR).update(BROWSER).digest("hex").slice(0, 16)
    const [one] = definedIn(
      vault({
        "plugins/swatch/server.ts": SERVER,
        "plugins/swatch/browser.tsx": BROWSER,
        ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${oldFormula}","on":"yes"}}`),
      }),
      NOTHING_BUILT,
    )
    expect(one?.version).not.toBe(oldFormula)
    expect(isApproved(one!)).toBe(false)
    expect(isOn(one!)).toBe(true)
    const [trusting] = definedIn(
      vault({
        "plugins/swatch/server.ts": SERVER,
        "plugins/swatch/browser.tsx": BROWSER,
        ...settings(`{"id":"s","ord":"a0","title":"swatch","custom":{"approved":"${ALWAYS}","on":"yes"}}`),
      }),
      NOTHING_BUILT,
    )
    expect(isApproved(trusting!)).toBe(true)
  })

  test("an approval sent after a helper moved is refused as source nobody has read", () => {
    const drawn = read(BASE).version
    const refusal = refusalFor(read({ ...BASE, "lib/sm2.ts": `export const scheduled = 3` }), "approve", drawn)
    expect(refusal?.kind).toBe("moved")
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

  test("the front matter that ties the builder chat is not the title or the sentence", () => {
    expect(toldBy("---\nchat-agent-session: claude:abc\n---\n# Swatch\n\nA colour swatch.\n"))
      .toEqual({ title: "Swatch", description: "A colour swatch." })
  })
})
