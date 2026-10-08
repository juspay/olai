import { mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Result, type Scope } from "effect"
import type { Probed, StdioServer } from "@olai/plugin-api"
import { isExecutable } from "./chromium.ts"
import type { Attach } from "./live.ts"
import { BROWSER_PATH } from "./wire.ts"
import { askStdioMcp, type Verdict } from "@olai/plugin-kit/stdio-mcp"

export const REQUIRED_TOOLS = [
  "browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot",
] as const

/** One conversation's own output directory, claimed only once its server is
 *  certain to be handed over. */
const claim = (output: string) => Effect.uninterruptible(Effect.promise(() => mkdtemp(join(output, "conversation-"))))

/** Product judgement has no process or filesystem lifetime. A compatible
 * surface is null; every other answer is the complete sentence chat displays. */
export const whyOf = (verdict: Verdict): string | null => {
  const detail = verdict.stderr.trim() ? ` Executable stderr: ${verdict.stderr.trim()}` : ""
  switch (verdict._tag) {
    case "couldNotStart": return `Browser tools could not start: ${verdict.cause}.${detail}`
    case "timedOut": return `Browser tools did not answer MCP within ${verdict.deadlineMs / 1000} seconds.${detail}`
    case "closed": return `Browser tools closed the MCP connection without answering.${detail}`
    case "failed": return `Browser tools did not speak the expected MCP protocol: ${verdict.cause}.${detail}`
  }
  const names = new Set(verdict.tools.map(tool => tool.name))
  const absent = REQUIRED_TOOLS.filter(name => !names.has(name))
  if (absent.length) return `Browser tools need a compatible Playwright MCP build; its tool list is missing ${absent.join(", ")}.`
  return null
}

/** Where the handed-over MCP attaches: olai's own browser, launched on
 *  demand. `null` is a serve with no Chromium configured, which keeps the
 *  isolated browser each MCP launches for itself. */
export type Attaching = Effect.Effect<Attach, { readonly says: string }> | null

/**
 * THE HANDED-OVER SERVER, attached to olai's browser.
 *
 * `--cdp-endpoint` makes the MCP a guest in that browser's default context:
 * every conversation shares the person's cookies and opens its own pages.
 * The ENV is set deliberately rather than inherited: the pinned Nix wrapper
 * exports `PLAYWRIGHT_MCP_ISOLATED=1` whenever `PLAYWRIGHT_MCP_USER_DATA_DIR`
 * is empty, and 0.0.76 honours that flag even over CDP by opening a NEW
 * context — a cookie jar of its own, which is the opposite of the point. So
 * the user data dir names the profile the browser is really serving, and
 * isolation is refused by name.
 */
export const attachedServer = (command: string, endpoint: string, profile: string, directory: string): StdioServer => ({
  name: "browser",
  command,
  args: ["--cdp-endpoint", endpoint, "--output-dir", directory],
  env: { PLAYWRIGHT_MCP_USER_DATA_DIR: profile, PLAYWRIGHT_MCP_ISOLATED: "false" },
})

/** A fresh reading for each conversation; the scope owns only the probe child.
 * ACP starts its own server from the exact executable that answered. */
export const probing = (
  env: Record<string, string | undefined>,
  output: string,
  timeout = 5_000,
  attaching: Attaching = null,
): Effect.Effect<Probed, never, Scope.Scope> => Effect.suspend(() => {
  const command = env["OLAI_BROWSER_MCP"]?.trim()
  const missing = (why: string): Probed => ({
    server: null, missing: { name: "browser", where: command || null, why },
  })
  return Effect.gen(function*() {
    // Empty overrides deliberately disable the packaged executable, like engine knobs.
    if (!command) return { server: null, missing: null }
    if (!isExecutable(command)) {
      return missing("Browser tools are unavailable because OLAI_BROWSER_MCP does not name an absolute executable file.")
    }
    // Interrogation never opens a page or requests artifacts. Give the disposable
    // child no output path; only a compatible answer claims a conversation dir.
    const args = ["--headless", "--isolated"]
    // Read the environment through the declared Env service, unlike the legacy
    // PATH-only discovery contract of other callers of the transport.
    const verdict = yield* askStdioMcp({ command, args, env, timeout })
    const why = whyOf(verdict)
    if (why !== null) return missing(why)
    if (attaching === null) {
      const directory = yield* claim(output)
      return { server: { name: "browser", command, args: [...args, "--output-dir", directory], env: {} }, missing: null, at: BROWSER_PATH }
    }
    // Only a compatible MCP launches the browser: a broken executable must
    // not cost a Chromium the person never sees used.
    const attached = yield* Effect.result(attaching)
    if (Result.isFailure(attached)) return missing(`Browser tools could not reach olai's browser: ${attached.failure.says}`)
    const directory = yield* claim(output)
    return { server: attachedServer(command, attached.success.endpoint, attached.success.profile, directory), missing: null, at: BROWSER_PATH }
  }).pipe(Effect.catchDefect(defect => Effect.succeed(
    missing(`Browser tools could not be prepared: ${String(defect)}.`),
  )))
})
