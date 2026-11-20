import {
  customText,
  type Located,
  type Reading,
  isRegular,
} from "@olai/format"
import { configurationNode, configurationNodes } from "@olai/plugin-api/configuration"
import {
  PLUGIN_BROWSER_FILE,
  PLUGIN_FILES,
  PLUGIN_FOLDER,
  PLUGIN_README_FILE,
  PLUGIN_SERVER_FILE,
  WORD,
} from "@olai/surface"
import { isKeptText, proseIn } from "@olai/format"

import { usesOf, type Uses } from "./uses.ts"

export { PLUGIN_BROWSER_FILE, PLUGIN_FOLDER, PLUGIN_README_FILE, PLUGIN_SERVER_FILE }

export const APPROVED_KEY = "approved"
export const ON_KEY = "on"

export const CHECKED_KEY = "checked"

export const ALWAYS = "always"

export interface Defined {
  readonly name: string
  readonly folder: string
  readonly title: string
  readonly description: string
  readonly readme: string | null
  readonly server: string
  readonly browser: string | null
  readonly version: string
  readonly approved: string | null
  readonly on: string | null
  readonly checked: string | null
  readonly uses: ReadonlyArray<Uses>
  readonly consent: {
    readonly file: string | undefined
    readonly node: Located | undefined
    readonly nodes: ReadonlyArray<Located>
  }
  readonly fault: string | null
  readonly holds: ReadonlyArray<string>
}

export const isApproved = (one: Defined): boolean =>
  one.approved === ALWAYS || (one.approved !== null && one.approved === one.version)

export const isOn = (one: Defined): boolean => one.on === "yes"

export const isBuilding = (one: Defined, chat: boolean): boolean =>
  chat
  && one.approved === null
  && (one.server.trim() === "" || one.checked !== one.version)

export type Decides = "approve" | "trust" | "untrust"

export interface Refusal {
  readonly kind: "moved" | "usage"
  readonly reason: string
}

export const refusalFor = (one: Defined, decides: Decides, version: string): Refusal | null => {
  if (one.version !== version) {
    return {
      kind: "moved",
      reason: `"${one.name}" has been edited since this page drew it, so approving `
        + `it now would approve source nobody has read. Look again, read what `
        + `it says, and approve that.`,
    }
  }
  if (decides === "untrust") {
    return one.approved === ALWAYS ? null : {
      kind: "usage",
      reason: `"${one.name}" is not trusting changes, so there is nothing to stop: `
        + `its approval names one version.`,
    }
  }
  if (one.fault !== null) {
    return { kind: "usage", reason: `"${one.name}" cannot run as it stands: ${one.fault}` }
  }
  return null
}

export const definedIn = (
  reading: Reading,
  taken: ReadonlyArray<string>,
): ReadonlyArray<Defined> => {
  const consent = configurationNodes(reading)
  const folders = new Map<string, Map<string, string>>()
  for (const document of reading.set.documents) {
    if (!document.path.startsWith(PLUGIN_FOLDER)) continue
    const rest = document.path.slice(PLUGIN_FOLDER.length)
    const cut = rest.indexOf("/")
    if (cut <= 0) continue
    const word = rest.slice(0, cut)
    const name = rest.slice(cut + 1)
    if (!PLUGIN_FILES.some((held) => held === name)) continue
    if (!isKeptText(document)) continue
    const held = folders.get(word) ?? new Map<string, string>()
    held.set(name, document.body)
    folders.set(word, held)
  }
  return [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([word, files]) => defined(word, files, consent, taken))
}

export interface Consent {
  readonly file: string | undefined
  readonly nodes: ReadonlyArray<Located>
}

const defined = (
  name: string,
  files: ReadonlyMap<string, string>,
  consent: Consent,
  taken: ReadonlyArray<string>,
): Defined => {
  const server = files.get(PLUGIN_SERVER_FILE) ?? null
  const browser = files.get(PLUGIN_BROWSER_FILE) ?? null
  const readme = files.get(PLUGIN_README_FILE) ?? null
  const node = configurationNode(consent.nodes, name)
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
    on: said(ON_KEY),
    checked: said(CHECKED_KEY),
    uses: usesOf(server ?? "", browser),
    consent: { file: consent.file, node, nodes: consent.nodes },
    fault: faultOf(name, server, taken),
    holds: [...files.keys()],
  }
}

export const toldBy = (readme: string | null): { readonly title: string; readonly description: string } => {
  if (readme === null) return { title: "", description: "" }
  let title = ""
  const paragraph: Array<string> = []
  for (const raw of proseIn(readme).split("\n")) {
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

const SEPARATOR = "\u0000"

export const versionOf = (server: string, browser: string | null): string =>
  new Bun.CryptoHasher("sha256")
    .update(server)
    .update(SEPARATOR)
    .update(browser ?? "")
    .digest("hex")
    .slice(0, 16)
