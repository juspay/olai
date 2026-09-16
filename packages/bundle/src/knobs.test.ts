/**
 * The manifest's `olai.knobs` and the plugin's own `./server` `environment`
 * are two spellings of the same fact — the executables the packaged wrapper
 * bakes as `--set-default` and splices onto PATH. This file holds them equal,
 * so a third reader (the Nix fold in `packages/bundle/default.nix`) never has
 * to guess which one is true.
 *
 * The `environment` list carries every variable a plugin reads, not only the
 * knob ones: so does its manifest, secrets and plain settings sit beside the
 * executables. Only the *executable resources* — the `OLAI_*`, non-`secret`
 * variables that name an adapter binary or a PATH-joined executable directory
 * — count against the knobs. A web origin, a server URL, a search path, a
 * socket or a credential is read through the same `environment` array and is
 * deliberately not a knob; the wrapper has nothing to default for it.
 */
import { expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const PLUGINS_ROOT = join(import.meta.dir, "../../plugins")

/** One `server.ts` `environment` entry. */
interface EnvDecl {
  readonly key: string
  readonly secret: boolean
  readonly says: string
}

/** The manifest's `olai.knobs` type. */
type ManifestKnobs = Readonly<Record<string, Record<string, unknown>>>

/** Read the `environment:` array's object literals out of a `server.ts`.
 *  Each entry MAY be written on one line (`{"key": "OLAI_…", …}`) or many
 *  (`{\n      key: DOOR.…,\n      …\n    }`); both parse. Multiline entries
 *  holding a REFERENCE for `key` (the mail plugin's `DOOR.…` is one) carry
 *  `keyRef` instead of `key`, which the caller forwards as TWO keys — the
 *  multiline form can only name knobs the manifest already declares, so the
 *  refusal the test hands back still names the plugin when the manifest is
 *  wrong, but the list of executable resources may be empty if every entry
 *  uses a door const. That mirrors the contract the manifest names anyway:
 *  the knob manifest is the source of truth; `environment:` only echoes it. */
function parseEnvironment(source: string, dir: string): EnvDecl[] {
  const match = /\benvironment:\s*\[([\s\S]*?)\]/.exec(source)
  if (!match) return []
  const body = match[1]
  if (body === undefined) return []
  // Single-line: every stripped line that starts with `{` is one entry.
  const singleLine = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("},"))
    .map((line) => JSON.parse(line.replace(/,\s*$/, "")) as EnvDecl)
  if (singleLine.length > 0) return singleLine
  // Multi-line: find balanced `{…}` blocks; entries may reference a constant
  // for `key` (e.g. `key: DOOR.himalaya`). Resolve `DOOR.xxx` by reading the
  // plugin's `doors.ts` for the exported constant's string value. An
  // unresolvable key is skipped — the test would have no knob to compare.
  const entries: EnvDecl[] = []
  const blockRe = /\{([\s\S]*?)\s*\}/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(body)) !== null) {
    const text: string = m[1] ?? ""
    // Try literal first, then constant reference.
    let key: string | undefined
    const litMatch = text.match(/\bkey:\s*"([^"]+)"/)
    if (litMatch) {
      key = litMatch[1]!
    } else {
      const refMatch = text.match(/\bkey:\s*(\w+)\.(\w+)/)
      if (refMatch) {
        key = resolveDoor(refMatch[1]!, refMatch[2]!, dir)
      }
    }
    if (!key) continue
    const secretMatch = text.match(/\bsecret:\s*(true|false)/)
    const saysMatch = text.match(/\bsays:\s*"([^"]*)"/)
    if (!saysMatch) continue
    entries.push({
      key,
      secret: secretMatch?.[1] === "true",
      says: saysMatch[1]!,
    })
  }
  return entries
}

/** Resolve a `DOOR.xxx` reference to its string value by reading the plugin's
 *  `src/doors.ts` for the exported constant map. */
function resolveDoor(ref: string, prop: string, dir: string): string | undefined {
  const doorsPath = join(PLUGINS_ROOT, dir, "src", "doors.ts")
  if (!existsSync(doorsPath)) return undefined
  const source = readFileSync(doorsPath, "utf8")
  // Look for the constant map: `export const DOOR = { ... }`
  const mapMatch = new RegExp(`export\\s+const\\s+${ref}\\s*=\\s*\\{([^}]+)\\}`).exec(source)
  if (!mapMatch) return undefined
  const entryMatch = new RegExp(`\\b${prop}:\\s*"([^"]+)"`).exec(mapMatch[1]!)
  return entryMatch?.[1]
}

/** Is this environment entry an executable resource (a knob candidate)?
 *
 * A knob is a non-secret `OLAI_*` variable naming something the wrapper can
 * default — an adapter binary or an executable-spliced directory. URL
 * origins, server URLs, search paths, sockets and credentials are read
 * through the same array but are not executables, so they never count. */
function isExecutableResource(entry: EnvDecl): boolean {
  if (entry.secret) return false
  if (!/^OLAI_/.test(entry.key)) return false
  // Web origins, server URLs, search paths, sockets and credentials are not
  // executables; an `OLAI_*` non-secret variable that says it is one of those
  // is plain configuration, not a knob.
  return !/(origin|to reach|containing|socket|credential|oauth|client id|application)/i.test(entry.says)
}

/** The plugin directories of the tree, each with the plugin's own name. */
const pluginDirs = readdirSync(PLUGINS_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

test("every plugin's olai.knobs equals the executable resources its server declares", () => {
  for (const dir of pluginDirs) {
    const pkgPath = join(PLUGINS_ROOT, dir, "package.json")
    const serverPath = join(PLUGINS_ROOT, dir, "src", "server.ts")
    if (!existsSync(pkgPath)) continue // not a package; nothing to hold honest

    const manifest = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      olai?: { knobs?: ManifestKnobs }
    }
    const knobs = manifest.olai?.knobs ?? {}
    const knobKeys = Object.keys(knobs).sort()

    // The package may declare knobs without shipping a server; it may not
    // declare them and say nothing about them in `environment`. Both are a
    // refusal that names the plugin.
    if (knobKeys.length === 0) {
      if (existsSync(serverPath)) {
        const resourceKeys = parseEnvironment(readFileSync(serverPath, "utf8"), dir)
          .filter(isExecutableResource)
          .map((e) => e.key)
          .sort()
        expect(
          resourceKeys,
          `plugin "${dir}" declares no olai.knobs but its server environment names executable resources ${JSON.stringify(resourceKeys)}`,
        ).toEqual([])
      }
      continue
    }

    // A plugin with knobs must ship the server that reads them.
    expect(
      existsSync(serverPath),
      `plugin "${dir}" declares olai.knobs ${JSON.stringify(knobKeys)} but has no src/server.ts`,
    ).toBe(true)

    const resourceKeys = parseEnvironment(readFileSync(serverPath, "utf8"), dir)
      .filter(isExecutableResource)
      .map((e) => e.key)
      .sort()

    // The manifest may not spell a knob the server does not also spell.
    for (const kind of Object.values(knobs)) {
      expect(
        kind.kind === "file" || kind.kind === "dir",
        `plugin "${dir}" declares a knob with kind ${JSON.stringify(kind.kind)}; every olai.knobs value is "file" or "dir"`,
      ).toBe(true)
    }

    expect(
      knobKeys,
      `plugin "${dir}": olai.knobs keys ${JSON.stringify(knobKeys)} do not equal the executable resources its server environment declares ${JSON.stringify(resourceKeys)}`,
    ).toEqual(resourceKeys)
  }
})