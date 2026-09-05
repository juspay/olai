/**
 * WHAT THE VAULT DEFINES, read — the pure half of phase 12, benched as one.
 *
 * A reading is a function of a revision, so every claim here is made against a
 * vault written out as text and nothing else: no host, no compiler, no mount.
 */

import { TRASH_FILE } from "@olai/format"
import { readingOfVault } from "@olai/format/testlib/scope"
import { describe, expect, test } from "bun:test"

import { ALWAYS, definedIn, isApproved, versionOf } from "./source.ts"

/** One vault, as its files. `.olai` is a record per line, which is the format's
 *  own shape and what an agent's `add_node` and `set_desc` leave behind. */
const vault = (...lines: ReadonlyArray<string>) =>
  readingOfVault(new Map([["plugins.olai", lines.join("\n")]])).derived

const NOTHING_BUILT: ReadonlyArray<string> = []

describe("a plugin is a node with a `plugin` property", () => {
  test("its word, its two halves and its version", () => {
    const [one] = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"swatch"}}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
        `{"id":"b","ord":"a1","parent":"p","title":"browser.tsx","desc":"export default 2"}`,
      ),
      NOTHING_BUILT,
    )
    expect(one?.name).toBe("swatch")
    expect(one?.node).toBe("p")
    expect(one?.file).toBe("plugins.olai")
    expect(one?.server).toBe("export default 1")
    expect(one?.browser).toBe("export default 2")
    expect(one?.fault).toBeNull()
    expect(one?.version).toBe(versionOf("export default 1", "export default 2"))
  })

  test("a node without the property is not a plugin, and neither is a child of one", () => {
    expect(
      definedIn(
        vault(
          `{"id":"x","ord":"a0","title":"ordinary"}`,
          `{"id":"s","ord":"a1","title":"server.ts","desc":"export default 1"}`,
        ),
        NOTHING_BUILT,
      ),
    ).toEqual([])
  })

  test("a browser half is optional — a server-only plugin is a whole plugin", () => {
    const [one] = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A kind","custom":{"plugin":"swatch"}}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
      ),
      NOTHING_BUILT,
    )
    expect(one?.browser).toBeNull()
    expect(one?.fault).toBeNull()
  })

  test("children that are neither half are ordinary outline content", () => {
    const [one] = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"swatch"}}`,
        `{"id":"n","ord":"a0","parent":"p","title":"why I wrote this"}`,
        `{"id":"s","ord":"a1","parent":"p","title":"server.ts","desc":"export default 1"}`,
      ),
      NOTHING_BUILT,
    )
    expect(one?.fault).toBeNull()
    expect(one?.server).toBe("export default 1")
  })
})

describe("what is refused, and in whole sentences", () => {
  test("a definition with no server half names the child it wants", () => {
    const [one] = definedIn(
      vault(`{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"swatch"}}`),
      NOTHING_BUILT,
    )
    expect(one?.fault).toContain("server.ts")
  })

  test("a word that is not a word", () => {
    const [one] = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"Swatch Two"}}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
      ),
      NOTHING_BUILT,
    )
    expect(one?.fault).toContain("not a plugin word")
  })

  test("a word this build already has is a fault, not an override", () => {
    const [one] = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"kolu"}}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
      ),
      ["kolu"],
    )
    expect(one?.fault).toContain(`already has a plugin called "kolu"`)
  })

  test("two nodes claiming one word fault BOTH — the collision is not resolved", () => {
    const read = definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"One","custom":{"plugin":"swatch"}}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
        `{"id":"q","ord":"a1","title":"Two","custom":{"plugin":"swatch"}}`,
        `{"id":"t","ord":"a0","parent":"q","title":"server.ts","desc":"export default 2"}`,
      ),
      NOTHING_BUILT,
    )
    expect(read).toHaveLength(2)
    for (const one of read) expect(one.fault).toContain("two nodes in this vault claim")
  })
})

describe("approval names a version, and an edit takes it back", () => {
  const defined = (approved: string | null, server = "export default 1") =>
    definedIn(
      vault(
        `{"id":"p","ord":"a0","title":"A dressing","custom":${
          JSON.stringify(approved === null ? { plugin: "swatch" } : { plugin: "swatch", approved })
        }}`,
        `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":${JSON.stringify(server)}}`,
      ),
      NOTHING_BUILT,
    )[0]!

  test("nobody has decided", () => {
    expect(isApproved(defined(null))).toBe(false)
  })

  test("this version, and only this version", () => {
    const one = defined(null)
    expect(isApproved(defined(one.version))).toBe(true)
    // The same approval against source that has moved on: the hash it names is
    // not the hash of what is written now, so the plugin is pending again. This
    // is the whole of what stops "approve once" meaning "approve whatever this
    // becomes".
    expect(isApproved(defined(one.version, "export default 999"))).toBe(false)
  })

  test("`always` survives an edit, which is what it is for", () => {
    expect(isApproved(defined(ALWAYS))).toBe(true)
    expect(isApproved(defined(ALWAYS, "export default 999"))).toBe(true)
  })

  test("the version covers BOTH halves — a face added after an approval is a new decision", () => {
    expect(versionOf("a", null)).not.toBe(versionOf("a", "b"))
  })
})

/**
 * A NODE THAT WAS PUT AWAY IS NOT A DEFINITION — the skip `definedIn` makes,
 * and the half of the doc's retraction that was not true until it did.
 *
 * `trash_node` moves the records to `_olai/Trash.olai`. They stay regular
 * nodes, they still carry the `plugin` property, and without the skip they
 * were read like any other: the panel drew them as a vault-defined plugin
 * with the trash as its file. The rest of the tree treats that file as
 * absent (`isPutAway`); this reader does too.
 */
describe("a node that was put away is not a definition", () => {
  const records = [
    `{"id":"p","ord":"a0","title":"A dressing","custom":{"plugin":"swatch"}}`,
    `{"id":"s","ord":"a0","parent":"p","title":"server.ts","desc":"export default 1"}`,
  ].join("\n")

  test("moved to `_olai/Trash.olai` is gone", () => {
    expect(
      definedIn(
        readingOfVault(new Map([[TRASH_FILE, records]])).derived,
        NOTHING_BUILT,
      ),
    ).toEqual([])
  })

  test("a namesake still in the vault is the only definition — the collision is not with the trash", () => {
    const read = definedIn(
      readingOfVault(
        new Map([
          ["plugins.olai", records],
          [TRASH_FILE, [
            `{"id":"q","ord":"a0","title":"Put away","custom":{"plugin":"swatch"}}`,
            `{"id":"t","ord":"a0","parent":"q","title":"server.ts","desc":"export default 2"}`,
          ].join("\n")],
        ]),
      ).derived,
      NOTHING_BUILT,
    )
    expect(read).toHaveLength(1)
    expect(read[0]?.name).toBe("swatch")
    expect(read[0]?.file).toBe("plugins.olai")
    expect(read[0]?.fault).toBeNull()
  })
})
