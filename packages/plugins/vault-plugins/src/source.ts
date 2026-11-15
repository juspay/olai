/**
 * A PLUGIN, AS THE VAULT HOLDS ONE — the reading everything else here is built
 * on, and the whole of what this serve knows about a plugin nobody compiled in.
 *
 * ## It is a FOLDER
 *
 * ```
 * plugins/hex-swatch/
 *   README.md     what it does, for a person
 *   server.ts     required
 *   browser.tsx   optional
 * ```
 *
 * Three plain files a person can open in any editor, review in a pull request
 * and keep in git — which is the whole of why the shape changed. It used to be
 * a node with a `plugin` property and two children carrying the halves in their
 * notes, and the argument for that was real at the time: `.ts` was not a kind
 * of file olai served, so a half on the disk was a half the store would not
 * read, the ledger would not record and no write door would write. Every clause
 * of that is now false. A claim may say WHERE it applies (`@olai/format`'s
 * `Claim.under`), so `.ts` under `plugins/` is a kind of file this serve holds
 * and nothing else in the vault is swept up with it; `create-doc` mints any
 * kept-text kind the claims admit; and the write gate, the revision, the
 * commit panel and the diff all treat the three files as what they are.
 *
 * What that bought is not tidiness. It is that a plugin is now a thing you can
 * SHOW somebody: a folder, with a README at the top of it, that travels by
 * being copied.
 *
 * ## ...and the CONSENT is somewhere else entirely
 *
 * `on`, `approved` and the plugin's own knobs live on the plugin's node in
 * `_olai/Settings.olai` — the same file, the same shape and the same reader
 * every row this build shipped already keeps its settings in (the human,
 * 2026-11: *exactly where built rows keep theirs*).
 *
 * The consequence is the point: **a folder copied in from another vault arrives
 * off and unapproved**, because consent did not travel with it. The code is
 * portable and the yes is not. It also means enablement SURVIVES A RESTART,
 * which a definition's switch never did — it used to be a set in this process's
 * memory, so a plugin somebody turned off came back on at the next boot.
 *
 * ## Nothing here builds, mounts or judges a person's decision
 *
 * This module answers what is written down. `./runtime.ts` is what does anything
 * about it, and the split is the usual one: a reading is a pure function of a
 * revision.
 */

import {
  customText,
  type Located,
  type Reading,
  isRegular,
} from "@olai/format"
import { configurationNode, configurationNodes } from "@olai/plugin-api/configuration"
import {
  PLUGIN_BROWSER_FILE,
  PLUGIN_FOLDER,
  PLUGIN_README_FILE,
  PLUGIN_SERVER_FILE,
} from "@olai/surface"
import { isMarkdown } from "@olai/format"

import { usesOf, type Uses } from "./uses.ts"

export { PLUGIN_BROWSER_FILE, PLUGIN_FOLDER, PLUGIN_README_FILE, PLUGIN_SERVER_FILE }

/** The two consent properties, on the plugin's node in the settings file. Core's
 *  own words, undeclared and therefore plain text like any other custom key —
 *  and `on` is spelled exactly as a built row's is, because it IS a built row's:
 *  one reader, one word, one meaning. */
export const APPROVED_KEY = "approved"
export const ON_KEY = "on"

/** The property that binds the conversation building a plugin to the plugin it
 *  is building. It sits on the plugin's settings node beside the consent,
 *  because that is the row's own record and the chat is a fact about this
 *  plugin rather than about that conversation. */
export const BUILDER_KEY = "builder"

/** What `approved` carries when a person approved this plugin and every later
 *  version of it, rather than one. */
export const ALWAYS = "always"

/** THE WORD — the folder's name, and the same shape a bundle row's `id` has. */
export const WORD = /^[a-z][a-z0-9-]*$/

/**
 * ONE PLUGIN THE VAULT DEFINES.
 *
 * `fault` is the arm this reading can produce on its own — a folder named
 * something that is not a word, a folder with no `server.ts`, a word this build
 * already has — and it is a whole sentence because it is drawn under a row on
 * the panel and on the plugin's own page, beside the failures a plugin's own
 * `apply` produces. It is CORE's sentence here, unlike those: what is wrong is
 * the shape of the folder, which is olai's vocabulary and not the author's.
 */
export interface Defined {
  /** The word — the folder's name, and the row's `id`. */
  readonly name: string
  /** The folder, with its trailing slash. */
  readonly folder: string
  /** What a person calls it: the README's first heading, or the word. */
  readonly title: string
  /** One sentence: the README's first paragraph, or empty. */
  readonly description: string
  /** The README verbatim, or `null` for a folder with none. */
  readonly readme: string | null
  /**
   * The two halves' sources, verbatim. `browser` is absent for a plugin with
   * no face — a server-only plugin is a whole plugin (a kind, a doorbell), the
   * same way an engine is a browser-only one.
   */
  readonly server: string
  readonly browser: string | null
  /** THE VERSION: a content hash of both halves. What a person approves, and
   *  what tells an edit from a redraw. The README is NOT in it: fixing a typo
   *  in the prose is not a fresh decision about code. */
  readonly version: string
  /** What the `approved` property says, verbatim — the version, {@link ALWAYS},
   *  or `null` for a plugin nobody has decided about. */
  readonly approved: string | null
  /** Whether the person's switch is up. A folder with no settings node is OFF:
   *  consent does not travel with a copied folder. */
  readonly on: boolean
  /** The conversation building this plugin, where one is bound. */
  readonly builder: string | null
  /** What the code reaches for, read off its own imports. */
  readonly uses: ReadonlyArray<Uses>
  /** This plugin's node in the settings file and the file's nodes, for the
   *  knob reader and for every write this row makes about consent. `node` is
   *  absent until something writes one. */
  readonly settings: {
    readonly file: string | undefined
    readonly node: Located | undefined
    readonly nodes: ReadonlyArray<Located>
  }
  /** Why this definition cannot be built, in a whole sentence, or `null`. */
  readonly fault: string | null
}

/** Whether a version of this definition is the one a person said yes to. */
export const isApproved = (one: Defined): boolean =>
  one.approved === ALWAYS || (one.approved !== null && one.approved === one.version)

/**
 * EVERY PLUGIN THIS VAULT DEFINES, in folder order.
 *
 * `taken` is the words this BUILD already has — the bundle's rows. A folder
 * that claims one of them is a fault rather than an override: the roster is
 * keyed by the word, the slot table and the `LocalState` records are keyed by
 * the word, and a vault that could rename a compiled-in plugin out of existence
 * would be the vault deciding what the host runs, which is the one thing every
 * ruling in this lane refuses.
 *
 * TWO FOLDERS CANNOT CLAIM ONE WORD, which is a guarantee the shape now keeps
 * for free: the word IS the folder's name, and a directory holds one entry per
 * name. The old reading had to refuse a word two nodes carried, because a
 * property is not an identity.
 */
export const definedIn = (
  reading: Reading,
  taken: ReadonlyArray<string>,
): ReadonlyArray<Defined> => {
  const settings = configurationNodes(reading)
  const folders = new Map<string, Map<string, string>>()
  for (const document of reading.set.documents) {
    if (!document.path.startsWith(PLUGIN_FOLDER)) continue
    const rest = document.path.slice(PLUGIN_FOLDER.length)
    const cut = rest.indexOf("/")
    // A FILE DIRECTLY UNDER `plugins/` IS NOT A PLUGIN, and neither is one
    // nested deeper: the folder is the plugin, so `plugins/notes.md` and
    // `plugins/hex-swatch/src/helper.ts` are ordinary vault content that
    // nothing here claims.
    if (cut <= 0) continue
    const word = rest.slice(0, cut)
    const name = rest.slice(cut + 1)
    if (name !== PLUGIN_README_FILE && name !== PLUGIN_SERVER_FILE && name !== PLUGIN_BROWSER_FILE) continue
    // Only a kept-text document carries its body in the revision; an unkept
    // claim would hand back a face with nothing in it.
    if (!isMarkdown(document)) continue
    const held = folders.get(word) ?? new Map<string, string>()
    held.set(name, document.body)
    folders.set(word, held)
  }
  return [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([word, files]) => defined(word, files, settings, taken))
}

/** The settings file as this reading found it — the whole of what consent is
 *  read out of, named here rather than inferred off the walk that builds it. */
export interface Consent {
  readonly file: string | undefined
  readonly nodes: ReadonlyArray<Located>
}

/** One folder, read. */
const defined = (
  name: string,
  files: ReadonlyMap<string, string>,
  settings: Consent,
  taken: ReadonlyArray<string>,
): Defined => {
  const server = files.get(PLUGIN_SERVER_FILE) ?? null
  const browser = files.get(PLUGIN_BROWSER_FILE) ?? null
  const readme = files.get(PLUGIN_README_FILE) ?? null
  const node = configurationNode(settings.nodes, name)
  const said = (key: string): string | null => {
    const raw = node === undefined || !isRegular(node) ? undefined : customText(node.node, key)
    const trimmed = (raw ?? "").trim()
    return trimmed === "" ? null : trimmed
  }
  const told = toldBy(readme)
  return {
    name,
    folder: `${PLUGIN_FOLDER}${name}/`,
    title: told.title === "" ? name : told.title,
    description: told.description,
    readme,
    server: server ?? "",
    browser,
    version: versionOf(server ?? "", browser),
    approved: said(APPROVED_KEY),
    on: said(ON_KEY) === "yes",
    builder: said(BUILDER_KEY),
    uses: usesOf(server ?? "", browser),
    settings: { file: settings.file, node, nodes: settings.nodes },
    fault: faultOf(name, server, taken),
  }
}

/**
 * WHAT THE README SAYS THIS IS — the title a person reads and the one sentence
 * under it.
 *
 * `# Title`, then a blank line, then one sentence: the shape the authoring
 * guide asks for and the shape the builder is told to write. What this does
 * with a README that is not that shape is take what it can — a first heading at
 * any level, the first paragraph that is not a heading — because a person's own
 * prose is not a format to refuse.
 */
export const toldBy = (readme: string | null): { readonly title: string; readonly description: string } => {
  if (readme === null) return { title: "", description: "" }
  let title = ""
  const paragraph: Array<string> = []
  for (const raw of readme.split("\n")) {
    const line = raw.trim()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading !== null) {
      if (title === "") title = heading[1]!.trim()
      if (paragraph.length > 0) break
      continue
    }
    if (line === "") {
      if (paragraph.length > 0) break
      continue
    }
    paragraph.push(line)
  }
  return { title, description: paragraph.join(" ") }
}

/** What is wrong with this folder, in the order a person can act on it. */
const faultOf = (
  name: string,
  server: string | null,
  taken: ReadonlyArray<string>,
): string | null => {
  if (!WORD.test(name)) {
    return `"${name}" is not a plugin word, so the folder \`${PLUGIN_FOLDER}${name}/\` defines `
      + `nothing. A word is lowercase letters, digits and hyphens, starting with a letter — it `
      + `is the row's name, the key its members reach the wire under, and the address of its `
      + `own page. Rename the folder.`
  }
  if (taken.includes(name)) {
    return `this build already has a plugin called "${name}", so a folder in the vault `
      + `cannot take that word. Rename the folder.`
  }
  if (server === null || server.trim() === "") {
    return `this plugin has no \`${PLUGIN_SERVER_FILE}\`: put the server half in `
      + `\`${PLUGIN_FOLDER}${name}/${PLUGIN_SERVER_FILE}\`. A \`${PLUGIN_BROWSER_FILE}\` `
      + `beside it is optional.`
  }
  return null
}

/** What {@link versionOf} puts between the two halves — a byte no source file
 *  can contain, spelled as an escape so this file holds none itself. */
const SEPARATOR = "\u0000"

/**
 * THE VERSION — a hash of what would run.
 *
 * BOTH HALVES, because approval is about the whole thing: a person who read a
 * server half and approved it has not approved a face that arrived afterwards.
 * The separator is a byte no source can contain, so two plugins cannot hash
 * alike by having their halves cut at a different point.
 *
 * AND THE README IS NOT IN IT. The version is what a person said yes to, and
 * what they said yes to is code. Prose about the code is prose: an author
 * fixing a sentence in the README must not put a running plugin back to
 * pending, because nothing that runs has changed.
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
