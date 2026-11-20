import type { Sort } from "@olai/format"

export const SAID: Readonly<Record<Sort, string>> = {
  created: "Created",
  trashed: "Moved to Trash",
  gone: "Removed",
  done: "Done",
  undone: "No longer done",
  cancelled: "Cancelled",
  uncancelled: "No longer cancelled",
  doing: "Started",
  "not-doing": "No longer started",
  moved: "Moved",
  scheduled: "Scheduled",
  unscheduled: "Unscheduled",
  noted: "Note changed",
  renamed: "Renamed",
  linked: "Links changed",
  edited: "Edited",
}

export const GLYPH: Readonly<Record<Sort, string>> = {
  created: "+",
  trashed: "⌦",
  gone: "⌦",
  done: "✓",
  undone: "○",
  cancelled: "✗",
  uncancelled: "○",
  doing: "◐",
  "not-doing": "○",
  moved: "⇅",
  scheduled: "◷",
  unscheduled: "◷",
  noted: "✎",
  renamed: "✎",
  linked: "→",
  edited: "✎",
}
