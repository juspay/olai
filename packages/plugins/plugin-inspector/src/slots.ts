/**
 * Static extension contracts owned by the plugin inspector.
 *
 * ## `plugins.row` — a row's own plugin draws in it
 *
 * THE PANEL IS A WALK over the build: one row per plugin the serve has, drawn
 * by this package alone, because a plugin's enablement is the INSTANCE's fact
 * and not the reader's (`./Panel.tsx` argues that at length). The walk knows
 * what the serve told it — the state, the reason, what pressing Off would cost
 * — and it cannot know the one thing some rows owe: that the row is waiting on
 * a PERSON, in the plugin's own words and with the plugin's own verb. The mail
 * row is the worked case and the reason the slot exists: it is running, nothing
 * is wrong with it, and until somebody connects an account it can do nothing at
 * all. Core cannot write that sentence, and it must not learn the plugin's word
 * for the button beside it — which is `@olai/plugin-api`'s own split, core
 * keeps the shape and the plugin brings the words.
 *
 * ## Two functions, because the walk asks BEFORE anything is drawn
 *
 * {@link PluginsRowFace.needs} is the half the GROUPING reads: a row whose own
 * plugin says it needs you is filed under **Needs you** with the failed and
 * waiting rows, so a person finds it where they already look for what is
 * stuck. That reading happens in `./rows.ts`, which is pure policy over the
 * roster, so the only thing that can cross into it is a boolean — the panel
 * hands it the reader (`./Panel.tsx`), the file stays a function of its
 * arguments, and no module table is consulted anywhere.
 *
 * {@link PluginsRowFace.body} is the half the ROW reads, and it draws inside
 * the row's extra area: below the row's own hint, above the confirm a press
 * about to cost something raises. The face owns BOTH its sentence and its
 * buttons, because the row above it speaks only for the serve's reading of the
 * build while a connection is an account's business; and the panel draws
 * nothing at all where no face is hung.
 *
 * ## Keyed by the contributing plugin, and by nothing else
 *
 * A row IS a plugin, so one contributor gets one face in one row and the key
 * is the framework's own owner key — the same word the roster's rows carry
 * (`@olai/plugin-api`'s `Hung`). Two plugins cannot draw into one row, and a
 * plugin cannot draw into another's.
 */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/**
 * WHAT A PLUGIN HANGS ON ITS OWN ROW, read at two moments.
 *
 * `needs` is asked on every walk over the roster, before that row is drawn —
 * it is the row's answer to *does a person have to do something here*, and it
 * must be a cheap reading of whatever live state the plugin already holds. It
 * takes nothing, because the walk has nothing to hand over: the row's name is
 * the key it was found under.
 *
 * `body` draws in the row's extra area, which is a column beside the row's
 * controls rather than a sentence in it. It takes nothing for `needs`' reason
 * and one more: the face closes over its own services in its own `apply`, so a
 * plugin that reads its account state there cannot be handed a second copy of
 * it here.
 */
export interface PluginsRowFace {
  /** Does this row need a person? The panel files it under **Needs you** when
   *  it does (`./rows.ts`'s `pluginGroups`), and draws it with the ordinary
   *  rows otherwise. */
  readonly needs: () => boolean
  /** ...and what that person is shown: the row's own sentence and its verbs. */
  readonly body: () => JSX.Element
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "plugins.row": SlotDefinition<PluginsRowFace, "plugin">
  }
}

/** The seat a plugin hangs its row's own drawing in, and the declaration the
 *  panel's tools entry offers as a child (`./browser.tsx`) — a registration
 *  into a location no active entry declared would simply wait. */
export const pluginsRow = slotContract<PluginsRowFace>("plugins.row", "plugin")
