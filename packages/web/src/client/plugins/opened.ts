/**
 * The plugin panel stays open when its own switch removes a provider and
 * rebuilds the provider tree. It also follows the desktop/phone placement.
 * Geometry remains local to each trigger; only visibility belongs to the tab.
 */

import { createSignal } from "solid-js"

import type { HeldOpen } from "../popover.ts"

const [open, setOpen] = createSignal(false)

/** The plugins door's open state, as `createPopover` takes it. */
export const pluginsDoor: HeldOpen = { open, setOpen }
