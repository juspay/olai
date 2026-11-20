import { Data, Effect } from "effect"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"

export const runtimeHome = (): string => {
  const xdg = process.env["XDG_RUNTIME_DIR"]
  return xdg !== undefined && xdg !== ""
    ? join(xdg, "olai")
    : `/tmp/olai-${process.getuid?.() ?? "shared"}`
}

export const stateHome = (): string => {
  const set = process.env["XDG_STATE_HOME"]
  return join(
    set !== undefined && set !== "" ? set : join(homedir(), ".local", "state"),
    "olai",
  )
}

export const digestOf = (cwd: string): string =>
  createHash("sha256").update(cwd).digest("hex").slice(0, 16)

export const canonical = (root: string): string => {
  try {
    return fs.realpathSync(resolve(root))
  } catch {
    return resolve(root)
  }
}

export class StateFailure extends Data.TaggedError("StateFailure")<{
  readonly why: string
}> {
  override get message(): string {
    return this.why
  }
}

export const fileForLocal = (plugin: string, cwd: string): string => {
  if (plugin.length === 0 || /[^\w.-]/.test(plugin)) {
    throw new Error(`local state: plugin name ${JSON.stringify(plugin)} is not a filename`)
  }
  return join(stateHome(), plugin, `${digestOf(cwd)}.json`)
}

export const directoryForLocal = (plugin: string, cwd: string): string =>
  fileForLocal(plugin, cwd).slice(0, -".json".length)

export const LOCAL_DIRECTORY_MARK = ".olai-cwd"

export const openLocalDirectory = (
  at: string,
  cwd: string,
): Effect.Effect<string, StateFailure> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(at, { recursive: true, mode: 0o700 })
      await chmod(dirname(at), 0o700)
      await chmod(at, 0o700)
      const mark = join(at, LOCAL_DIRECTORY_MARK)
      let held: string | null = null
      try {
        held = await readFile(mark, "utf8")
      } catch (cause) {
        if ((cause as { readonly code?: unknown }).code !== "ENOENT") throw cause
      }
      if (held === null) await writeFile(mark, `${cwd}\n`, { mode: 0o600 })
      else if (held.trim() !== cwd) {
        throw new Error(`it belongs to ${JSON.stringify(held.trim())}, not this served directory`)
      }
      return at
    },
    catch: (cause) =>
      new StateFailure({ why: `\`${at}\` could not be opened: ${reasonOf(cause)}` }),
  })

export interface LocalRecord {
  readonly cwd: string
}

export const readLocal = (
  at: string,
  cwd: string,
): Effect.Effect<Record<string, unknown> | null, StateFailure> =>
  Effect.flatMap(
    Effect.tryPromise({
      try: async (): Promise<string | null> => {
        try {
          return await readFile(at, "utf8")
        } catch (cause) {
          if ((cause as { readonly code?: unknown }).code === "ENOENT") return null
          throw cause
        }
      },
      catch: (cause) =>
        new StateFailure({ why: `\`${at}\` could not be read: ${reasonOf(cause)}` }),
    }),
    (text) =>
      text === null ? Effect.succeed(null) : Effect.map(
        Effect.try({
          try: () => JSON.parse(text) as unknown,
          catch: (cause) =>
            new StateFailure({
              why: `\`${at}\` is not readable JSON: ${reasonOf(cause)}`,
            }),
        }),
        (value) => {
          const local = value as (Partial<LocalRecord> & Record<string, unknown>) | null
          return local?.cwd === cwd ? local : null
        },
      ),
  )

let staging = 0

export const writeLocal = (
  at: string,
  local: LocalRecord & Record<string, unknown>,
): Effect.Effect<void, StateFailure> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(at), { recursive: true, mode: 0o700 })
      const staged = `${at}.${process.pid}.${++staging}.tmp`
      try {
        await writeFile(staged, `${JSON.stringify(local)}\n`, { mode: 0o600 })
        await rename(staged, at)
      } catch (cause) {
        await rm(staged, { force: true })
        throw cause
      }
    },
    catch: (cause) =>
      new StateFailure({ why: `\`${at}\` could not be written: ${reasonOf(cause)}` }),
  })

export const pruneGone = (): number => {
  const home = stateHome()
  let tenants: ReadonlyArray<fs.Dirent>
  try {
    tenants = fs.readdirSync(home, { withFileTypes: true })
  } catch {
    return 0
  }
  let pruned = 0
  for (const tenant of tenants) {
    if (!tenant.isDirectory()) continue
    const dir = join(home, tenant.name)
    let names: ReadonlyArray<string>
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (name.endsWith(".json")) {
        if (goneRecord(join(dir, name))) pruned += 1
      } else if (goneDirectory(join(dir, name))) pruned += 1
    }
  }
  return pruned
}

const goneRecord = (at: string): boolean => {
  let held: unknown
  try {
    held = JSON.parse(fs.readFileSync(at, "utf8"))
  } catch {
    return false
  }
  const cwd = (held as { readonly cwd?: unknown } | null)?.cwd
  if (typeof cwd !== "string" || cwd === "" || !isAbsolute(cwd)) return false
  try {
    fs.statSync(cwd)
    return false
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code !== "ENOENT") return false
  }
  try {
    fs.unlinkSync(at)
    return true
  } catch {
    return false
  }
}

const goneDirectory = (at: string): boolean => {
  let cwd: string
  try {
    if (!fs.lstatSync(at).isDirectory()) return false
    cwd = fs.readFileSync(join(at, LOCAL_DIRECTORY_MARK), "utf8").trim()
  } catch {
    return false
  }
  if (cwd === "" || !isAbsolute(cwd)) return false
  try {
    fs.statSync(cwd)
    return false
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code !== "ENOENT") return false
  }
  try {
    fs.rmSync(at, { recursive: true })
    return true
  } catch {
    return false
  }
}

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
