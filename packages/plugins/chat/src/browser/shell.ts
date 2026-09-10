/**
 * THE SHELL'S GEOMETRY, as the panel reads it — held for the activation that
 * declared it.
 *
 * This row is the tenant of the shell's right seat, so it reads and moves
 * nearly all of it: whether the seat is open, how wide it is, which snap the
 * mobile sheet is on, and the drag handle the seat is resized by.
 *
 * It arrives on `layout.shell` (`olai-plugin-layout/contract`), declared on
 * ``../browser.tsx`'s `shell` component`. It used to arrive as bare accessors imported from
 * `olai-plugin-layout/preferences` and `/media`: module signals in that row's
 * own doors, read straight across the wall with no dependency declared
 * anywhere (the audit's §12).
 *
 * A COMPONENT AND NOT THIS ROW, and that is load-bearing: content runs under
 * another layout entirely (`olai-plugin-test-layout`,
 * `alternate_layout.feature`), so a row that waited for the shell would be a
 * row that could not. With no shell mounted the readings below answer exactly
 * what they answered before — a phone-width viewport, a shut panel, an open
 * sidebar — and the presses do nothing.
 */
import type { Accessor, JSX } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

/** Told by ``../browser.tsx`'s `shell` component`, for that activation. */
export const holdShell = provider.hold

/** Is the right panel open? */
export const panelOpen: Accessor<boolean> = () => provider.read()?.panelOpen() ?? false

export const setPanelOpen = (open: boolean): void => provider.read()?.setPanelOpen(open)

export const togglePanel = (): void => provider.read()?.togglePanel()

/** Live width, clamped to the current viewport. */
export const panelWidth: Accessor<number> = () => provider.read()?.panelWidth() ?? 0

export const panelSnap = (): "half" | "full" => provider.read()?.panelSnap() ?? "half"

export const setPanelSnap = (snap: "half" | "full"): void => provider.read()?.setPanelSnap(snap)

/** Is the viewport at the phone/desktop split? */
export const desktop: Accessor<boolean> = () => provider.read()?.desktop() ?? false

/** The panel's own drag handle — nothing at all where there is no shell to
 *  resize. */
export const PanelHandle = (): JSX.Element => provider.read()?.PanelHandle()
