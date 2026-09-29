/**
 * ONE PLUGIN'S PROMOTED SETTINGS, drawn under the heading named after it.
 *
 * A leaf a config schema marks as a preference (`@olai/plugin-api/configuration`'s
 * `preference`) is drawn in the preferences panel rather than in the plugins
 * panel, and it is drawn by the SAME control: `./Control.tsx`, so the authored
 * marker, the reset, invalid text handling, refusals, Enter/blur/Escape and the
 * frozen state are one implementation and cannot drift between the two panels.
 * What this file adds is the label, the row, and WHERE the reading comes from.
 *
 * ## Where the reading comes from, and why it is the roster
 *
 * The values are the roster's own `configurationValues` — the same reading the
 * inspector's rows are built from — read live. `browser-management` supplies
 * the roster under whatever Solid owner asks, so a plugin switched off in
 * another tab empties this body and the panel hides the heading with it, and
 * switching it back fills it again with no reload. The headings themselves are
 * discovered from the same roster (`./rows.ts`'s `promotingPlugins`), so no
 * plugin is named by hand here and no plugin package is imported.
 *
 * A plugin that is off draws NOTHING — not a dimmed control — because its
 * setting is not this browser's to change while the plugin that would read it
 * is not running; the plugins panel keeps it editable from there.
 */
import { For, Show } from "solid-js"
import { NO_ROSTER } from "@olai/surface"
import type { BrowserManagement } from "@olai/surface/management"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Control } from "./Control.tsx"
import { configurationFrozen, labelOf, promotedValues, rowValues } from "./rows.ts"

export function PromotedRows(props: {
  readonly plugin: string
  readonly management: BrowserManagement
}) {
  const roster = props.management.roster()
  const plugin = () => (roster() ?? NO_ROSTER).built.find((one) => one.name === props.plugin)
  const values = () => {
    const row = plugin()
    return row === undefined ? [] : promotedValues(rowValues(row))
  }
  const frozen = () => configurationFrozen(roster() ?? NO_ROSTER, props.management.changing())
  return (
    <Show when={plugin()?.running === true}>
      {/* ONE ROW PER LEAF, addressed as `plugin-<plugin>-<key>`: the plugin
          namespaces it, and the leaf's own key is spelled VERBATIM — a key is
          already unique within its plugin, and folding anything out of it would
          make two of them collide (`watch.held-for` and `watch-held.for` are
          one row's key change away from each other, and one name). */}
      <For each={values().map((one) => one.key)}>{key => {
        const value = () => values().find((one) => one.key === key)!
        return (
          <Row label={labelOf(key)} pref={`plugin-${props.plugin}-${key}`} frozen={frozen() !== undefined}>
            <Control name={props.plugin} value={value()} configure={props.management.configure} frozen={frozen()} label={false} />
          </Row>
        )
      }}</For>
    </Show>
  )
}
