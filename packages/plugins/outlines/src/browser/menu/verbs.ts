import {
  customOf,
  isMirror,
  MARKS,
  type Node,
  type LocatedRegular,
  type Row,
  type Situated,
  type Status,
} from "@olai/format"
import type { Edit } from "@olai/surface"
import type { Shelf } from "@olai/format"
import { datePick } from "../date/pick.ts"
import { repeatPick } from "../date/repeat.ts"
import { type Relation, RELATIONS } from "../edges/relation.ts"
import { pinnedAt } from "olai-plugin-pins/values"
import { customEntries } from "olai-plugin-outlines/property-values"
import { zoomNode, hrefOfPlain } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting as Routing } from "olai-plugin-navigation/workspace"
import { trashQuestion } from "olai-plugin-trash/questions"

export interface Subject {
  readonly record: Node
  readonly shows: LocatedRegular | undefined
  readonly status: Status | undefined
}

export const subjectOfRow = (row: Row): Subject => ({
  record: row.at.node,
  shows: row.kind === "node" || row.kind === "mirror" ? row.shows : undefined,
  status: row.status,
})

export const shownIdOf = (subject: Subject): string =>
  subject.shows?.node.id ?? subject.record.id

export const subjectOfSituated = (situated: Situated): Subject => ({
  record: situated.shows.node,
  shows: situated.shows,
  status: situated.status,
})

export type Does =
  | { readonly kind: "edit"; readonly edit: Edit }
  | { readonly kind: "pick-date" }
  | { readonly kind: "pick-repeat" }
  | { readonly kind: "pick-edge"; readonly relation: Relation }
  | { readonly kind: "pick-move" }
  | { readonly kind: "add-prop" }

const sends = (edit: Edit): Does => ({ kind: "edit", edit })

export type Group = "mark" | "plan" | "place" | "more" | "away"

export interface Verb {
  readonly id: string
  readonly label: string
  readonly group: Group
  readonly does: Does
  readonly confirm?: string
}

const MARK_MENU = {
  todo: { at: 0, label: "To do" },
  doing: { at: 1, label: "Doing" },
  done: { at: 2, label: "Done" },
  cancelled: { at: 3, label: "Cancelled" },
} as const satisfies Record<Status, { readonly at: number; readonly label: string }>

const MARK_LABEL: ReadonlyArray<readonly [Status, string]> = MARKS
  .map((mark) => [mark, MARK_MENU[mark]] as const)
  .sort(([, a], [, b]) => a.at - b.at)
  .map(([mark, entry]) => [mark, entry.label] as const)

export const writeVerbs = (
  routes: Routing,
  subject: Subject,
  under: number | undefined,
  shelf: Shelf,
  placement?: Parameters<typeof customEntries>[1],
): ReadonlyArray<Verb> => {
  const verbs: Array<Verb> = []
  const shown = subject.shows

  if (shown !== undefined) {
    for (const [mark, label] of MARK_LABEL) {
      if (subject.status === mark) continue
      verbs.push({
        id: `mark-${mark}`,
        group: "mark",
        label,
        does: sends({ verb: "mark", id: shown.node.id, mark }),
      })
    }
    if (subject.status !== undefined) {
      verbs.push({
        id: "clear-mark",
        group: "mark",
        label: "Clear",
        does: sends({ verb: "mark", id: shown.node.id, mark: null }),
      })
    }
    verbs.push({
      id: "set-date",
      group: "plan",
      label: shown.node.date === undefined ? "Set date…" : "Change date…",
      does: { kind: "pick-date" },
    })
    if (shown.node.date !== undefined) {
      verbs.push({
        id: "set-repeat",
        group: "plan",
        label: shown.node.repeat === undefined ? "Set repeat…" : "Change repeat…",
        does: { kind: "pick-repeat" },
      })
    }
    const pinned = pinnedAt(routes, shelf, zoomNode(shown.node.id))
    verbs.push(
      pinned === undefined
        ? {
          id: "pin",
          group: "plan",
          label: "Pin to sidebar",
          does: sends({ verb: "pin", at: hrefOfPlain(zoomNode(shown.node.id)) }),
        }
        : {
          id: "unpin",
          group: "plan",
          label: "Unpin from sidebar",
          does: sends({ verb: "trash", id: pinned.id }),
        },
    )
    if (customEntries(customOf(shown.node), placement).length === 0) {
      verbs.push({
        id: "prop-add",
        group: "more",
        label: "Add property…",
        does: { kind: "add-prop" },
      })
    }
    for (const one of RELATIONS) {
      verbs.push({
        id: `edge-${one.relation}`,
        group: "more",
        label: one.verb,
        does: { kind: "pick-edge", relation: one.relation },
      })
    }
  }

  verbs.push({
    id: "move-to",
    group: "place",
    label: "Move to…",
    does: { kind: "pick-move" },
  })

  if (isMirror(subject.record)) {
    verbs.push({
      id: "remove-placement",
      group: "more",
      label: "Remove from here",
      does: sends({ verb: "unmirror", id: subject.record.id }),
    })
  }
  if (shown?.node.date !== undefined) {
    verbs.push({ id: "clear-date", group: "more", label: "Clear date", does: sends(datePick(shown.node.id, "")) })
    if (shown.node.repeat !== undefined) {
      verbs.push({ id: "clear-repeat", group: "more", label: "Stop repeating", does: sends(repeatPick(shown.node.id, "")) })
    }
  }
  if (!isMirror(subject.record) && shown !== undefined) {
    verbs.push({
      id: "duplicate",
      group: "place",
      label: "Duplicate",
      does: sends({ verb: "duplicate", id: subject.record.id }),
    })

    if (under === undefined) return verbs

    verbs.push({
      id: "trash",
      group: "away",
      label: "Move to Trash",
      does: sends({ verb: "trash", id: shown.node.id }),
      confirm: trashQuestion({ kind: "row", title: shown.node.title }, under),
    })
  }

  return verbs
}
