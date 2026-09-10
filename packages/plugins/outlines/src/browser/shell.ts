/**
 * THE SHELL'S GEOMETRY, as an outline page reads it — held for the activation that
 * declared it.
 *
 * One reading: whether the right panel is open, which is what decides how
 * wide the page's own column may be.
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
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

/** Told by ``../browser.tsx`'s `shell` component`, for that activation. */
export const holdShell = provider.hold

/** Is the right panel open? */
export const panelOpen: Accessor<boolean> = () => provider.read()?.panelOpen() ?? false

/** Is the viewport at the phone/desktop split? */
export const desktop: Accessor<boolean> = () => provider.read()?.desktop() ?? false
