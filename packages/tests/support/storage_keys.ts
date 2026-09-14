/**
 * THE KEYS A PREFERENCE IS KEPT UNDER, for the panel that sets them and does
 * not own them.
 *
 * A preference is kept by whoever DRAWS the thing, and the key is that row's
 * name for it: the alert switches are `olai-plugin-alerts`', and the note
 * density and the two Done keys are `olai-plugin-outlines`'. The preferences
 * PANEL is a fourth row, and its steps assert what is in storage after a pick —
 * so they need four names from two rows they do not own.
 *
 * They arrive here rather than in `preferences_steps.ts` because a plugin
 * reaches another plugin only through a declared static contract
 * (`olai.contracts` in the provider's manifest, held by `@olai/bundle`'s
 * `fence.test.ts`). `olai-plugin-alerts/keys` IS one; `olai-plugin-outlines/testlib`
 * is not — it is a bench door, and widening the product contract surface so a
 * test file can spell a constant would be paying for a scenario with an
 * architectural promise.
 *
 * The harness is the package the fence already records as reaching a row's
 * testlib door (`TESTLIB_IMPORTS`), and it reaches them for this. The rule that
 * keeps this from becoming a dumping ground is the one every harness name
 * follows: WHAT ONE PLUGIN'S STEPS ALONE NEED BELONGS TO THAT PLUGIN. These
 * four are here because the row that reads them is not the row that owns them.
 */

export { ALERT_SOUND_KEY, ALERTS_KEY } from "olai-plugin-alerts/keys";
export {
  DENSITY_KEY,
  type Density,
  DONE_HIDDEN_KEY,
  DONE_OVERRIDES_KEY,
} from "olai-plugin-outlines/testlib";
