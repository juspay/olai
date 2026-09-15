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

/** Read the `environment:` array's object literals out of a `server.ts`. */
function parseEnvironment(source: string): EnvDecl[] {
  const match = source.match(/\benvironment:\s*\[([\s\S]*?)\]/)
  if (!match) return []
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line.replace(/,\s*$/, "")) as EnvDecl)
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
  return !/(origin|to reach|containing|socket|credential)/i.test(entry.says)
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
        const resourceKeys = parseEnvironment(readFileSync(serverPath, "utf8"))
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

    const resourceKeys = parseEnvironment(readFileSync(serverPath, "utf8"))
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