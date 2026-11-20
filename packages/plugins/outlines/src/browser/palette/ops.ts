import type { Situated } from "@olai/format"
import { NO_PINS } from "@olai/format"

import type { WorkspaceRouting } from "olai-plugin-navigation/workspace"
import { subjectOfSituated, writeVerbs } from "../menu/verbs.ts"
import type { PaletteItem } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"

export const opItems = (
  routes: WorkspaceRouting,
  zoomed: Situated | undefined,
  under: number | undefined,
): ReadonlyArray<PaletteItem> => {
  if (zoomed === undefined) return []
  const title = zoomed.shows.node.title
  return writeVerbs(routes, subjectOfSituated(zoomed), under, NO_PINS).flatMap((verb) =>
    verb.id !== "pin" && verb.id !== "unpin" && verb.does.kind === "edit"
      ? [{
        id: `op-${verb.id}`,
        label: verb.group === "mark" ? `Mark: ${verb.label}` : verb.label,
        place: `on “${title}”`,
        action: { kind: "edit" as const, edit: verb.does.edit, confirm: verb.confirm },
        taking: atOnce,
        search: title.toLowerCase(),
      }]
      : []
  )
}
