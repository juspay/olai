/**
 * THE PANEL'S GROUPS, AND THE RUNS THEY MAKE — the whole of what the panel
 * decides before it draws anything.
 *
 * Two readings, because the panel's structure has two levels and only the first
 * of them is a group:
 *
 *   - a GROUP is one heading's rows: the fixed table's `Appearance`, `Outlines`
 *     and `Notifications`, and one per plugin that named a heading. Its words
 *     come from the table or from the contribution's own reader, and its scope
 *     is READ off the entries — never inferred from the shape of a heading.
 *   - a RUN is a stretch of adjacent groups that share one scope, and it is the
 *     unit the SCOPE LINE belongs to. That is a drawing fact with a consequence
 *     worth stating here: the line is a property of the run, not of its last
 *     group, so a group whose body drew no row — hidden by CSS, which is the
 *     panel's ordinary case for a provider with nothing to offer yet — cannot
 *     take its run's line with it.
 *
 * Browser-local groups draw first (`HEADINGS` in table order, then plugin
 * headings by label) and shared ones follow, so a run of `browser` always
 * precedes a run of `shared`: the browser-only line can never sit above a
 * shared row.
 */
import type { Contribution } from "@olai/plugin-api"
import { HEADINGS, type PluginHeading, type Scope, type Section } from "./index.ts"

/** One heading as the panel draws it. `key` is the fixed heading's key or the
 *  plugin's name — what `data-group` carries. The label is a READER: a plugin
 *  heading's words come off the roster at draw time. */
export interface Group {
  readonly key: string
  readonly label: () => string
  readonly scope: Scope
  readonly entries: ReadonlyArray<Contribution<Section>>
}

/** Adjacent groups of one scope, and the line that closes them. */
export interface Run {
  readonly scope: Scope
  readonly groups: ReadonlyArray<Group>
}

/** WHAT SCOPE A HEADING DRAWS AS, read off the contributions that named it.
 *  Their scopes should agree; the strictest wins, because a shared row under
 *  the browser-only line is the one arrangement the ordering exists to
 *  prevent. */
const scopeOf = (entries: ReadonlyArray<Contribution<Section>>): Scope =>
  entries.some((entry) => entry.value.scope === "shared") ? "shared" : "browser"

/** THE GROUPS, IN DRAW ORDER. A heading no contribution named — or one whose
 *  contributors have all been switched off — is not a group. */
export const groupsOf = (sections: ReadonlyArray<Contribution<Section>>): ReadonlyArray<Group> => {
  const fixed: Group[] = HEADINGS
    .map((heading) => {
      const entries = sections.filter((entry) => entry.value.heading === heading.key)
      return {
        key: heading.key,
        label: () => heading.label,
        scope: scopeOf(entries),
        entries: entries.slice().sort((a, b) => a.value.order - b.value.order),
      }
    })
    .filter((group) => group.entries.length > 0)
  // Plugin headings, filed by the plugin they name: two contributions may share
  // one heading, and a heading's words come from its own live label.
  const buckets = new Map<string, { label: PluginHeading["label"]; entries: Array<Contribution<Section>> }>()
  for (const entry of sections) {
    const heading = entry.value.heading
    if (typeof heading === "string") continue
    const bucket = buckets.get(heading.plugin) ?? { label: heading.label, entries: [] }
    bucket.entries.push(entry)
    buckets.set(heading.plugin, bucket)
  }
  const plugins: Group[] = [...buckets]
    .map(([plugin, bucket]) => ({
      key: plugin,
      label: bucket.label,
      scope: scopeOf(bucket.entries),
      entries: bucket.entries.slice().sort((a, b) => a.value.order - b.value.order),
    }))
    .filter((group) => group.entries.length > 0)
  const byLabel = (a: Group, b: Group): number => a.label().localeCompare(b.label())
  return [
    ...fixed.filter((group) => group.scope === "browser"),
    ...plugins.filter((group) => group.scope === "browser").sort(byLabel),
    ...fixed.filter((group) => group.scope === "shared"),
    ...plugins.filter((group) => group.scope === "shared").sort(byLabel),
  ]
}

/** THE RUNS those groups make: each stretch of adjacent groups of one scope,
 *  in draw order. */
export const runsOf = (groups: ReadonlyArray<Group>): ReadonlyArray<Run> => {
  const runs: Run[] = []
  for (const group of groups) {
    const last = runs[runs.length - 1]
    if (last === undefined || last.scope !== group.scope) runs.push({ scope: group.scope, groups: [group] })
    else runs[runs.length - 1] = { scope: last.scope, groups: [...last.groups, group] }
  }
  return runs
}
