import { MailWake } from "./browser/Wake.tsx"

import { createRoot } from "solid-js"
import { Bar, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import type { Accessor } from "solid-js"

import type {} from "olai-plugin-chat/slots"
import { story } from "./browser/story.tsx"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-plugin-inspector/slots"

import { MailReadout } from "./browser/Mail.tsx"
import { mailSaid } from "./browser/said.ts"
import { type MailClient, MailRow, mailNeedsYou } from "./browser/Row.tsx"
import { MAIL_UNCONNECTED, type Account, name, surface } from "./wire.ts"

export { name, surface }

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
    const owned = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot(dispose => {
      const value = client.cells.account.use().value
      return ({
        dispose,
        account: (): Account => value() ?? MAIL_UNCONNECTED,
      })})),
      (held) => Effect.sync(held.dispose),
    )

    yield* slots.register("conversation.wake", context => <MailWake {...context} />)
    yield* slots.register("delivery.mark", () => <span aria-label="Mail">✉</span>)

    yield* slots.register("tool.reply", { fileOf: () => null, story })

    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <MailReadout app={bar} account={owned.account} />,
      status: () => mailSaid(owned.account()),
    })

    yield* slots.register("plugins.row", {
      needs: () => mailNeedsYou(owned.account()),
      body: () => <MailRow account={owned.account} client={client} />,
    })
  }),
})
