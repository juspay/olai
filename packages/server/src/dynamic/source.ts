/**
 * A PLUGIN, AS THE VAULT HOLDS ONE — the reading phase 12 is built on, and the
 * whole of what this serve knows about a plugin nobody compiled in.
 *
 * ## Where the source lives, and why it is nodes rather than files
 *
 * *In the vault, under the node agent's subtree, as the configuration ruling
 * requires: a node with a `plugin` property whose subtree holds `server.ts` and,
 * optionally, `browser.tsx`, written by the agent through the ordinary vault
 * write door — so the subtree fence of phase 6 applies, and so the plugin is
 * versioned by the ledger like any other file.*
 *
 * Every clause of that is kept HERE, and the way it is kept is that the source
 * is a NOTE. A node's note is markdown stored verbatim with embedded newlines
 * (`@olai/format`'s `desc`), `set_desc` is the ordinary write door onto one, and
 * a `.olai` outline is a file the ledger commits like any other. A `.ts` on the
 * disk beside the outlines would have been none of those things: `@olai/format`
 * claims six kinds of file and `.ts` is not one of them, so the store would not
 * serve it, `write_document` refuses anything that is not a `.md`, the write
 * fence refuses a document write outright, and the ledger records the paths olai
 * WROTE — which, for a file olai does not know about, is no path at all.
 *
 * So the two halves are two child nodes, titled for the files they would have
 * been, each carrying its half in its note. An agent writes them with `add_node`
 * and `set_desc`; a person reads them in the outliner like anything else; a
 * revision moves them like anything else. There is no second write door and no
 * new kind of file.
 *
 * ## What is a plugin here, exactly
 *
 * A node with a `plugin` property. The property's VALUE is the plugin's word —
 * the row's `id`, the sibling key, the word the panel draws and `--plugins`
 * would take if this were a built row. It is the property rather than the title
 * because a title is prose somebody renames and a row's identity is not: the
 * `LocalState` records, the slot table and the approval below are all keyed by the
 * word, and a rename that moved a plugin's identity would orphan every one of
 * them.
 *
 * ## APPROVAL IS A SECOND PROPERTY, on the same node
 *
 * `approved` carries the version a person said yes to, or the word `always`
 * (the human, 2026-09-05: *recorded in the vault, next to the plugin, as a
 * property on the plugin's node, so it travels with the vault and is versioned
 * by the ledger like the source*). A version the property does not name is
 * PENDING again, which is what makes an edit to the source a fresh decision
 * rather than a plugin that quietly became something else after it was trusted.
 *
 * ## Nothing here builds, mounts or judges a person's decision
 *
 * This module answers what is written down. `./runtime.ts` is what does anything
 * about it, and the split is the usual one: a reading is a pure function of a
 * revision and is benched as one.
 */

import { customText, type Derived, isRegular, type RegularNode } from "@olai/format"
import { PLUGIN_BROWSER_NODE as BROWSER_NODE, PLUGIN_SERVER_NODE as SERVER_NODE } from "@olai/surface"

/** THE TWO HALVES, by the titles their child nodes wear — `@olai/surface`'s,
 *  because the panel draws them as headings over the source and
 *  `plugins.inspect` tells an agent what to title what it writes. Three readers,
 *  one spelling; that member's own doc argues why. */
export { BROWSER_NODE, SERVER_NODE }

/** The property that says *this node is a plugin*, and the one that says a
 *  person approved a version of it. Core's own words, undeclared and therefore
 *  plain text like any other custom key (`@olai/format`'s `typing.ts`: typing is
 *  opt-in per key, and a vault that declares nothing behaves as it always did).
 *  `_olai/Settings.olai` must not wear this: its title is the plugin's word,
 *  and a `plugin` property there is a second row that fails to start. */
export const PLUGIN_KEY = "plugin"
export const APPROVED_KEY = "approved"

/** What `approved` carries when a person approved this plugin and every later
 *  version of it, rather than one. */
export const ALWAYS = "always"

/**
 * ONE PLUGIN THE VAULT DEFINES.
 *
 * `fault` is the arm this reading can produce on its own — a word that is not a
 * word, a half that is not there, two nodes claiming one name — and it is a
 * whole sentence because it is drawn under a row on the panel beside the
 * failures a plugin's own `apply` produces. It is CORE's sentence here, unlike
 * those: what is wrong is the shape of the definition, which is olai's
 * vocabulary and not the author's.
 */
export interface Defined {
  /** The word — the row's `id`. */
  readonly name: string
  /** The node the definition hangs off, and the file it is in: what a panel
   *  links to and what a refusal names. */
  readonly node: string
  readonly file: string
  /** The two halves' sources, verbatim. `browser` is absent for a plugin with
   *  no face — a server-only plugin is a whole plugin (a kind, a doorbell), the
   *  same way an engine is a browser-only one. */
  readonly server: string
  readonly browser: string | null
  /** THE VERSION: a content hash of both halves. What a person approves, and
   *  what tells an edit from a redraw. */
  readonly version: string
  /** What the `approved` property says, verbatim — the version, {@link ALWAYS},
   *  or `null` for a plugin nobody has decided about. */
  readonly approved: string | null
  /** Why this definition cannot be built, in a whole sentence, or `null`. */
  readonly fault: string | null
}

/** Whether a version of this definition is the one a person said yes to. */
export const isApproved = (one: Defined): boolean =>
  one.approved === ALWAYS || (one.approved !== null && one.approved === one.version)

/**
 * EVERY PLUGIN THIS VAULT DEFINES, in corpus order.
 *
 * `taken` is the words this BUILD already has — the bundle's rows. A definition
 * that claims one of them is a fault rather than an override: the roster is
 * keyed by the word, the slot table and the `LocalState` records are keyed by the
 * word, and a vault that could rename a compiled-in plugin out of existence
 * would be the vault deciding what the host runs, which is the one thing every
 * ruling in this lane refuses.
 */
export const definedIn = (
  derived: Derived,
  taken: ReadonlyArray<string>,
): ReadonlyArray<Defined> => {
  const claims = new Map<string, number>()
  const read: Array<Defined> = []
  for (const at of derived.nodes) {
    if (!isRegular(at)) continue
    const word = (customText(at.node, PLUGIN_KEY) ?? "").trim()
    if (word === "") continue
    claims.set(word, (claims.get(word) ?? 0) + 1)
    read.push(defined(derived, at.node, at.file, word, taken))
  }
  // TWICE-CLAIMED IS A FAULT ON BOTH, and neither mounts. It is the rule
  // `@olai/plugin-api`'s `Kinds` keeps one registry over and for its reason: the
  // assembly underneath is a `Map.set`, so a collision resolves silently in
  // favour of whoever was read last — one person's plugin quietly serving under
  // another's name, with nothing red anywhere.
  return read.map((one) =>
    one.fault === null && (claims.get(one.name) ?? 0) > 1
      ? { ...one, fault: `two nodes in this vault claim the plugin word "${one.name}", so neither is mounted. Give one of them another word.` }
      : one
  )
}

/** One node, read. */
const defined = (
  derived: Derived,
  node: RegularNode,
  file: string,
  name: string,
  taken: ReadonlyArray<string>,
): Defined => {
  const halves = children(derived, node.id)
  const server = halves.get(SERVER_NODE) ?? null
  const browser = halves.get(BROWSER_NODE) ?? null
  const approved = ((): string | null => {
    const said = (customText(node, APPROVED_KEY) ?? "").trim()
    return said === "" ? null : said
  })()
  const one = {
    name,
    node: node.id,
    file,
    server: server ?? "",
    browser,
    version: versionOf(server ?? "", browser),
    approved,
  }
  return { ...one, fault: faultOf(name, server, taken) }
}

/** What is wrong with this definition, in the order a person can act on it. */
const faultOf = (
  name: string,
  server: string | null,
  taken: ReadonlyArray<string>,
): string | null => {
  if (!WORD.test(name)) {
    return `"${name}" is not a plugin word. A word is lowercase letters, digits and hyphens, `
      + `starting with a letter — it is the row's name, the key its members reach the wire `
      + `under, and the address of its own docs.`
  }
  if (taken.includes(name)) {
    return `this build already has a plugin called "${name}", so a definition in the vault `
      + `cannot take that word. Rename this one.`
  }
  if (server === null || server.trim() === "") {
    return `this plugin has no ${SERVER_NODE}: give the node a child titled ${SERVER_NODE} `
      + `and write the half in its note. A ${BROWSER_NODE} beside it is optional.`
  }
  return null
}

/** THE WORD, and the same shape a bundle row's `id` has. */
const WORD = /^[a-z][a-z0-9-]*$/

/** What {@link versionOf} puts between the two halves — a byte no source file
 *  can contain, spelled as an escape so this file holds none itself. */
const SEPARATOR = "\u0000"

/** The two halves' notes, by the title of the child that carries each. A child
 *  titled neither is ordinary outline content — notes about the plugin, a
 *  to-do, whatever somebody put there — and is passed over rather than
 *  refused. */
const children = (derived: Derived, node: string): ReadonlyMap<string, string> => {
  const found = new Map<string, string>()
  for (const at of derived.children.get(node) ?? []) {
    if (!isRegular(at)) continue
    const title = at.node.title.trim()
    if (title !== SERVER_NODE && title !== BROWSER_NODE) continue
    if (found.has(title)) continue
    found.set(title, at.node.desc ?? "")
  }
  return found
}

/**
 * THE VERSION — a hash of what would run.
 *
 * BOTH HALVES, because approval is about the whole thing: a person who read a
 * server half and approved it has not approved a face that arrived afterwards.
 * The separator is a byte no source can contain, so two definitions cannot hash
 * alike by having their halves cut at a different point.
 *
 * SHORT, because it is read aloud — it goes on the row, into the `approved`
 * property a person's approval writes, and into the URL of the browser chunk.
 * Sixteen hex digits of SHA-256 is the same trade every content-addressed name
 * in this tree makes.
 */
export const versionOf = (server: string, browser: string | null): string =>
  new Bun.CryptoHasher("sha256")
    .update(server)
    .update(SEPARATOR)
    .update(browser ?? "")
    .digest("hex")
    .slice(0, 16)
