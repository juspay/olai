/**
 * ACP's vocabulary, as olai spells it on its own wire.
 *
 * Every shape here is the Agent Client Protocol's — an elicitation's fields
 * and choices, an answer going back, how a question stopped waiting, a tool
 * call's file diff — projected once into the flat, drawable form the rest of
 * olai carries around. They used to be declared in `@olai/surface`, which put
 * the protocol's words inside olai's wire spec; the arrow points the other way
 * now, on the precedent `RepoState` set: **the package that speaks the foreign
 * thing owns its words**, and the surface re-exports them so its consumers go
 * on importing from the spec they already import everything else from.
 *
 * This module is the half of the package the SURFACE may re-export — schemas
 * only, no protocol payload in sight — and it sits on its own `./wire` subpath
 * the way `@olai/git`'s wire half sits on `./state`. The other half
 * ({@link ./asks.ts}, {@link ./diffs.ts}) reads the protocol's own payloads
 * into these shapes, and only the chat package — the one that runs an ACP
 * subprocess — has any business importing it.
 */

import { Schema } from "effect"

/**
 * One option of a question the agent asked.
 *
 * `value` is what travels BACK — an enum's `const`, a permission option's id —
 * and `label` is what a person reads. They are usually the same string and are
 * two fields anyway, because the one case where they part company (a permission
 * option named "Yes, and use \"auto\" mode" whose id is `auto`) is the case this
 * whole member exists for.
 */
export const AskChoice = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  /** The option's own second line, when it has one. */
  hint: Schema.NullOr(Schema.String),
})
export type AskChoice = typeof AskChoice.Type

/**
 * One field of the form the agent asked to be filled.
 *
 * `kind` is what a renderer switches on, and it is the whole of what this layer
 * knows about the JSON Schema it came from — the projection happens server-side
 * ({@link ./asks.ts}), so no browser ever reads a `oneOf`.
 */
export const AskField = Schema.Struct({
  /** The schema property this field answers. The answer travels back under it. */
  key: Schema.String,
  /** What to call it. `null` when the payload named nothing — a single question
   *  carries its text as the ask's own message, and a label invented from the
   *  field key would be `question_0`. */
  label: Schema.NullOr(Schema.String),
  hint: Schema.NullOr(Schema.String),
  kind: Schema.Literals(["choice", "choices", "text", "number", "integer", "boolean"]),
  /** `choice` / `choices` only. */
  choices: Schema.Array(AskChoice),
  required: Schema.Boolean,
  /** The field this one is the free-text "other" for, by key, when the agent
   *  paired them — the CLI's per-question "Other" box. Drawn inside that
   *  field's block rather than as a field of its own. */
  attachedTo: Schema.NullOr(Schema.String),
})
export type AskField = typeof AskField.Type

/**
 * What was picked or typed for one field.
 *
 * Always TEXT, however the field is typed: a number field's answer is the
 * characters somebody entered, and turning those into a number belongs where
 * the schema that asked for one is understood ({@link ./asks.ts}'s
 * `contentOf`). One entry for a select or a box, several for a multi-select,
 * and a field left alone has no entry at all.
 */
export const AskAnswer = Schema.Struct({
  key: Schema.String,
  values: Schema.Array(Schema.String),
})
export type AskAnswer = typeof AskAnswer.Type

/**
 * How a `boolean` field's answer is spelled.
 *
 * It used to be "a value neither owns", agreed by comment between the panel
 * that writes it and the chat package that reads it back — a spelling that
 * eventually stops agreeing, silently, since a changed word would simply stop
 * matching and every press would register as nothing. It is owned now: the
 * vocabulary the two ends share is this package's, both import the one value,
 * and the reader ({@link ./asks.ts}'s `valueOf`) lives beside it.
 */
export const YES_NO = { yes: "true", no: "false" } as const

/** How a question stopped waiting.
 *
 *   - `answered` — a person filled it in and submitted.
 *   - `declined` — a person dismissed it. The agent is TOLD that, which is the
 *     point: a dismissal is a refusal to answer, never a fabricated answer.
 *   - `withdrawn` — the agent took the question back (the turn was cancelled,
 *     the session was replaced, the subprocess died). Nobody answered, and the
 *     row says so rather than sitting on screen waiting forever. */
export const AskOutcome = Schema.Struct({
  how: Schema.Literals(["answered", "declined", "withdrawn"]),
  answers: Schema.Array(AskAnswer),
})
export type AskOutcome = typeof AskOutcome.Type

/**
 * A file the agent rewrote, as the protocol reports it.
 *
 * STRUCTURED, and that is the whole point: ACP sends a tool call's diff as a
 * path and two texts, and the transcript used to flatten every content block a
 * call carried into one progress STRING — so what reached a browser about a
 * file being rewritten was the sentence `— /some/path`, and the change itself
 * was gone before the wire. A panel cannot draw what a wire has already turned
 * into prose, and re-parsing prose back into a diff is not a thing this
 * codebase will do.
 *
 * Two texts rather than a unified diff, because that is what the protocol
 * carries and because the LINE diff is a view-time computation: the client
 * derives it ({@link ../../web/src/client/chat/diff.ts}) the same way it
 * derives everything else it draws.
 *
 * `oldText` is `null` for a file that did not exist — the protocol's own way of
 * saying "this is new", and a distinction the panel draws rather than flattening
 * into an empty file.
 *
 * `path` is ROOT-RELATIVE when the file is under the served directory and
 * absolute otherwise, which is the spelling every `file:line` in olai already
 * uses. The relativising happens where the payload is read ({@link ./diffs.ts}),
 * against the directory its caller knows the session was started in.
 */
export const FileDiff = Schema.Struct({
  path: Schema.String,
  oldText: Schema.NullOr(Schema.String),
  newText: Schema.String,
})
export type FileDiff = typeof FileDiff.Type
