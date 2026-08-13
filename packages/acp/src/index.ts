/**
 * @olai/acp — the Agent Client Protocol's words, owned by the wall that
 * speaks them.
 *
 * Three modules and a rule. {@link ./wire.ts} is the vocabulary that travels
 * olai's wire — the ask shapes, `YES_NO`, `FileDiff` — on its own `./wire`
 * subpath, RE-EXPORTED by `@olai/surface`, on the precedent `RepoState` set
 * from `@olai/git`: the package that speaks the foreign thing owns its words,
 * and consumers above go on importing them from the spec they already import.
 * THIS entry is the other half and only this half — {@link ./asks.ts} and
 * {@link ./diffs.ts}, the projections between the protocol's own payloads and
 * that vocabulary, which only `@olai/chat` — the package that runs an ACP
 * subprocess — consumes. The two entries are disjoint on purpose: everyone
 * who wants the vocabulary has it through the surface, so a wire shape
 * offered here as well would be a third path to the same word.
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
