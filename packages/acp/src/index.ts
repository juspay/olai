/**
 * @olai/acp — the Agent Client Protocol's words, owned by the wall that
 * speaks them.
 *
 * Three modules and a rule. {@link ./wire.ts} is the vocabulary that travels
 * olai's wire — the ask shapes, `YES_NO`, `FileDiff` — declared here and
 * RE-EXPORTED by `@olai/surface`, on the precedent `RepoState` set from
 * `@olai/git`: the package that speaks the foreign thing owns its words, and
 * consumers above go on importing them from the spec they already import.
 * {@link ./asks.ts} and {@link ./diffs.ts} are the projections between the
 * protocol's own payloads and that vocabulary, and only `@olai/chat` — the
 * package that runs an ACP subprocess — consumes them.
 *
 * The rule is that this is a LEAF that speaks ACP and nothing of olai: no
 * `@olai/*` import, and refusals in its own one word ({@link Refused}) for the
 * domain to translate at the seam. Machine-checked, not remembered —
 * {@link ./manifest.test.ts} enumerates what may cross this boundary in both
 * directions.
 */

export {
  contentOf,
  type Form,
  formOf,
  PERMISSION_FIELD,
  permissionFormOf,
  Refused,
} from "./asks.ts"
export { diffsOf, relativeTo } from "./diffs.ts"
export { AskAnswer, AskChoice, AskField, AskOutcome, FileDiff, YES_NO } from "./wire.ts"
