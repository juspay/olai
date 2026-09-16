/**
 * THE MAIL FACES' TEST IDS — this plugin's half of olai's testid table.
 *
 * Names only, and this module imports nothing (`olai-plugin-odu`'s `./testids.ts`
 * argues why at length, one appliance over): `packages/tests` runs under a
 * cucumber process with no browser in it, and an id door that pulled a component
 * would put SolidJS — and, through the appliance, a token broker — on the graph
 * of a suite that only wanted a string.
 */

export const TESTID = {
  mailStory: "mail-story",
  /** THE HEADER READOUT — `data-mail` is `absent` / `connected` / `fault`, a
   *  closed set, and it is the pill's whole assertion. `data-address` carries
   *  the connected address so a scenario asserts WHICH mailbox without reading
   *  the sentence beside it. */
  mail: "mail",
  /** THE PANEL ROW'S OWN FACE — the hint and the Connect / Reconnect /
   *  Disconnect buttons this plugin hangs in the plugins panel's row extra
   *  (`./browser/Row.tsx`). `data-mail-row` is the account's status, verbatim.
   *  The buttons are `data-mail-action=connect|disconnect`, and a testid rather
   *  than a label because the label is a sentence a person reads. */
  mailRow: "mail-row",
  mailAction: "mail-action",
  /** THE REFUSAL a press produced — the sentence the connect or the disconnect
   *  came back with, drawn under the buttons that asked for it. */
  mailRefused: "mail-refused",
  /** THE REDIRECT the row tells a person to register, drawn only when it is
   *  knowable (`data-mail-redirect` carries the same string). */
  mailRedirect: "mail-redirect",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/mail": OwnedTestIds }
}
