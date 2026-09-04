/**
 * WHETHER THE PLUGINS DOOR IS OPEN — a module signal, because the control
 * inside this panel is the one control in the app that destroys the panel
 * around it.
 *
 * ## The failure this exists to close
 *
 * Press Off on a plugin row. The flip lands, the roster moves, and a roster
 * change is a REDIAL: a new wire, every standing subscription dead, and the
 * whole tree rebuilt under the keyed `<Show>` in `../main.tsx`. The rebuild is
 * correct — it is what makes a plugin's arrival and departure real in the tab,
 * and nothing here weakens it. What was wrong is that the rebuilt tree made a
 * fresh `createPopover`, whose open state starts shut, so the panel a person was
 * standing in disappeared at the exact moment they used it. Flipping a second
 * row meant finding the chip again; flipping the first one BACK meant the same.
 *
 * On the chat row it was worse than inconvenient. Chat's flip is the slow one —
 * every engine and every tenant unloads with it — so the strip never got as far
 * as reading Off before the panel was torn out, and the press looked to the
 * person like a control that did nothing at all.
 *
 * ## Why this door and no other
 *
 * `../main.tsx` lists what a redial costs — *an open pane, a scroll position, a
 * half-typed editor* — and that list is still right for all of them but one.
 * Every other piece of local state is destroyed by an event the reader did not
 * aim at this panel; this one is destroyed BY ITS OWN CONTROL, every time, on
 * purpose. A control that cannot be used twice without hunting for its own door
 * again is not a control that has a cost, it is a control with a defect.
 *
 * So the fix is as narrow as the case: *which door is open* is a fact about the
 * PAGE — it survives a subscription being replaced the way the page's URL does —
 * and it is kept here, above the tree, for the one door whose contents can cause
 * the rebuild. Preferences and Commit hold no such control and keep their own
 * state, which is what makes a RELOAD still forget them (see
 * `../popover.ts`'s `HeldOpen`).
 *
 * ## ONE DOOR AT A TIME, which is what makes one signal enough
 *
 * `Plugins` is mounted twice in the source and never twice on screen: the bar
 * chip is inside `<Show when={desktop()}>` and the drawer row inside the
 * complementary one (`../AppHeader.tsx`, `../App.tsx`). Two of them mounted at
 * once would share this and portal two panels, so if a third placement is ever
 * added it has to keep that exclusivity — which is why it is written down here
 * rather than left as a property somebody would have to notice.
 *
 * ## What it does NOT hold
 *
 * WHERE the panel goes. That is measured from the trigger's own box and is
 * per-mount by nature — a rebuilt door has a new button element, and a stale
 * rectangle would place the panel against a node that no longer exists.
 * `createPopover`'s effect re-measures whenever `open()` is true, which on a
 * rebuilt door is at mount, so the geometry is recomputed for free and there is
 * nothing to carry across.
 */

import { createSignal } from "solid-js"

import type { HeldOpen } from "../popover.ts"

const [open, setOpen] = createSignal(false)

/** The plugins door's open state, as `createPopover` takes it. */
export const pluginsDoor: HeldOpen = { open, setOpen }
