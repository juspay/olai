/**
 * THE WAY TO WHAT WAS PUT AWAY — one quiet row at the column's foot, and its
 * icon at the rail's.
 *
 * A `sidebar.entry` placed `foot`: the sidebar pins it under the scrolling list
 * so it stays in view however long the tree runs (the 2026-09 simplification).
 * It used to nest under the files row's vault group, which made the Trash's
 * presence depend on the file tree being mounted — a door into this row's own
 * page, withdrawn by another row's lifetime. Now it comes and goes with this
 * row alone.
 *
 * Always drawn while the row stands, like the agenda: an empty trash is a fact
 * a reader may want, not a control to hide until it would say something. It is
 * current when the ROUTE is the trash page — the trash belongs to no one file.
 */
import { TESTID } from "olai-plugin-trash/testids"

import { RailButton } from "@olai/ui-primitives/RailButton.tsx"

import { ENTRY_SHAPE } from "olai-plugin-layout/entry"
import { Link,useRouter } from "olai-plugin-navigation/routing"

const TRASH_ROUTE = { kind: "trash" } as const

export function Trash() {
  const router = useRouter()
  return (
    <Link
      route={TRASH_ROUTE}
      // The quiet ink says what the row is: a door onto a page, not one more
      // file of the reader's own.
      class={`${ENTRY_SHAPE} text-paper/60`}
      testid={TESTID.trashLink}
      current={router.route().kind === "trash"}
    >
      {/* No glyph and no fold seat: a door of the column like Agenda and
          Today, so it shares their left edge rather than the tree's. */}
      <span class="min-w-0 truncate">Trash</span>
    </Link>
  )
}

/** The same door, collapsed: the rail's foot. */
export function TrashRail() {
  const router = useRouter()
  return (
    <RailButton testid={TESTID.railTrash} label="Open Trash" title="Trash" onClick={() => router.go(TRASH_ROUTE)}>
      <TrashGlyph class="size-4" />
    </RailButton>
  )
}

function TrashGlyph(props: { readonly class: string }) {
  return (
    <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true" fill="currentColor">
      <path d="M6.5 1.75a.75.75 0 0 0-.75.75V3H3a.75.75 0 0 0 0 1.5h.3l.66 8.6A1.75 1.75 0 0 0 5.7 14.75h4.6a1.75 1.75 0 0 0 1.74-1.65l.66-8.6H13A.75.75 0 0 0 13 3h-2.75v-.5a.75.75 0 0 0-.75-.75zm-1.7 2.75h6.4l-.65 8.49a.25.25 0 0 1-.25.26H5.7a.25.25 0 0 1-.25-.26z" />
    </svg>
  )
}
