import { expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const PLUGINS_ROOT = join(import.meta.dir, "../../plugins")

interface EnvDecl {
  readonly key: string
  readonly secret: boolean
  readonly says: string
}

type ManifestKnobs = Readonly<Record<string, Record<string, unknown>>>

function parseEnvironment(source: string, dir: string): EnvDecl[] {
  const match = /\benvironment:\s*\[([\s\S]*?)\]/.exec(source)
  if (!match) return []
  const body = match[1]
  if (body === undefined) return []
  const singleLine = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("},"))
    .map((line) => JSON.parse(line.replace(/,\s*$/, "")) as EnvDecl)
  if (singleLine.length > 0) return singleLine
  const entries: EnvDecl[] = []
  const blockRe = /\{([\s\S]*?)\s*\}/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(body)) !== null) {
    const text: string = m[1] ?? ""
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

function resolveDoor(ref: string, prop: string, dir: string): string | undefined {
  const doorsPath = join(PLUGINS_ROOT, dir, "src", "doors.ts")
  if (!existsSync(doorsPath)) return undefined
  const source = readFileSync(doorsPath, "utf8")
  const mapMatch = new RegExp(`export\\s+const\\s+${ref}\\s*=\\s*\\{([^}]+)\\}`).exec(source)
  if (!mapMatch) return undefined
  const entryMatch = new RegExp(`\\b${prop}:\\s*"([^"]+)"`).exec(mapMatch[1]!)
  return entryMatch?.[1]
}



const pluginDirs = readdirSync(PLUGINS_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

test("every plugin's olai.knobs equals the executable resources its server declares", () => {
  for (const dir of pluginDirs) {
    const pkgPath = join(PLUGINS_ROOT, dir, "package.json")
    const serverPath = join(PLUGINS_ROOT, dir, "src", "server.ts")
    if (!existsSync(pkgPath)) continue

    const manifest = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      olai?: { knobs?: ManifestKnobs }
    }
    const knobs = manifest.olai?.knobs ?? {}
    const knobKeys = Object.keys(knobs).sort()

    if (!existsSync(serverPath)) {
      expect(
        knobKeys,
        `plugin "${dir}" declares olai.knobs ${JSON.stringify(knobKeys)} but has no src/server.ts`,
      ).toEqual([])
      continue
    }

    const environmentKeys = parseEnvironment(readFileSync(serverPath, "utf8"), dir)
      .map((e) => e.key)
    const environmentSet = new Set(environmentKeys)

    for (const [key, kind] of Object.entries(knobs)) {
      expect(
        kind.kind === "file" || kind.kind === "dir",
        `plugin "${dir}" declares a knob with kind ${JSON.stringify(kind.kind)}; every olai.knobs value is "file" or "dir"`,
      ).toBe(true)
      expect(
        environmentSet.has(key),
        `plugin "${dir}" declares olai.knobs.${key} with kind "${kind.kind}" but its server environment does not name it`,
      ).toBe(true)
    }
  }
})