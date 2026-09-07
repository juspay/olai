/** The service boundary binds delivery authority to the calling Cordis activation. */
import type { Deliveries, Wakes, Provision } from "@olai/plugin-api/services"
import { Effect } from "effect"
import type { Chat } from "../scoped.ts"

export const deliveryProvision = (
  chat: () => Pick<Chat, "doorFor"> | null,
  wakes: Wakes["current"],
): Provision<Deliveries> => (who, lifetime) => {
  const current = lifetime?.current ?? (() => false)
  const recipients = (rows: ReturnType<Deliveries["scopes"]>) => rows.map((row) => ({
    ...row, current: () => current() && row.current(),
  }))
  return {
    scopes: () => current() ? recipients(chat()?.doorFor(who).scopes() ?? []) : [],
    ringing: (file, node) => current() ? recipients(chat()?.doorFor(who).ringing(file, node) ?? []) : [],
    deliver: (to, say, how) => Effect.suspend(() => current()
      ? chat()?.doorFor(who).deliver({ ...to, current: () => current() && to.current() }, say, how) ?? Effect.void
      : Effect.void),
    notify: (to, say, how) => Effect.suspend(() => current() && !wakes().has(who)
      ? chat()?.doorFor(who).deliver({ ...to, current: () => current() && !wakes().has(who) }, say, how) ?? Effect.void
      : Effect.void),
  }
}
