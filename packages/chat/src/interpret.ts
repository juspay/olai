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

// ── steering a turn that is already running ────────────────────────────

/**
 * The request that puts a message INTO the turn already in flight, rather than
 * behind it.
 *
 * A `session/prompt` sent while a turn runs is not this: the adapter enqueues
 * it and the agent reaches it when the running turn is over, which is the same
 * waiting olai used to do for itself with the same words held out of sight.
 * This one is delivered at the SDK's `now` priority — it pre-empts the current
 * generation and lands between the turn's own steps — so what a person typed
 * reaches the model that is working, which is the whole point of typing it
 * then.
 *
 * An EXTENSION, hence the leading underscore, and named for the agreed ACP
 * steering wire protocol rather than for one adapter — but it is read here
 * with everything else that is a bet on the agent, because a bet it is:
 * {@link steeringIn} is the only thing that says whether the agent on the
 * other end has this at all, and an agent that does not is told nothing and
 * asked for nothing ({@link ../chat.ts} keeps the words instead).
 */
export const STEER_METHOD = "_session/steering"

/**
 * How a steer that found NOTHING RUNNING should behave, in the request's own
 * `_meta`.
 *
 * The default is for the agent to start a fresh turn of its own, detached —
 * which would be a turn olai never asked for, never tracked and could not
 * cancel, reporting through the transcript from nowhere. `promptRequired`
 * hands the message BACK instead ("nothing to steer; send it yourself"), which
 * is the only outcome a client that owns its turns can use. Olai only steers
 * while it believes a turn is running, so this is the answer to the race
 * rather than the ordinary path: the adapter settled while the send was on its
 * way, and it says so instead of inventing a turn.
 */
export const STEER_WHEN_IDLE = {
  steering: { idleBehavior: "promptRequired" },
}

/**
 * Whether the agent takes {@link STEER_METHOD} at all, out of `initialize`'s
 * top-level `_meta`.
 *
 * The safe direction is the one it fails in: an agent that says nothing is
 * treated as unable to steer, so a mid-turn message is kept and marked unsent
 * rather than dropped into a method that does not exist. Nothing is ever
 * assumed to be supported by failing to see it said.
 */
export const steeringIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): boolean => {
  const steering = meta?.["steering"] as { readonly supported?: unknown } | undefined
  return steering?.supported === true
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
 * The context lane a model string carries, as the adapter spells it.
 *
 * Two spellings for one thing — `opus[1m]` in a picker value, `-1m` glued to an
 * id — and the adapter treats them as the same string (its own
 * `canonicalizeModelId`). A live id carries NEITHER: the CLI reports the
 * concrete API id with the hint dropped, which is the whole reason
 * {@link modelNameIn} has to do any work at all.
 */
const CONTEXT_HINT = /(?:\[(\d+m)\]|-(\d+m))$/i

/** A model id with its context lane taken off, lowercased — the spelling in
 *  which two of the adapter's names for one model are comparable. */
const withoutLane = (id: string): string => id.trim().toLowerCase().replace(CONTEXT_HINT, "")

/** The context lane a model string states, in ONE spelling whichever way it was
 *  written, or `null` for a string that states none. A live id is always the
 *  latter — which is exactly why a row that states one may not answer for it. */
const laneOf = (id: string): string | null => {
  const found = CONTEXT_HINT.exec(id.trim().toLowerCase())
  return (found?.[1] ?? found?.[2] ?? null)
}

/**
 * What the agent calls the model with this id, out of its own picker — or
 * `null` when the picker does not name it and the caller should say the id raw.
 *
 * THE TWO VOCABULARIES. The picker's values are the adapter's *aliases* —
 * `default`, `opus[1m]`, `sonnet`, `haiku` — and the live id the CLI reports is
 * the concrete API id: `claude-sonnet-5`. So the obvious lookup, `labels.get`
 * on a live id, misses on every alias row the default install ships, and a
 * header that followed the running model could only ever say `claude-sonnet-5`
 * where the picker beside it said "Sonnet". Captured off the real adapter
 * (0.66.0) — the picker offered `default`, `opus[1m]`, `claude-fable-5[1m]`,
 * `sonnet`, `haiku` while `system`/`init` reported `claude-fable-5`, then
 * `claude-sonnet-5`. Not one of the five ever matched.
 *
 * Three tiers, and every one of them is an EXACT comparison. This is not the
 * fuzzy match the picker's own note refuses, and the difference is worth
 * naming: the adapter resolves in exactly this direction itself
 * (`resolveModelPreference`, `matchResumedModel`) and resolves it to decide
 * BEHAVIOUR — which context window, which capabilities. What is decided here is
 * a word on a screen, and it is decided more strictly than the adapter does it:
 * no scoring, no version fuzz, no nearest row.
 *
 *   1. the id IS a picker value. The picked value always lands here;
 *   2. the same model in the adapter's two spellings of a context lane —
 *      `claude-fable-5` is the `claude-fable-5[1m]` row;
 *   3. an ALIAS row: a value that is one bare word naming a FAMILY, against an
 *      id that is that family and a version and nothing else.
 *      `claude-sonnet-5` is the `sonnet` row because "sonnet" is literally
 *      what that id says it is.
 *
 * Tier 3 answers for a family and a version — `claude-sonnet-5`,
 * `claude-haiku-4-5` — and for nothing more decorated than that. A dated or
 * otherwise pinned id (`claude-opus-4-5-20260101`) names something more
 * specific than any alias claims to cover, and gets the raw id: an alias row
 * that answered for it would be saying the picker offers a model it does not.
 *
 * And every tier that could answer twice answers `null` instead. Tier 3 in
 * particular takes a UNIQUE hit or none: two alias rows for one family — a
 * `sonnet` and a `sonnet[1m]` — are a question this cannot answer, and the raw
 * id is the truthful thing to say about a question nobody answered.
 *
 * `default` is never a match. It is the adapter's word for "whichever model the
 * CLI recommends today", so it names no model at all — and it is a bare word
 * that would otherwise sit in tier 3 matching nothing on purpose.
 *
 * AND A FAMILY ALIAS MAY NOT LEND A CONTEXT LANE. A live id states no lane —
 * the CLI drops it — so `claude-opus-5` against a lone `opus[1m]` row was
 * answered "Opus (1M context)", and a session actually running Opus at 200k
 * said so in the header for the rest of its life. That is a lie about the one
 * number a person reads this header to decide `/compact` by, and it is worse
 * than the raw id it replaced, which claimed nothing. So tier 3 requires the
 * LANES TO AGREE: laneless id, laneless row. `sonnet` and `haiku` still answer
 * because they state no lane either; a lane-pinned row does not answer for an
 * id that never mentioned one, and the header says `claude-opus-5`.
 *
 * TIER 2 IS NOT THAT, and the difference is identity. `claude-fable-5` against
 * the `claude-fable-5[1m]` row is one id in the adapter's own two spellings of
 * it (`canonicalizeModelId` is the adapter's equality, not a rule invented
 * here) — the SAME model, so the row's name for it is its name. A family alias
 * is not an identity: `opus` is whichever Opus, and a row that has pinned
 * itself to a lane is not the one a laneless id belongs to.
 */
export const modelNameIn = (
  labels: ReadonlyMap<string, string>,
  id: string,
): string | null => {
  const exact = labels.get(id)
  if (exact !== undefined) return exact

  const wanted = withoutLane(id)
  if (wanted === "") return null

  const named = (only: (value: string) => boolean): string | null => {
    const hits = [...labels].filter(([value]) => value !== "default" && only(value))
    return hits.length === 1 ? hits[0]?.[1] ?? null : null
  }

  const lane = named((value) => withoutLane(value) === wanted)
  if (lane !== null) return lane

  // `claude-` is the vendor and says nothing about which model this is; what
  // follows is a family and, optionally, the version of it. Anything else in
  // there — a date, a build — is a pin no family alias covers.
  const words = wanted.split("-")
  const [family, ...version] = words[0] === "claude" ? words.slice(1) : words
  if (family === undefined || !version.every((part) => /^\d{1,2}$/.test(part))) return null
  // ... and the lanes have to agree, which for a live id means both are absent:
  // a family alias names a family, and may not throw in a context window the
  // thing it is naming never claimed.
  const lanes = laneOf(id)
  return named((value) => withoutLane(value) === family && laneOf(value) === lanes)
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

/** The picker as value → label ("sonnet" → "Sonnet"), which is what the agent
 *  calls its own models. Exactly what the picker said and nothing more — the
 *  vocabulary gap between a picker VALUE and a live API id is
 *  {@link modelNameIn}'s to bridge, and only it may answer `null`.
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
