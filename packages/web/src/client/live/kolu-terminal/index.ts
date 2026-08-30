/**
 * THE TERMINAL DOOR, registered — the live-properties seam's first tenant.
 *
 * A `terminal` property draws kolu's own Dock row where the property is, plus
 * the live pane that row opens. The COMPONENT is `@olai/kolu-ui`'s, behind a
 * package wall, because it renders kolu's row and mounts kolu's emulator and
 * that is an appliance's implementation. What lives here is the one fact the
 * app owns: that this key wears that face.
 *
 * ## Why it wears the BLOCK face
 *
 * A terminal somebody named is worth a row whether or not anything is
 * happening in it — there is no quiet state to be quiet about, because the
 * fleet always has something to say (a live row, or the sentence saying why
 * there is none). So the door takes the row and takes the value with it, where
 * the CI face next door is a chip that draws nothing most of the time.
 *
 * ## Why the folder REGISTERS ITSELF, which reverses an earlier argument
 *
 * The seam's registration used to be a call the drawer made, and the reason
 * written down was that "a self-registrant would put the appliance in charge
 * of the app's table, and the import direction would be a lie told by an
 * `import "…"` with no binding". That was true while a dressing WAS an
 * appliance — a component reached across a package wall. It is not true of a
 * folder under `client/live/`: this is the app's own tree, registering the
 * app's own table, and what a reader gets in exchange is that everything about
 * one dressing is in one directory rather than split between a component and a
 * line in the drawer (the human's ruling on #433).
 *
 * The seam itself imports NO dressing, which is the half that has to keep
 * holding: `../dressings.ts` is the one module that names all three, and it is
 * imported for its effect by the drawer.
 */

import { TerminalBlock } from "@olai/kolu-ui"

import { registerLive, TERMINAL_KEY } from "../seam.ts"

// Against `TERMINAL_KEY` — `@olai/surface`'s exported constant, composed out
// of the appliance slice that owns it — never the string `"terminal"`: the key
// is the wire's, one spelling, and a literal here would be a second one
// waiting to drift from the one the server reads.
registerLive(TERMINAL_KEY, { Block: TerminalBlock })
