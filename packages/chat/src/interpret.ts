/**
 * What the Claude Code adapter MEANS by what it sends.
 *
 * `OLAI_ACP_AGENT` ({@link ./adapter.ts}) is the override, and this file is the
 * part of {@link ./agent.ts} that would be wrong if somebody used it: a `_meta`
 * extension one adapter writes, a tool-naming convention one CLI uses, a
 * message one wrapper forwards because we asked it to. The protocol proper is
 * read where it is spoken; the VALUES that are only true of one agent are read
 * here, so pointing olai at another one starts with a file rather than a search
 * for the assumptions.
 *
 * Every bet is safe to lose in one direction only, and that is the direction it
 * loses in: an agent that says none of this matches nothing here, and what
 * happens then is that a person is asked. **Nothing is ever approved by failing
 * to recognise it.**
 *
 * Everything is a PURE function over a payload — `@olai/acp`'s pattern, for
 * the reason that pattern exists: the rule that stops this panel approving
 * its own permissions is a function with unit tests rather than a branch
 * reachable only by starting a subprocess and talking it into asking. Which
 * side of that package boundary a new reader belongs on is not which payload
 * it reads but WHO has to have sent it: `@olai/acp` reads the protocol's own
 * shapes, true of any agent — which is why it is a package and this is not —
 * and this is the file that is wrong about a different one.
 *
 * What is NOT here, and cannot be: the things `agent.ts` assumes this adapter
 * DOES rather than says — that a `tool_call` is announced before the permission
 * request that references it, and that `session/list` answers by cwd prefix
 * rather than exactly. Those are shapes of the conversation rather than values
 * in a payload, and they are named where they are relied on.
 */

import type { PermissionOption, SessionConfigOption } from "@agentclientprotocol/sdk"

// ── which permissions are answered without asking ──────────────────────

/** The permission mode a session is asked for, in the adapter's own
 *  vocabulary: ACP leaves mode ids to the agent, and this is what the Claude
 *  Code adapter calls the one that stops it asking about tools it has been told
 *  are allowed. An agent with no such mode refuses the request, which costs a
 *  round trip per tool call and nothing else — {@link allowedWithoutAsking} is
 *  the backstop either way, and is why a refusal is not a boot failure. */
export const BYPASS_MODE = "bypassPermissions"

/**
 * The option a permission request is answered with WITHOUT asking a person, or
 * `null` when it is a person's to answer.
 *
 * Bypass mode is the design (resolved 2026-08-09), so a call to one of the MCP
 * servers WE handed this session — olai's mediated ops, kolu's terminals — is
 * allowed immediately: those tools are already mediated and already validated,
 * and a click per write is not a permission model. The adapter usually never
 * asks about them at all, having been asked for `bypassPermissions`; this is
 * the path for a session whose bypass request was refused.
 *
 * Everything else is a person's, and THAT direction is the load-bearing one.
 * The adapter maps plan mode's "Ready to code?" onto a permission request whose
 * first allow-flavoured option switches the session to `auto` — so a client
 * that answered every request with the first allow it found was silently saying
 * "yes, and stop asking me" on somebody's behalf, every time. The rule is
 * POSITIVE RECOGNITION: the tool is named, and the name is one of ours, or
 * nothing is bypassed.
 *
 * `mcp__<server>__<tool>` is the Claude Code CLI's own naming for the tools an
 * MCP server contributes, and reading it is a bet on that adapter exactly as
 * {@link toolNameIn} is. An agent that names its MCP tools some other way
 * matches nothing here and every request goes to a person, which is the losing
 * direction this can afford.
 *
 * @param tool the programmatic name of the tool being asked about, or `null`
 *   when nothing named it — a name we do not know is answered by ASKING
 * @param given the MCP servers this conversation was handed, by name
 * @param options the request's own options, in the agent's own order
 */
export const allowedWithoutAsking = (
  tool: string | null,
  given: ReadonlyArray<string>,
  options: ReadonlyArray<PermissionOption>,
): string | null => {
  const ours = tool !== null &&
    given.some((server) => tool.startsWith(`mcp__${server}__`))
  if (!ours) return null
  // Allow-FLAVOURED, rather than first: the options arrive in the order the
  // agent wants them read, and its ordinary list for a tool call leads with the
  // refusal. A request for one of ours that offers no allow at all is left to a
  // person like anything else this cannot answer.
  return options.find((option) => option.kind.startsWith("allow"))?.optionId ?? null
}

// ── which tool a call is ───────────────────────────────────────────────

/**
 * The programmatic name of a tool, out of a `_meta` the Claude Code adapter
 * puts it in.
 *
 * The one thing read out of an agent-specific `_meta` extension, and it is read
 * because the protocol proper does not carry it where it is needed: a
 * `session/request_permission` describes the call it is about with a DISPLAY
 * title, and "which tool is this" is the question the answer turns on. Every
 * `tool_call` the adapter emits carries the name here, and the adapter emits
 * one before it asks — so the pair is enough.
 *
 * An agent that is not that adapter says nothing here, and nothing here guesses
 * on its behalf: an unknown tool is one a person is asked about.
 */
export const toolNameIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): string | null => {
  const claude = meta?.["claudeCode"] as { readonly toolName?: unknown } | undefined
  return typeof claude?.toolName === "string" && claude.toolName !== ""
    ? claude.toolName
    : null
}

// ── which model a turn is running on ───────────────────────────────────

/** What `session/new` asks the Claude Code adapter to forward, and why: the
 *  adapter handles a `/model` slash command inside the wrapped CLI, so it never
 *  sees a config change and its `configOptions` keep naming the model the
 *  session started on. The CLI's own `system`/`init` message carries the live
 *  one. An agent that is not that adapter ignores `_meta` and nothing changes —
 *  the config option is still read, and still enough. */
export const NEW_SESSION_META = {
  claudeCode: {
    emitRawSDKMessages: [{ type: "system", subtype: "init" }],
  },
}

/** The notification the Claude Code adapter forwards its wrapped CLI's own
 *  messages under, having been asked to by {@link NEW_SESSION_META}. */
export const SDK_MESSAGE = "_claude/sdkMessage"

/**
 * The model a turn is actually running on, out of the CLI message the adapter
 * forwarded.
 *
 * ONE field of one message kind is read. Everything else `init` carries — the
 * tool list, the MCP servers, the permission mode, the slash commands, the CLI
 * version — is learned from the protocol proper or not at all, because a panel
 * that believed a wrapped CLI's private message about any of it would be
 * reading around the protocol it speaks.
 */
export const liveModelIn = (params: unknown): string | null => {
  const message = (params as { readonly message?: unknown } | null)?.message
  if (typeof message !== "object" || message === null) return null
  const shape = message as {
    readonly type?: unknown
    readonly subtype?: unknown
    readonly model?: unknown
  }
  if (shape.type !== "system" || shape.subtype !== "init") return null
  return typeof shape.model === "string" && shape.model !== "" ? shape.model : null
}

/** The model picker, as read: what is PICKED in it, and what the agent calls
 *  each of the values it offers. */
export interface Picker {
  readonly picked: string | null
  readonly labels: ReadonlyMap<string, string>
}

/**
 * The model picker out of a session's `configOptions`, or `null` when there is
 * none to read.
 *
 * WHICH ENTRY is the model is the adapter's own answer and not the protocol's:
 * ACP's `SessionConfigId` is a free-form string, and its one reserved hint —
 * `category: "model"` — is documented as UX-only, optional, and never required
 * for correctness. So `id === "model"` is a bet of exactly the kind everything
 * else here is, and it belongs beside them rather than inside the session that
 * uses it: an agent that spells its picker differently loses the model name in
 * the header and nothing else.
 */
export const modelPickerIn = (
  configOptions: ReadonlyArray<SessionConfigOption> | null | undefined,
): Picker | null => {
  const entry = (configOptions ?? []).find((option) => option.id === "model")
  if (entry === undefined || entry.type !== "select") return null
  return { picked: entry.currentValue ?? null, labels: labelsOf(entry) }
}

/** The picker as value → label ("claude-fable" → "Fable"), which is what the
 *  agent calls its own models. A value it does not offer is absent here, and
 *  the caller keeps the raw id: truthful, where a nearest match is invented.
 *
 *  The picker is a flat list of options or a list of GROUPS of them, and the
 *  protocol tells the two apart by shape rather than by a tag. */
const labelsOf = (
  entry: Extract<SessionConfigOption, { type: "select" }>,
): ReadonlyMap<string, string> => {
  const labels = new Map<string, string>()
  for (const item of entry.options) {
    if ("value" in item) {
      labels.set(item.value, item.name)
      continue
    }
    for (const option of item.options) labels.set(option.value, option.name)
  }
  return labels
}
