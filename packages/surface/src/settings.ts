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
 * ## SECRETS DO NOT TRAVEL HERE
 *
 * `_olai/Settings.olai` is committed plaintext. A field annotated `secret`
 * is refused at register. Host facts stay on the row's `config:` in
 * `olai.yml`; secrets stay in `Env`.
 */

import { Schema } from "effect"

/** What a field holds, as a kind the panel can draw without knowing the
 *  plugin. `choice` is a union of string literals; `choices` travels beside it. */
export const SettingsKind = Schema.Literals(["string", "number", "boolean", "choice"])
export type SettingsKind = typeof SettingsKind.Type

/**
 * ONE FIELD, as the page may see it.
 *
 * `pending` is a `restart` field whose stored value is not the one the
 * running plugin is holding. `fault` is a key `_olai/Settings.olai` holds
 * as something this field is not — the plugin does not observe that value.
 */
export const SettingsField = Schema.Struct({
  key: Schema.String,
  kind: SettingsKind,
  choices: Schema.optionalKey(Schema.Array(Schema.String)),
  pending: Schema.Boolean,
  value: Schema.optionalKey(Schema.Unknown),
  fault: Schema.optionalKey(Schema.String),
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
