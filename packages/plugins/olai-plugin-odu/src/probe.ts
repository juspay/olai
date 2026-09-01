/**
 * IS ODU'S `mcp` HERE — and, when it is not and a conversation would have
 * been handed it anyway, the sentence a person is owed about it.
 *
 * ## The division this file IS: the subprocess supplies the evidence, olai
 * the judgement
 *
 * `olai-plugin-kolu`'s `./probe.ts` argues the shape at full length, and every
 * ruling in it carries unchanged: resolve the binary on the PATH the session's
 * OWN spawn will use, start it, speak the protocol, and ask it a question
 * only the right build answers. **Nothing here trusts a path or a version
 * string**: an `odu` that lies on PATH without being one is not this host's,
 * and the map of what that looks like in practice is kolu's two incidents —
 * a stale bundled build answering with the same version string
 * (juspay/kolu#2146), and a server listing every tool with nothing behind it
 * (juspay/kolu#2148).
 *
 * What the question IS differs, and the difference is this package's whole
 * reason. Kolu asks a server for a cell only a live padi can answer, because
 * the daemon is what could be absent. odu's `mcp` BEARS no daemon — what
 * could be absent is the SHAPE this olai was written against: a conversation
 * spans many lanes, so the verbs must take a per-call `checkout` (the
 * checkout-targeting shape, juspay/odu's agent lane — an `mcp` older than it
 * binds olai's own directory and every call a lane asked for lands on olai's
 * served root instead, which is worse than no tools at all). So the round
 * trip is `initialize` + `tools/list`, and the check reads the answer.
 *
 * ## Where the MCP chatter lives, and why it is this file
 *
 * kolu's probe rides `@kolu/detect` — a library kolu ships. No odu package
 * vendored here speaks `odu mcp`'s transport (`@odu/run-client` is the half a
 * CLIENT of a live run holds, and this probe is not one). The plumbing is
 * therefore HERE, as small as the protocol allows: newline-delimited JSON-RPC
 * on the child's pipes, two requests, one notification, done. It is written
 * collocated with the judgement rather than in `@olai/odu-client` because the
 * one thing that makes this probe odu's — WHICH tools must exist and that
 * they take `checkout` — is this plugin's expectation of the shape, and the
 * two halves that exist on kolu's side answer two questions on this one.
 *
 * ## Why it is on the `./server` door and not on the manifest
 *
 * It starts a subprocess, and the manifest is the door the BROWSER opens —
 * `olai-plugin-kolu`'s `./probe.ts` argues both why that is the rule and why
 * it is on this door.
 */

import { spawn, type ChildProcess } from "node:child_process"
import { accessSync, constants } from "node:fs"
import { delimiter, join } from "node:path"

/**
 * AN MCP SERVER TO HAND A SESSION, and what a person is owed about one they
 * did not get — this package's own spelling of the two shapes core carries.
 *
 * Re-declared here rather than imported, for the exact cycle
 * `olai-plugin-kolu`'s `./probe.ts` argues: `@olai/plugin-api` imports THIS
 * package, so an import back is a shape the manifests could not express. The
 * fit is proved at the registry, by `satisfies`.
 */
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/** ...and the other half. `where` is never `null` here: the one way an odu
 *  can BE expected and fail is by having been resolved and started, and a
 *  `where` is the first thing that path takes. `why` is a WHOLE SENTENCE and
 *  it is this package's — core displays it and never composes one. */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/** WHAT THE PROBE FOUND — both halves at once, because they are one reading:
 *  a caller that asked once for the entry to hand over and again for the
 *  sentence would start `odu` twice per conversation and could answer the two
 *  questions about two different moments. */
export interface Probed {
  /** The server to hand a session, or `null` where there is none to hand. */
  readonly server: StdioServer | null
  /** What a person is owed about the one they did not get, or `null` where an
   *  absence is the ordinary case and no fault. */
  readonly missing: NotHere | null
}

/** The command, spelled ONCE — the probe resolves it, the handed-over server
 *  runs it, and a sentence names it. */
export const ODU_COMMAND = "odu"

/** The one's argv — `odu mcp`. */
const ARGS = ["mcp"] as const

/**
 * THE VERBS A CONVERSATION IS PROMISED — the dispatch's own list: with these,
 * an agent can start a run, retry one node, stop one, wait, and hold a venue
 * across runs. An answer without them is not an answer to the question this
 * probe asks: presence is checked against THIS list and nothing wider, so a
 * NEWER odu shipping more is a fine answer and this list never has to move
 * for it.
 */
const VERBS = ["run", "node_rerun", "node_cancel", "wait_for_settle", "lease", "release"] as const

/** odu's own `initialize` payload wants one — the newest one olai's tree
 *  carries (`@modelcontextprotocol/sdk`'s, one pin up). What the responder
 *  answers is its own business: the handshake is evidence that the protocol
 *  is spoken, not an assertion of a revision. */
const PROTOCOL = "2025-06-18"

/** The transport deadline, in milliseconds: cohort to kolu's own. A wedged
 *  `odu mcp` and an honest one reach distinction inside five seconds. */
const DEADLINE_MS = 5_000

// ── The evidence ────────────────────────────────────────────────────────

/**
 * WHAT ONE `odu mcp` CHILD ANSWERED, or the one way it failed to.
 *
 * A TAGGED UNION rather than a throw per way: the half that SAYS these to a
 * person is one function over the tags, and the whole point of the probe is
 * that the four ways of failing and the answer travel one channel so the
 * judgement is a fold and never a catch.
 */
export type Verdict =
  | {
    /** It spoke MCP well enough to answer both questions. `checkout` is
     *  per-call `checkout` on that tool's `inputSchema`, read at probe time. */
    readonly _tag: "answered"
    readonly tools: ReadonlyArray<{ readonly name: string; readonly checkout: boolean }>
  }
  /** The OS would not start it — the spawn call raised. */
  | { readonly _tag: "couldNotStart"; readonly cause: string }
  /** It never reached either answer inside the deadline. */
  | { readonly _tag: "timedOut"; readonly deadlineMs: number }
  /** Its pipes went away with no answer on them. */
  | { readonly _tag: "closed" }
  /** Writing to it, or parsing what came back, failed. */
  | { readonly _tag: "failed"; readonly cause: string }

/**
 * ASK ONE ALREADY-STARTED `odu mcp` — the two requests, with the deadline the
 * caller set.
 *
 * Exported for the reason `olai-plugin-kolu`'s `askOver` is: a wedged server
 * and one that hung up reach the same closed pipe, and only which verdict
 * comes back tells them apart — the case an integration test over {@link
 * probe} cannot afford to spend real seconds on, and the one a fixture
 * generator must reach for precisely.
 *
 * THE PROTOCOL: MCP's stdio transport is newline-DELIMITED JSON-RPC — one
 * message per line, no Content-Length wrapper. Two requests at a time is fine
 * because each holds an `id`, and a response's pairing with what it answers
 * is by id alone. `initialized` is a notification: no `id`, no answer.
 */
export const askOver = async (child: ChildProcess, deadlineMs: number): Promise<Verdict> => {
  const { stdout } = child
  if (child.stdin === null || stdout === null) {
    return { _tag: "couldNotStart", cause: "the child has no pipes to speak on" }
  }
  return await new Promise<Verdict>((resolve) => {
    let buffer = ""
    let done = false
    const tools: Array<{ name: string; checkout: boolean }> = []
    const finish = (verdict: Verdict): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(verdict)
    }
    const timer = setTimeout(() => finish({ _tag: "timedOut", deadlineMs }), deadlineMs)
    const send = (message: Record<string, unknown>): void => {
      try {
        child.stdin?.write(JSON.stringify(message) + "\n")
      } catch (thrown) {
        finish({ _tag: "failed", cause: String(thrown) })
      }
    }
    child.on("error", (thrown) => finish({ _tag: "couldNotStart", cause: String(thrown) }))
    child.on("exit", () => finish({ _tag: "closed" }))
    stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8")
      for (;;) {
        const at = buffer.indexOf("\n")
        if (at === -1) return
        const line = buffer.slice(0, at).trim()
        buffer = buffer.slice(at + 1)
        if (line === "") continue
        let message: Record<string, unknown>
        try {
          message = JSON.parse(line) as Record<string, unknown>
        } catch (thrown) {
          finish({ _tag: "failed", cause: `a line that is not JSON-RPC: ${String(thrown)}` })
          return
        }
        // A NOTIFICATION carries no id; say nothing back and carry on.
        if (message["id"] === undefined) continue
        if (message["error"] !== undefined) {
          finish({ _tag: "failed", cause: JSON.stringify(message["error"]) })
          return
        }
        if (message["id"] === 1) {
          // `initialize` answered: mark the session, ask for the surface.
          send({ jsonrpc: "2.0", method: "notifications/initialized" })
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
          continue
        }
        if (message["id"] === 2) {
          const result = message["result"] as { tools?: Array<Record<string, unknown>>; nextCursor?: string } | undefined
          for (const tool of result?.tools ?? []) {
            const schema = tool["inputSchema"] as { properties?: Record<string, unknown> } | undefined
            tools.push({
              name: String(tool["name"]),
              checkout: schema?.properties !== undefined && "checkout" in schema.properties,
            })
          }
          const again = result?.nextCursor
          if (typeof again === "string" && again !== "") {
            send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor: again } })
            continue
          }
          finish({ _tag: "answered", tools })
          return
        }
      }
    })
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: "olai", version: "0.1.0" },
      },
    })
  })
}

/**
 * WHERE THE PROBED `odu` IS, or `null` for an answer of "nowhere".
 *
 * The LIVE PATH, walked the way execvp would: the first EXECUTABLE `odu`
 * wins, and a file that is there but will not run does not shadow the ones
 * behind it (bash's own `EACCES`-pass behaviour, restated honestly rather
 * than inherited from a spawn error two steps later).
 */
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

/**
 * ASK THIS HOST — one resolve, one spawn, one round trip, per conversation.
 *
 * Asked FRESH every time a session is opened for `olai-plugin-kolu`'s
 * `probe`'s reason: an odu installed after this server was started is picked
 * up by the next conversation instead of at the next restart.
 *
 * THE ENVIRONMENT IS HANDED IN and never reached for: it is what the
 * session's own spawn will resolve against, and a composition root is the one
 * place a real `process.env` belongs.
 *
 * ## Absence is QUIET, and there is no arm that makes it loud
 *
 * Nothing on a machine says odu was EXPECTED here: no environment variable
 * names it the way `PADI_SOCKET` names a padi on kolu's side, and the board's
 * `odu-worktree` values licence a socket DIAL — which the watcher half pays
 * with or without a binary anywhere. An absent `odu` is the ordinary case,
 * answered bare.
 *
 * ## A found one that will not answer is a sentence
 *
 * Every path from "resolved" to "answered" that is not "answered" is ONE of
 * them, and they are the probe's own (`{@link asking}`). The tool-surface
 * check is the one arm with two sentences of its own, because the two things
 * it can find are two different fixes: an odu so old the verbs were never
 * there, and one new enough to run a run but too old to AIM one.
 */
export const probe = async (env: Record<string, string | undefined>): Promise<Probed> => {
  const found = resolveOn(env["PATH"])
  if (found === null) return { server: null, missing: null }

  const child = spawn(found, [...ARGS], { stdio: ["pipe", "pipe", "ignore"] })
  const verdict = await askOver(child, DEADLINE_MS)
  // The child outlives an answered probe by exactly the kill: the probe's
  // whole point is that the SESSION re-spawns the file it was handed, rather
  // than inheriting a second-hand server.
  child.kill()

  if (verdict._tag !== "answered") {
    return { server: null, missing: { name: ODU_COMMAND, where: found, why: whyOf(verdict) } }
  }
  const names = new Set(verdict.tools.map((tool) => tool.name))
  const absent = VERBS.filter((verb) => !names.has(verb))
  if (absent.length > 0) {
    return {
      server: null,
      missing: {
        name: ODU_COMMAND,
        where: found,
        why: `it answers, but its tool surface is missing ${absent.map((one) => `\`${one}\``).join(", ")}`
          + ` — this olai hands a conversation ${VERBS.map((one) => `\`${one}\``).join(", ")},`
          + " and one of the two needs an upgrade",
      },
    }
  }
  const aimless = VERBS.find((verb) => {
    const tool = verdict.tools.find((one) => one.name === verb)
    return tool !== undefined && !tool.checkout
  })
  if (aimless !== undefined) {
    return {
      server: null,
      missing: {
        name: ODU_COMMAND,
        where: found,
        why: `it answers, but \`${aimless}\` takes no per-call \`checkout\``
          + " — a conversation spans many lanes, and this build could only ever aim at olai's own served directory;"
          + " one of the two needs an upgrade",
      },
    }
  }
  return {
    server: { name: ODU_COMMAND, command: found, args: [...ARGS], env: {} },
    missing: null,
  }
}

/** The sentence per WAY a found `odu` failed — whole sentences, because core
 *  displays them and composes none (`olai-plugin-kolu`'s `whyOf` argues the
 *  rule at length). */
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
