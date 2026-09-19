import { accessSync, constants, statSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { Effect, type Scope } from "effect"
import type { Probed } from "@olai/plugin-api"
import { askStdioMcp } from "@olai/plugin-kit/stdio-mcp"

export const REQUIRED_TOOLS = [
  "browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot",
] as const

/** A fresh reading for each conversation; the scope owns only the probe child.
 * ACP starts its own server from the exact executable that answered. */
export const probing = (
  env: Record<string, string | undefined>,
  output: string,
  timeout = 5_000,
): Effect.Effect<Probed, never, Scope.Scope> => Effect.suspend(() => {
  const command = env["OLAI_BROWSER_MCP"]?.trim()
  const missing = (why: string): Probed => ({
    server: null, missing: { name: "browser", where: command || null, why },
  })
  return Effect.gen(function*() {
    // Empty overrides deliberately disable the packaged executable, like engine knobs.
    if (!command) return { server: null, missing: null }
    const executable = yield* Effect.try(() => {
      if (!isAbsolute(command) || !statSync(command).isFile()) throw new Error("not an absolute executable file")
      accessSync(command, constants.X_OK)
      return true
    }).pipe(Effect.catch(() => Effect.succeed(false)))
    if (!executable) {
      return missing("Browser tools are unavailable because OLAI_BROWSER_MCP does not name an absolute executable file.")
    }
    // Interrogation never opens a page or requests artifacts. Give the disposable
    // child no output path; only a compatible answer claims a conversation dir.
    const args = ["--headless", "--isolated"]
    // Read the environment through the declared Env service, unlike the legacy
    // PATH-only discovery contract of other callers of the transport.
    const verdict = yield* askStdioMcp({ command, args, env, timeout })
    const detail = verdict.stderr.trim() ? ` Executable stderr: ${verdict.stderr.trim()}` : ""
    switch (verdict._tag) {
      case "couldNotStart": return missing(`Browser tools could not start: ${verdict.cause}.${detail}`)
      case "timedOut": return missing(`Browser tools did not answer MCP within ${verdict.deadlineMs / 1000} seconds.${detail}`)
      case "closed": return missing(`Browser tools closed the MCP connection without answering.${detail}`)
      case "failed": return missing(`Browser tools did not speak the expected MCP protocol: ${verdict.cause}.${detail}`)
    }
    const names = new Set(verdict.tools.map(tool => tool.name))
    const absent = REQUIRED_TOOLS.filter(name => !names.has(name))
    if (absent.length) return missing(`Browser tools need a compatible Playwright MCP build; its tool list is missing ${absent.join(", ")}.`)
    const directory = yield* Effect.uninterruptible(Effect.promise(() => mkdtemp(join(output, "conversation-"))))
    return { server: { name: "browser", command, args: [...args, "--output-dir", directory], env: {} }, missing: null }
  }).pipe(Effect.catchDefect(defect => Effect.succeed(
    missing(`Browser tools could not be prepared: ${String(defect)}.`),
  )))
})
