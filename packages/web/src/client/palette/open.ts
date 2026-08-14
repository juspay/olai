/**
 * Whether the palette is up — a module signal, because two things open it and
 * only one of them is inside it.
 *
 * The chord is the palette's own (`Palette.tsx` holds the one window key
 * listener). The other opener is the HEADER on a phone, where there is no ⌘K
 * to press and the bar has no room for a box: the magnifier there opens THIS
 * modal rather than growing a second search surface. A prop drilled from
 * `App.tsx` down to `AppHeader` would have worked and would have said less;
 * the layout preferences next door are module signals for the same reason
 * (`../layout/prefs.ts`'s `setChatOpen`, which the palette itself calls).
 *
 * It holds no more than the boolean. What OPENING means — the caret, the
 * remembered focus, the emptied query — stays inside the palette, which is
 * the only thing that knows those.
 */

import { createSignal } from "solid-js"

const [paletteOpen, setPaletteOpen] = createSignal(false)

export { paletteOpen, setPaletteOpen }
