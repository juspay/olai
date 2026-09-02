/**
 * `--plugins` as a loader patch.
 *
 * dsh writes `- id: <name>\n  disabled: true` onto a row. Include's
 * `applyEntryPatches` is the phase-2 algorithm for that (not vendored here).
 * This spike is the same data: a list of loader entries whose `disabled` flag
 * is the filter `--plugins` already is, held as a patch rather than as a
 * composition-root `filter()`.
 *
 * `names === null` is nobody having said, and it means ALL — the same
 * distinction `@olai/plugin-api`'s `enabled()` keeps.
 */

import type { EntryOptions } from "@cordisjs/plugin-loader"

export type BuiltRow = {
  readonly id: string
  readonly name: string
}

/** The overlay `--plugins=a,b` would write: every built row, `disabled` on
 *  the ones the flag left out. An empty list disables every row (`--plugins=`). */
export const pluginsPatch = (
  built: ReadonlyArray<BuiltRow>,
  names: ReadonlyArray<string> | null,
): ReadonlyArray<EntryOptions> =>
  built.map((row) => ({
    id: row.id,
    name: row.name,
    ...(names !== null && !names.includes(row.id) ? { disabled: true } : {}),
  }))
