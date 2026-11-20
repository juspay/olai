import type { Row, Shelf } from "@olai/format"

import type { Relation } from "../edges/relation.ts"
import type { Said } from "@olai/web/client/saying.ts"
import type { Undo } from "../edit/undoing.ts"
import { setFolded } from "../fold/memory.ts"
import type { Fold } from "../fold/rows.ts"
import { hung } from "../faces.ts"
import { atNode, zoomNode, hrefOfPlain, type Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting } from "olai-plugin-navigation/workspace"
import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
import { asText } from "./subtree.ts"
import type { MenuAction, MenuEntry } from "./action.ts"
import { type Does, type Group, shownIdOf, type Subject, subjectOfRow, writeVerbs } from "./verbs.ts"
import { applying } from "../writes.ts"

const copied = (what: "link" | "text"): Said => ({ tone: "aside", text: what === "link" ? "Link copied" : "Text copied" })

export interface Panels {
  readonly pickDate?: () => void
  readonly pickRepeat?: () => void
  readonly pickEdge?: (relation: Relation) => void
  readonly addProp?: () => void
  readonly pickMove?: () => void
}

const opening = (open: (() => void) | undefined): MenuAction["run"] | undefined =>
  open === undefined
    ? undefined
    : () => {
      open()
    }

const running = (
  does: Does,
  panels: Panels,
  record: Undo["record"],
): MenuAction["run"] | undefined => {
  switch (does.kind) {
    case "edit":
      return () => applying(does.edit, record)
    case "pick-edge": {
      const open = panels.pickEdge
      return opening(open === undefined ? undefined : () => open(does.relation))
    }
    case "pick-date":
      return opening(panels.pickDate)
    case "pick-repeat":
      return opening(panels.pickRepeat)
    case "add-prop":
      return opening(panels.addProp)
    case "pick-move":
      return opening(panels.pickMove)
  }
}

const pluginEntries = (plugin: string, action: RowAction, shown: string): ReadonlyArray<MenuEntry> => {
  const verb = (one: RowVerb): MenuAction => ({
    id: `${plugin}:${one.id}`,
    label: one.label,
    ...(one.confirm === undefined ? {} : { confirm: one.confirm }),
    run: async () => {
      const refusal = await one.run(shown)
      if (typeof refusal === "string") return { tone: "alarm" as const, text: refusal }
    },
  })
  if (!("choices" in action)) return [verb(action)]
  if (action.choices.length > 1) return [{ id: `${plugin}:${action.id}`, label: action.label, entries: action.choices.map(verb) }]
  return action.choices.map((one) => ({ ...verb(one), label: action.label }))
}

export const subjectMenuActions = (args: {
  readonly routes: WorkspaceRouting
  readonly subject: Subject
  readonly under: number | undefined
  readonly pins: Shelf
  readonly placement?: Parameters<typeof writeVerbs>[4]
  readonly go: (route: Route) => void
  readonly record: Undo["record"]
  readonly panels: Panels
  readonly more?: ReadonlyArray<MenuAction>
}): ReadonlyArray<MenuEntry> => {
  const id = args.subject.record.id
  const shown = shownIdOf(args.subject)
  const zoom: MenuAction = {
    id: "zoom",
    label: "Zoom in",
    run: () => args.go(zoomNode(id)),
  }
  const copyLink: MenuAction = {
    id: "copy-link",
    label: "Copy link",
    run: async () => {
      const url = new URL(hrefOfPlain(atNode(id)), location.href).href
      await navigator.clipboard.writeText(url)
      return copied("link")
    },
  }

  const verbs = writeVerbs(
    args.routes,
    args.subject,
    args.under,
    args.pins,
    args.placement,
  ).flatMap(({ does, ...verb }) => {
    const run = running(does, args.panels, args.record)
    return run === undefined ? [] : [{ ...verb, run }]
  })
  const of = (group: Group): Array<MenuAction> =>
    verbs.filter((verb) => verb.group === group).map(({ group: _, ...verb }) => verb)

  const reads: Array<MenuEntry> = []
  const plugins: Array<MenuEntry> = []
  for (const { plugin, face } of hung("outline.row.action")) {
    for (const action of face(shown)) {
      ;(action.writes ? plugins : reads).push(...pluginEntries(plugin, action, shown))
    }
  }

  const marks = of("mark")
  const groups: ReadonlyArray<ReadonlyArray<MenuEntry>> = [
    [
      zoom,
      ...(marks.length === 0 ? [] : [{ id: "mark", label: "Mark", entries: marks }]),
      ...reads,
    ],
    of("plan"),
    of("place"),
    plugins,
    [{ id: "more", label: "More", entries: [copyLink, ...(args.more ?? []), ...of("more")] }],
    of("away"),
  ]

  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, at) => group.map((entry, i) => (at > 0 && i === 0 ? { ...entry, divider: true } : entry)))
}

export const nodeMenuActions = (args: {
  readonly placement?: Parameters<typeof writeVerbs>[4]
  readonly routes: WorkspaceRouting
  readonly row: Row
  readonly pins: Shelf
  readonly foldable: ReadonlyArray<Fold>
  readonly go: (route: Route) => void
  readonly record: Undo["record"]
  readonly panels: Required<Panels>
}): ReadonlyArray<MenuEntry> => {
  const text: MenuAction[] = args.row.kind === "node" || args.row.kind === "mirror"
    ? [{
      id: "copy-text",
      label: "Copy as text",
      run: async () => {
        await navigator.clipboard.writeText(asText(args.row))
        return copied("text")
      },
    }]
    : []
  const folds: MenuAction[] = args.row.children.length === 0 ? [] : [
    {
      id: "expand-all",
      label: "Expand all",
      run: () => setFolded(args.foldable, false),
    },
    {
      id: "collapse-all",
      label: "Collapse all",
      run: () => setFolded(args.foldable, true),
    },
  ]
  return subjectMenuActions({
    routes: args.routes,
    subject: subjectOfRow(args.row),
    under: args.row.under,
    pins: args.pins,
    placement: args.placement,
    go: args.go,
    record: args.record,
    panels: args.panels,
    more: [...text, ...folds],
  })
}
