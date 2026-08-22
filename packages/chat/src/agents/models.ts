/**
 * WHICH MODEL a conversation is on, out of the protocol's own picker.
 *
 * ACP carries a session's settings as `configOptions` — a list of selects the
 * client may read and set — and both agents olai knows put the model in one of
 * them. So this is not a leg ({@link ./leg.ts}): it is a reading of the
 * protocol proper, shared by every agent that has a model picker at all, and
 * the header, the memory and the restore-after-a-restart all speak it.
 *
 * TWO THINGS IN IT ARE ONE ADAPTER'S SPELLING and are here anyway, deliberately:
 *
 *   - **which entry is the model.** ACP's `SessionConfigId` is a free-form
 *     string and its one reserved hint (`category: "model"`) is documented as
 *     UX-only, so `id === "model"` is a bet. It is the bet BOTH agents pay off
 *     (verified against the Claude Code adapter 0.66.0 and against opencode
 *     1.17.9), and an agent that spells its picker differently loses the model
 *     name in the header and nothing else.
 *   - **the alias tiers in {@link modelNameIn}.** `sonnet` naming
 *     `claude-sonnet-5` is one CLI's vocabulary. It costs nothing anywhere
 *     else: an agent whose picker values are the ids it reports (opencode's
 *     are) matches at tier 1 and never reaches them, and an agent that matches
 *     nothing gets `null`, which is the raw-id fallback every caller here
 *     already handles.
 *
 * Keeping them here rather than on the leg is the smaller lie: a per-leg copy
 * would be one rule written twice, and the second copy is the one that would
 * drift the day a third agent arrived.
 */

import type { SessionConfigOption } from "@agentclientprotocol/sdk"

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
  const entry = (configOptions ?? []).find((option) => option.id === MODEL_CONFIG)
  if (entry === undefined || entry.type !== "select") return null
  return { picked: entry.currentValue ?? null, labels: labelsOf(entry) }
}

/** The picker's own id, which is also what a `session/set_config_option`
 *  naming the model has to be addressed to — READ in one place and WRITTEN in
 *  another, so it is spelled once. The bet it embodies is
 *  {@link modelPickerIn}'s. */
export const MODEL_CONFIG = "model"

/**
 * Whether two model strings name the model, as far as anything here can tell.
 *
 * Asked by the one caller that has to decide whether to say anything at all:
 * the panel puts a restored conversation back on the model it was running
 * ({@link ./agent.ts}'s `restore`), and a session that already came up on it
 * needs no such request. The two strings reach that question in DIFFERENT
 * vocabularies — the picker's own value (`sonnet`) against whatever the panel
 * last knew it was running, which is a live API id (`claude-sonnet-5`) as often
 * as not — so string equality answers only the easy half.
 *
 * Resolved through {@link modelNameIn}, which is the bridge between those two
 * vocabularies and already the header's: two strings the picker gives ONE name
 * are one model, because a picker never names two rows alike. A string the
 * picker cannot name answers for itself, so two unnameable ones agree only when
 * they are the same string — which is the truthful answer for a model nobody
 * here has a vocabulary for, and the reason the equal-strings case needs no
 * line of its own.
 */
export const sameModel = (
  labels: ReadonlyMap<string, string>,
  one: string,
  other: string,
): boolean => (modelNameIn(labels, one) ?? one) === (modelNameIn(labels, other) ?? other)

/**
 * The picker's OWN word for a model, when it has one.
 *
 * The other direction of the same bridge, and the one a request has to cross.
 * What the panel remembers a conversation running is, in practice, always the
 * live API id the CLI reported (`claude-sonnet-5`) — that is the only source a
 * `/model` ever reaches olai through — while the picker offers aliases
 * (`sonnet`). A `session/set_config_option` carries a picker VALUE, so asking
 * in the remembered spelling is asking with a word the picker never offered:
 * the pinned adapter would resolve it (its `resolveModelPreference` matches a
 * row's resolved id), and an agent that simply checked its own list would
 * refuse — leaving the conversation on the pin, which is the whole bug.
 *
 * So the id is translated back through the labels first: the row this model is
 * NAMED by is the row to ask for. `null` when no row answers, or when two do —
 * the caller then asks in the words it has, which is what it would have done
 * anyway, and an agent that can resolve them still does.
 */
export const pickerValueFor = (
  labels: ReadonlyMap<string, string>,
  model: string,
): string | null => {
  if (labels.has(model)) return model
  const name = modelNameIn(labels, model)
  if (name === null) return null
  const rows = [...labels].filter(([, label]) => label === name)
  return rows.length === 1 ? rows[0]?.[0] ?? null : null
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
