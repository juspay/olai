/**
 * THE DOCK: one conversation read BESIDE the page, in the seat the shell
 * reserves on the right (`olai-plugin-layout`'s `app.panel`).
 *
 * A conversation lives on its row — unfolded under it, or on the node's own
 * page — and that is still where it lives. What the dock adds is a THIRD
 * face: the same conversation, in a column that stays put while the reader
 * moves between pages. Reading an outline and talking to the agent that is
 * working on it are one activity, and a face that scrolled away with the page
 * (the fold) or replaced the page (the node page) made them two.
 *
 * ## What is the shell's, what is this row's
 *
 * The COLUMN is the shell's: whether it is open, how wide, the handle on its
 * edge and the breakpoint it exists above all arrive on `layout.shell`, so
 * this row never decides geometry. WHICH conversation is in it is this row's:
 * a node id, remembered by this browser under `olai.chat.dock` so a reload
 * brings the same agent back beside the page, exactly as the sidebar width is
 * remembered. The two are kept apart on purpose — a column with nothing docked
 * draws the roster as a picker rather than nothing, so "open" and "showing
 * somebody" are two facts.
 *
 * ## Absence
 *
 * Held for the `dock` component's activation (`../browser.tsx`), which is the
 * one that declares the shell. With no shell — content under another layout,
 * a phone-only serve — `dock()` answers `undefined` and every door that would
 * offer the panel draws nothing: the sidebar row's action, the agent line's
 * link, the chord and the palette row are all that component's, and leave
 * with it.
 */
import type { Accessor } from "solid-js"
import { onCleanup } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import { createPreference } from "@olai/web/client/preference.ts"
import type { Shell } from "olai-plugin-layout/contract"

/** Where THIS BROWSER remembers which conversation is docked. Namespaced with
 *  every other preference it keeps (`@olai/web`'s `preference.ts`). */
export const DOCK_KEY = "olai.chat.dock"

export interface Dock {
  /** The node whose conversation is docked, or nothing — the picker. */
  readonly node: Accessor<string | undefined>
  /** Dock a node's conversation and open the column. */
  readonly open: (node: string) => void
  /** Forget the docked conversation; the column, if open, shows the picker. */
  readonly clear: () => void
  /** The shell's own three, re-exported so a door in this row names one
   *  service rather than two. */
  readonly opened: Accessor<boolean>
  readonly show: () => void
  readonly close: () => void
  readonly toggle: () => void
  /** Whether the column can be drawn at all — a phone has no seat. */
  readonly desktop: Accessor<boolean>
}

/** One dock per activation, created under an owner so its preference
 *  listener is released with it. */
export const createDock = (shell: Shell): Dock => {
  const docked = createPreference(DOCK_KEY, {
    parse: (raw) => (raw === null || raw === "" ? undefined : raw),
    print: (value) => value ?? null,
  })
  onCleanup(docked.follow())
  return {
    node: docked.value,
    open: (node) => {
      docked.set(node)
      shell.setPanelOpen(true)
    },
    clear: () => docked.set(undefined),
    opened: shell.panelOpen,
    show: () => shell.setPanelOpen(true),
    close: () => shell.setPanelOpen(false),
    toggle: shell.togglePanel,
    desktop: shell.desktop,
  }
}

const held = heldService<Dock>()
/** Told by `../browser.tsx`'s `dock` component, for that activation. */
export const holdDock = held.hold
/** The dock, or `undefined` where no shell holds a seat for one. */
export const dock = held.read
