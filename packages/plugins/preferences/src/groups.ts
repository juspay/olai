import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { Contribution } from "@olai/plugin-api"
import { HEADINGS, type PluginHeading, type Scope, type Section } from "./index.ts"

export const SCOPE_WORDS: Record<Scope, string> = {
  browser: "Saved in this browser only.",
  shared: `Saved in ${CONFIGURATION_FILE.split("/").pop()}, for everyone using this directory.`,
}

export interface Group {
  readonly key: string
  readonly label: () => string
  readonly scope: Scope
  readonly entries: ReadonlyArray<Contribution<Section>>
}

export interface Run {
  readonly scope: Scope
  readonly groups: ReadonlyArray<Group>
}

/** Their scopes should agree; the strictest wins, because a shared row under
 *  the browser-only line is the one arrangement the ordering exists to
 *  prevent. */
const scopeOf = (entries: ReadonlyArray<Contribution<Section>>): Scope =>
  entries.some((entry) => entry.value.scope === "shared") ? "shared" : "browser"

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

export const runsOf = (groups: ReadonlyArray<Group>): ReadonlyArray<Run> => {
  const runs: Run[] = []
  for (const group of groups) {
    const last = runs[runs.length - 1]
    if (last === undefined || last.scope !== group.scope) runs.push({ scope: group.scope, groups: [group] })
    else runs[runs.length - 1] = { scope: last.scope, groups: [...last.groups, group] }
  }
  return runs
}
