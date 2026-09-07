/**
 * THE SHELL'S GEOMETRY, as the directory column reads it — held for the activation that
 * declared it.
 *
 * One verb: opening and closing the column this row draws.
 *
 * It arrives on `layout.shell` (`olai-plugin-layout/contract`), declared on
 * ``./browser.tsx`'s `shell` component`. It used to arrive as bare accessors imported from
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
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

/** Told by ``./browser.tsx`'s `shell` component`, for that activation. */
export const holdShell = provider.hold

export const setSidebarOpen = (open: boolean): void => provider.read()?.setSidebarOpen(open)
