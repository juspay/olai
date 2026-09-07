/**
 * WHAT OTHER PLUGINS HUNG, as the shell reads it.
 *
 * The shell is the reader of four slots other rows fill — the mounts that wrap
 * the page, the bar's cluster and lead seats, the panel and the viewer — and it
 * used to read them out of `@olai/web`'s `client/plugins/runtime.ts`, which is
 * the module that assembles the browser application. It reads them off
 * {@link Faces} now, named in `./browser.tsx`'s own `needs`.
 *
 * PRIVATE TO THIS PACKAGE, and that is the load-bearing half: this module is
 * behind no declared contract, so the value cannot become a second undeclared
 * cross-package path to the same table. What is shared is the ALGORITHM
 * (`heldFaces`, a factory in the plugin API); what is not shared is this
 * holder.
 */
import { heldFaces } from "@olai/plugin-api"

export const { hold: holdFaces, hung, only } = heldFaces()
