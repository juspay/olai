import { askStdioMcp, type Verdict } from "@olai/plugin-kit/stdio-mcp"
import { accessSync, constants } from "node:fs"
import { delimiter, join } from "node:path"

import { Effect, type Scope } from "effect"

export interface StdioServer {
  readonly name: string
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
}

export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

export type Probed =
  | { readonly server: StdioServer; readonly missing: null }
  | { readonly server: null; readonly missing: NotHere }

export const ODU_COMMAND = "odu"

const ARGS = ["mcp"] as const

const VERBS = {
  run_start: "checkout",
  run_retry: "runId",
  run_cancel: "runId",
  run_wait: "runId",
  venue_hold: "checkout",
  venue_release: "checkout",
} as const

const VERB_NAMES = Object.keys(VERBS) as ReadonlyArray<keyof typeof VERBS>

const DEADLINE_MS = 20_000

const resolveOn = (path: string | undefined): string | null => {
  if (path === undefined) return null
  for (const entry of path.split(delimiter)) {
    if (entry === "") continue
    const candidate = join(entry, ODU_COMMAND)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

const NOT_FOUND = `no \`${ODU_COMMAND}\` is on the PATH this server was started with`
  + " — a packaged olai carries one"

export const probing = (
  path: string | undefined,
): Effect.Effect<Probed, never, Scope.Scope> =>
  Effect.gen(function*() {
    const found = resolveOn(path)
    if (found === null) return { server: null, missing: { name: ODU_COMMAND, where: null, why: NOT_FOUND } }

    const verdict = yield* askStdioMcp({ command: found, args: ARGS, timeout: DEADLINE_MS })

    if (verdict._tag !== "answered") {
      return { server: null, missing: { name: ODU_COMMAND, where: found, why: whyOf(verdict) } }
    }
    const names = new Set(verdict.tools.map((tool) => tool.name))
    const absent = VERB_NAMES.filter((verb) => !names.has(verb))
    if (absent.length > 0) {
      return {
        server: null,
        missing: {
          name: ODU_COMMAND,
          where: found,
          why: `it answers, but its tool surface is missing ${absent.map((one) => `\`${one}\``).join(", ")}`
            + ` — this olai hands a conversation ${VERB_NAMES.map((one) => `\`${one}\``).join(", ")},`
            + " and one of the two needs an upgrade",
        },
      }
    }
    const aimless = VERB_NAMES.find((verb) => {
      const tool = verdict.tools.find((one) => one.name === verb)
      return tool !== undefined && !tool.inputs.includes(VERBS[verb])
    })
    if (aimless !== undefined) {
      return {
        server: null,
        missing: {
          name: ODU_COMMAND,
          where: found,
          why: `it answers, but \`${aimless}\` takes no \`${VERBS[aimless]}\``
            + " — a conversation spans many lanes, and this build could only ever aim at olai's own served directory;"
            + " one of the two needs an upgrade",
        },
      }
    }
    return {
      server: { name: ODU_COMMAND, command: found, args: [...ARGS], env: {} },
      missing: null,
    }
  })

const whyOf = (verdict: Exclude<Verdict, { _tag: "answered" }>): string => {
  switch (verdict._tag) {
    case "couldNotStart":
      return `it could not be started: ${verdict.cause}`
    case "timedOut":
      return `it did not answer within ${verdict.deadlineMs / 1000}s`
    case "closed":
      return "it closed the connection without answering"
    case "failed":
      return `talking to it failed: ${verdict.cause}`
  }
}
