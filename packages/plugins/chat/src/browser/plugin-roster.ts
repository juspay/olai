/**
 * IS THE TAB REPLACING ITS WIRE RIGHT NOW — the one fact this half reads out
 * of the app's management door, held for the activation that declared it.
 *
 * A plugin switched on or off moves the server's bundle, and the tab follows:
 * it loads the halves the new roster names, DIALS A NEW WIRE, and composes the
 * fibers over it (`@olai/web`'s `client/wire.ts`). Every call still in flight
 * on the old connection is interrupted at the dial — not refused by anything,
 * simply never answered — and `@olai/web`'s `client/run.ts` hands that back as
 * `busy`: *the server did not take it, try again*.
 *
 * So a face that ASKS A QUESTION has to know when that is happening, or it is
 * left holding an empty answer with nothing to tell it the answer was never
 * given. `New chat`'s item level is that face (`./agents/new-chat-level.ts`):
 * it asks once per question, and a question asked across a recompose comes
 * back with nothing.
 *
 * ## The signal is the app's own, and it arrives as a SERVICE
 *
 * `browserManagement` is the declared door the plugins panel already reads
 * (`olai-plugin-plugin-inspector`'s rows freeze while `changing()` is true, so
 * a knob is not pressed into a connection that is going away). Its `changing`
 * is `@olai/web`'s `rosterChanging`, which is up from the first frame of a
 * roster change until the composition that follows it has settled — exactly
 * the span in which a call is interrupted, and exactly the edge a refused
 * question wants to be told about.
 *
 * Read through the door rather than imported: `rosterChanging` is a live value
 * in another package, and the two rows that reach for it directly are the
 * ownership defect the Cordis audit's §12 names. The hold is this
 * activation's and clears by identity (`@olai/ui-primitives`'s `held.ts`), and
 * the read is a Solid signal, so a memo or an effect that asks is re-run when
 * the door arrives, when it leaves, and on every edge of the change itself.
 *
 * ## The absent answer is `false`, and that is the honest one
 *
 * With no management door mounted there is nobody replacing a wire on this
 * tab's behalf — a serve with no plugins panel cannot change its own roster
 * from here — so a question asked under that reading is a question that may be
 * asked. The alternative, treating "I was not told" as "something is moving",
 * would leave a level permanently silent on exactly the serves that never
 * recompose at all.
 */
import type { BrowserManagement } from "@olai/surface/management"
import { heldService } from "@olai/ui-primitives/held.ts"

/** The half of `browser-management` this row reads: one boolean. */
type Changing = Pick<BrowserManagement, "changing">

const provider = heldService<Changing>()

/** Told by `../browser.tsx`'s `plugins` component, for that activation. */
export const holdPluginRoster = provider.hold

/** Whether this tab is bringing its wire into line with the server's plugin
 *  roster — loading halves, dialling, composing. A tracked read. */
export const pluginsChanging = (): boolean => provider.read()?.changing() ?? false
