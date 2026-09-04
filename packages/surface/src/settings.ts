/**
 * A PLUGIN'S SETTINGS, as the plugins panel draws them.
 *
 * ## Why this is CORE'S member and not a plugin's
 *
 * A plugin that is off composes no sibling, so the member that would answer
 * *what may I change about kolu* is missing in exactly the case the panel still
 * has a row for it. Settings outlive the fiber the way the roster does: the
 * document is the vault's, the schema is registered by the fiber, and the
 * panel is core's. A plugin that wants its own face hangs it in
 * `plugins.row.settings`; what travels here is the SCHEMA'S description of the
 * fields, with no plugin words in core.
 *
 * ## A CELL, not a field on the roster
 *
 * The roster's republish is a redial. A setting changing is not a plugin
 * arriving or leaving, and a redial that rebuilt the page because somebody
 * typed `30s` would be the panel spending the most expensive thing it has on
 * the cheapest edit. So this is its own cell, republished when a section
 * registers, unregisters, or the document moves, and the roster does not
 * notice.
 *
 * ## SECRETS NEVER TRAVEL
 *
 * A field marked `secret` arrives with `set: true` and no `value`. The page
 * may not learn the token; it may learn that one is stored. That is the whole
 * of the ruling, and it is this schema that enforces it rather than a courtesy
 * of the renderer.
 */

import { Schema } from "effect"

/** How a field is drawn, and how a change takes effect. */
export const SettingsApplies = Schema.Literals(["live", "restart"])
export type SettingsApplies = typeof SettingsApplies.Type

/** What a field holds, as a kind the panel can draw without knowing the
 *  plugin. `choice` is a union of string literals; `choices` travels beside it. */
export const SettingsKind = Schema.Literals(["string", "number", "boolean", "choice"])
export type SettingsKind = typeof SettingsKind.Type

/**
 * WHICH LAYER LAST SET THIS FIELD — schema default, the row's `config:` (the
 * base), or a person's edit in `_olai/Settings.olai`.
 *
 * Drawn so a reader can tell a value they typed from the one a deployment
 * shipped. Git's `commit`/`push` are row config and stay on the read-only
 * pairs; a settings field whose source is `row` is the same fact on the
 * editable side.
 */
export const SettingsSource = Schema.Literals(["default", "row", "vault"])
export type SettingsSource = typeof SettingsSource.Type

/**
 * ONE FIELD, as the page may see it.
 *
 * `value` is ABSENT on a secret, always. `set` says whether a value exists
 * without saying what it is. `pending` is a `restart` field whose stored
 * value is not the one the running plugin is holding.
 */
export const SettingsField = Schema.Struct({
  key: Schema.String,
  kind: SettingsKind,
  choices: Schema.optionalKey(Schema.Array(Schema.String)),
  secret: Schema.Boolean,
  applies: SettingsApplies,
  pending: Schema.Boolean,
  source: SettingsSource,
  set: Schema.Boolean,
  value: Schema.optionalKey(Schema.Unknown),
})
export type SettingsField = typeof SettingsField.Type

/**
 * ONE PLUGIN'S SECTION — the fields its schema describes, keyed by the
 * plugin's name the way the roster's row is.
 *
 * ABSENT from the cell when the plugin has not registered, which is also
 * a plugin that is off: nothing to edit, and nobody observing.
 */
export const SettingsSection = Schema.Struct({
  plugin: Schema.String,
  fields: Schema.Array(SettingsField),
})
export type SettingsSection = typeof SettingsSection.Type

/**
 * EVERY SERVED SECTION, in registration order.
 *
 * An empty list is a serve whose running plugins have registered none —
 * the ordinary state of every row but the first tenant.
 */
export const SettingsRoster = Schema.Struct({
  sections: Schema.Array(SettingsSection),
})
export type SettingsRoster = typeof SettingsRoster.Type

export const NO_SETTINGS: SettingsRoster = { sections: [] }

export const sameSettings: (a: SettingsRoster, b: SettingsRoster) => boolean = Schema
  .toEquivalence(SettingsRoster)
