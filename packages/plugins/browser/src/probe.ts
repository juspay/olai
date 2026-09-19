import { accessSync, constants, statSync } from "node:fs"
import { isAbsolute } from "node:path"
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
): Effect.Effect<Probed, never, Scope.Scope> => Effect.gen(function*() {
  const command = env["OLAI_BROWSER_MCP"]?.trim()
  const missing = (why: string): Probed => ({
    server: null, missing: { name: "browser", where: command || null, why },
  })
  // Empty overrides deliberately disable the packaged executable, like engine knobs.
  if (!command) return { server: null, missing: null }
  try {
    if (!isAbsolute(command) || !statSync(command).isFile()) throw new Error("not an absolute executable file")
    accessSync(command, constants.X_OK)
  } catch {
    return missing("Browser tools are unavailable because OLAI_BROWSER_MCP does not name an absolute executable file.")
  }
  const args = ["--headless", "--isolated", "--output-dir", output]
  const verdict = yield* askStdioMcp({ command, args, env, timeout })
  switch (verdict._tag) {
    case "couldNotStart": return missing(`Browser tools could not start: ${verdict.cause}.`)
    case "timedOut": return missing(`Browser tools did not answer MCP within ${verdict.deadlineMs / 1000} seconds.`)
    case "closed": return missing("Browser tools closed the MCP connection without answering.")
    case "failed": return missing(`Browser tools did not speak the expected MCP protocol: ${verdict.cause}.`)
  }
  const names = new Set(verdict.tools.map(tool => tool.name))
  const absent = REQUIRED_TOOLS.filter(name => !names.has(name))
  if (absent.length) return missing(`Browser tools need a compatible Playwright MCP build; its tool list is missing ${absent.join(", ")}.`)
  return { server: { name: "browser", command, args, env: {} }, missing: null }
})
