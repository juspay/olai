/**
 * The minimized desktop sidebar: a ~3rem icon rail.
 *
 * App chrome never disappears — expand, plugin entries, outlines, docs stay as
 * affordances even when the full directory column is put away. The connection
 * dot and the agent toggle stay in the HEADER (reconciled with #101); this
 * rail is only the directory's collapsed face.
 *
 * Which is why it is PINNED on the same terms the open column is
 * (`../Sidebar.tsx`): `sticky` under the header, as tall as what is left of the
 * viewport. "Never disappears" is a claim about the screen, not about the
 * document — five icons at the top of a page-tall column are gone as soon as
 * anybody reads past the fold, and the first of them is the way to get the
 * directory back. It scrolls within itself in a window too short for five
 * buttons rather than clipping the last of them.
 */

import { Glyph } from "../file/icons.tsx"
import { PluginRailEntries } from "../plugins/Seats.tsx"
import { HOME_ROUTE, type Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { setSidebarOpen } from "./prefs.ts"

/** How big an icon on this rail is. Spelled once because five buttons draw one
 *  — three inline here and two that are the directory's own glyphs
 *  (`../file/icons.tsx`, which takes its size from whoever draws it) — and a
 *  rail whose icons are not all one size is the only thing a reader would
 *  notice about the number. */
const ICON = "size-4"

export function Rail(props: {
  /** Navigate without a full Link tree — the rail is outside the router
   *  provider on some screens, so it takes a callback the shell already has. */
  readonly go: (route: Route) => void
}) {
  return (
    <div
      class="olai-frame sticky top-[var(--height-header)] hidden h-[calc(100dvh-var(--height-header))] w-[var(--width-rail)] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-paper/20 py-2 md:flex"
      data-testid={TESTID.sidebarRail}
      aria-label="directory rail"
    >
      <RailButton
        testid={TESTID.sidebarExpand}
        label="expand the sidebar"
        title="expand sidebar"
        onClick={() => setSidebarOpen(true)}
      >
        {/* chevron-right */}
        <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </RailButton>

      <PluginRailEntries place="top" />

      <RailButton
        testid={TESTID.railOutlines}
        label="open outlines"
        title="outlines"
        onClick={() => {
          setSidebarOpen(true)
          props.go(HOME_ROUTE)
        }}
      >
        {/* The tree's own outline glyph (../file/icons.tsx), at the rail's
            size. Both faces of this column already agree about what is OWED;
            they agree about what an OUTLINE is for the same reason — a reader
            who collapses the column has not gone somewhere else. */}
        <Glyph of="outline" size={ICON} />
      </RailButton>

      <RailButton
        testid={TESTID.railDocs}
        label="open the directory"
        title="documents"
        onClick={() => setSidebarOpen(true)}
      >
        {/* And the tree's document glyph, for the same reason. */}
        <Glyph of="document" size={ICON} />
      </RailButton>

      <PluginRailEntries place="bottom" />
    </div>
  )
}

export function RailButton(props: {
  readonly testid: string
  readonly label: string
  readonly title: string
  /** Optional semantic facts owned by the caller, without teaching this shell
   * button any tenant's vocabulary. */
  readonly data?: { readonly [key: `data-${string}`]: string | undefined }
  readonly onClick: () => void
  readonly children: import("solid-js").JSX.Element
}) {
  return (
    <button
      type="button"
      // `relative`: the agenda's dot is absolute against this box, and the
      // containing block is declared once, here, rather than by whichever child
      // happens to need one.
      class={`${TARGET_BOX} relative inline-flex items-center justify-center rounded-xl text-paper/65 hover:bg-paper/10 hover:text-paper md:min-h-9 md:min-w-9`}
      {...props.data}
      data-testid={props.testid}
      aria-label={props.label}
      title={props.title}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}
