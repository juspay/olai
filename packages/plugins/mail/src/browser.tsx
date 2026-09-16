/**
 * MAIL'S BROWSER HALF — a plugin, exactly the shape its server half is.
 *
 * Two faces, and both of them are readings of one cell:
 *
 *   - `app.header` — the pill, desktop only, beside kolu's and odu's;
 *   - `plugins.row` (owned by `olai-plugin-inspector`) — the sentence and the
 *     Connect / Reconnect / Disconnect verbs, in the row the panel already
 *     draws for this plugin. That is the one thing in this PR outside this
 *     package: a slot the panel declares, so a plugin can hang something on its
 *     own row without the panel knowing what a mailbox is.
 *
 * ## Why the slot and not a page of our own
 *
 * A connect is a credential, and the panel is where this product puts
 * credentials: every plugin's environment readings are drawn there, the switch
 * that turns a row on is there, and a person who was told *set
 * OLAI_MAIL_OAUTH_CLIENT* reads it in the same place they press Connect. A
 * separate settings page would be a second place for the same decisions.
 *
 * ## The chunk is only fetched when the roster names the row
 *
 * This module is evaluated when a serve says `mail` is running — the roster is
 * what the browser learns the row from — so a serve with mail off evaluates none
 * of it, and every registration below unwinds by itself when the row leaves. The
 * `surface` and the schemas travel with it because the tab has to DIAL this
 * sibling before either face can read anything, and the spec is what it dials
 * by (`olai-plugin-odu`'s `./browser.tsx` argues the arrangement in full).
 */

import { createRoot } from "solid-js"
import { Bar, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import type { Accessor } from "solid-js"

// THE DECLARATION ONLY — the slot NAME below is checked against the table this
// module merges in, which is how a face looked up by a word and a slot declaring
// it cannot be two spellings. No value is imported: registering is by name.
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-plugin-inspector/slots"

import { MailReadout } from "./browser/Mail.tsx"
import { type MailClient, MailRow, mailNeedsYou } from "./browser/Row.tsx"
import { MAIL_UNCONNECTED, type Account, name, surface } from "./wire.ts"

export { name, surface }

/** The member this plugin's browser half reads: the account cell, at the depth
 *  the sibling client presents it (`cells.account`, not `cells.mail.account` —
 *  the key is consumed by the scope), plus the two procedures the row's buttons
 *  call. A member renamed in `./wire.ts` is a type error in this package rather
 *  than a pill that quietly never fills. */
interface AccountClient {
  readonly cells: {
    readonly account: {
      use: () => { readonly value: Accessor<Account | undefined> }
    }
  }
  readonly procedures: MailClient["procedures"]
}

export default definePlugin({
  name,
  needs: [Slots, Bar, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const slots = yield* Slots
    const wired = yield* Wired
    const client = wired.client() as AccountClient
    /** ONE ROOT for both faces, disposed with this activation's scope — a
     *  signal read after the row left would be a face drawing a sibling that is
     *  gone. */
    const owned = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot(dispose => ({
        dispose,
        account: (): Account => client.cells.account.use().value() ?? MAIL_UNCONNECTED,
      }))),
      (held) => Effect.sync(held.dispose),
    )

    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <MailReadout app={bar} account={owned.account} />,
    })

    /** THIS ROW'S OWN FACE IN THE PLUGINS PANEL. The key is the registering
     *  plugin's own name — the slot stamps it — so a face cannot be hung on
     *  somebody else's row, and the panel looks this up by the word it already
     *  draws. */
    yield* slots.register("plugins.row", {
      needs: () => mailNeedsYou(owned.account()),
      body: () => <MailRow account={owned.account} client={client} />,
    })
  }),
})
