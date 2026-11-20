import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { Contribution } from "@olai/plugin-api"
import { HEADINGS, type PluginHeading, type Scope, SCOPES_BY_REACH, type Section } from "./index.ts"

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

const widestScope = (entries: ReadonlyArray<Contribution<Section>>): Scope =>
  entries.reduce<Scope>(
    (held, entry) =>
      SCOPES_BY_REACH.indexOf(entry.value.scope) > SCOPES_BY_REACH.indexOf(held)
        ? entry.value.scope
        : held,
    SCOPES_BY_REACH[0],
  )

export const groupsOf = (sections: ReadonlyArray<Contribution<Section>>): ReadonlyArray<Group> => {
  const fixed: Group[] = HEADINGS
    .map((heading) => {
      const entries = sections.filter((entry) => entry.value.heading === heading.key)
      return {
        key: heading.key,
        label: () => heading.label,
        scope: widestScope(entries),
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
      scope: widestScope(bucket.entries),
      entries: bucket.entries.slice().sort((a, b) => a.value.order - b.value.order),
    }))
    .filter((group) => group.entries.length > 0)
  const byLabel = (a: Group, b: Group): number => a.label().localeCompare(b.label())
  return SCOPES_BY_REACH.flatMap((scope) => [
    ...fixed.filter((group) => group.scope === scope),
    ...plugins.filter((group) => group.scope === scope).sort(byLabel),
  ])
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
