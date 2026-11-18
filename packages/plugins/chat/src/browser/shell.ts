/**
 * THE SHELL'S GEOMETRY, as chat's pages read it — held for the activation that
 * declared it.
 *
 * One reading: whether the viewport is at the phone/desktop split. Below it
 * the panes are a STRIP OF TABS, one at a time (`olai-plugin-layout`'s
 * `Panes.tsx`), so "beside" names nothing a reader would see — the chat page's
 * own door says *Open <name> ›* there and puts the item in the next tab
 * (`./agents/OpenBeside.tsx`).
 *
 * It arrives on `layout.shell` (`olai-plugin-layout/contract`), declared on
 * `../browser.tsx`'s `shell` component. A COMPONENT AND NOT THE ROW, and that
 * is load-bearing: content runs under another layout entirely
 * (`olai-plugin-test-layout`, `alternate_layout.feature`), so a row that
 * waited for the shell would be a row that could not. With no shell mounted
 * this answers a phone-width viewport, which is what every reading of it
 * answered before the door existed.
 */
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

/** Told by `../browser.tsx`'s `shell` component, for that activation. */
export const holdShell = provider.hold

/** Is the viewport at the phone/desktop split? */
export const desktop: Accessor<boolean> = () => provider.read()?.desktop() ?? false
