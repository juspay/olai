/**
 * THE MAIL ROW'S OWN FACE — the sentence the row carries, and the two verbs a
 * person presses.
 *
 * This is drawn INSIDE the plugins panel's row, in the extra area under the
 * hint (`olai-plugin-inspector`'s `plugins.row` slot), which is why it owns no
 * layout of its own: the panel owns the grid, the switch, the environment
 * readings and the confirm, and this owns the one thing the panel cannot know —
 * what a Gmail account is and what to do about it.
 *
 * ## The three arms say three different things
 *
 *   - `absent` with the credentials in the environment: what Connect will do,
 *     and the redirect URI to register in Google Cloud. That URI is the ONE
 *     step outside olai in the whole design (`./wire.ts` argues why the page's
 *     own origin is what it is derived from), so it is drawn where the button
 *     is rather than in a doc.
 *   - `absent` with the credentials unset: the two doors, named — and NO
 *     button, because a Connect that can only fail is a button that teaches a
 *     person the feature is broken.
 *   - `connected`: what this serve is reading — the address, the mailbox's size,
 *     when the token was last refreshed and the scope Google granted — and ONE
 *     verb: Disconnect, in the alarm register, because forgetting an account is
 *     the destructive half of this face and there is nothing to reconnect to.
 *   - `fault`: what went wrong, in the words of whoever refused (Google's own
 *     error word, or the missing door's sentence), and BOTH verbs — Reconnect,
 *     which is the same press as Connect under the word that fits, and
 *     Disconnect, which a person who has given up on the grant needs.
 *
 * ## The refusal is a signal, and the cell is the server's
 *
 * A refused connect is this tab's own reading of one answer and is drawn under
 * the button that produced it. Everything a person can then look at — the
 * status, the address, the pill — comes off the account cell, which the server
 * writes: this component never guesses that a press worked.
 */

import { createSignal, Show, type Accessor } from "solid-js"
import { Effect, Result } from "effect"

import { TESTID } from "../testids.ts"
import { REDIRECT_PATH, type Account } from "../wire.ts"

/** The member of this plugin's sibling client this face spends — the account
 *  reading and the two procedures. Spelled structurally at the depth the client
 *  presents it (`cells.account`, not `cells.mail.account`: the key is consumed
 *  by the scope), so a renamed member in `../wire.ts` is a type error here. */
export interface MailClient {
  readonly procedures: {
    readonly connect: {
      readonly begin: (input: { readonly origin: string }) => Effect.Effect<{ readonly url: string }, unknown>
      readonly disconnect: () => Effect.Effect<unknown, unknown>
    }
  }
}

/** `needs` — whether the panel files this row under **Needs you**. A row is
 *  asking for a person exactly when a person can DO something about it: Connect
 *  when there is no account and the doors are set, Reconnect or Disconnect when
 *  there is a fault. A serve missing the two credential doors is not asking —
 *  the answer is an operator's, not a press. */
export const mailNeedsYou = (account: Account): boolean =>
  account.status === "fault" || (account.status === "absent" && account.reason === null)

/** The URI to register in Google Cloud, as this serve would hand it over: the
 *  one a connect has already used when there is one, and otherwise this page's
 *  own origin — which is the same value the next press will send. */
export const redirectFor = (account: Account, origin: string): string =>
  account.redirect !== "" ? account.redirect : `${origin}${REDIRECT_PATH}`

/**
 * WHAT A REFUSED CALL SAYS — this plugin's own sentence, or the honest nothing.
 *
 * Recognised by its `_tag` rather than by `instanceof`, which is
 * `@olai/format`'s rule for a failure that crossed a wire: the tag is what
 * survives decoding, and a decoded refusal may be a plain object with the tag
 * and no prototype at all (`olai-plugin-kolu`'s `asRefusal` narrows the same
 * way for its own refusal). Anything else is a defect rather than a refusal —
 * an input the schema would not encode, a socket that left — and it is said
 * about the page rather than about Gmail, with the detail in the console where
 * a defect belongs.
 */
const sentenceOf = (failure: unknown): string => {
  if (typeof failure === "object" && failure !== null && (failure as { _tag?: unknown })._tag === "MailRefusal") {
    const reason = (failure as { reason?: unknown }).reason
    if (typeof reason === "string" && reason !== "") return reason
  }
  console.warn("olai: a mail call failed in a way this row does not model", failure)
  return "olai could not do that — the detail is in the console."
}

export function MailRow(props: {
  readonly account: Accessor<Account>
  readonly client: MailClient
}) {
  const [refused, setRefused] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  /** ...AND NEITHER HANDLER EVER REJECTS. `Effect.result` catches the declared
   *  refusal; a defect arrives on the throw arm, and both arms end in a signal
   *  rather than in an unhandled rejection — which is what a press on a button
   *  in a panel owes. */
  const press = (call: () => Effect.Effect<{ readonly url: string } | unknown, unknown>): void => {
    if (busy()) return
    setRefused(null)
    setBusy(true)
    Effect.runPromise(Effect.result(call())).then(
      (outcome) => {
        setBusy(false)
        if (Result.isFailure(outcome)) return setRefused(sentenceOf(outcome.failure))
        const url = (outcome.success as { readonly url?: unknown }).url
        // A NEW TAB, and `noopener` so the page Google serves cannot reach back
        // into this one. The press is the only gesture that opens it: a connect
        // that opened itself would be a popup, and a browser's popup blocker
        // would be right.
        if (typeof url === "string") window.open(url, "_blank", "noopener,noreferrer")
      },
      (thrown: unknown) => {
        setBusy(false)
        setRefused(sentenceOf(thrown))
      },
    )
  }

  const said = () => {
    const account = props.account()
    switch (account.status) {
      case "connected":
        return `${account.address} · ${account.messages ?? 0} messages · refreshed ${account.refreshedAt ?? "never"} · scope ${account.scope}`
      case "fault":
        return account.reason ?? "this serve's Gmail connection is not working."
      case "absent":
        return account.reason === null
          ? "Connect opens Google in a new tab; approve the mailbox you want this serve to read."
          : account.reason
    }
  }

  /** WHETHER THIS ROW IS ASKING FOR A PRESS, which is {@link mailNeedsYou}'s
   *  question asked one screen down: Connect when there is no account and the
   *  doors are set, Reconnect after a fault. A CONNECTED row offers neither —
   *  what a person does there is Disconnect, drawn below in the alarm register
   *  because forgetting an account is the destructive half of this face. */
  const asksForAPerson = (): boolean =>
    props.account().status === "fault" || (props.account().status === "absent" && props.account().reason === null)

  const button = "rounded border border-rule px-2 py-0.5 text-xs"
  return (
    <div class="flex flex-col gap-1.5" data-testid={TESTID.mailRow} data-mail-row={props.account().status}>
      <p class="text-xs leading-relaxed text-muted">{said()}</p>
      <Show when={props.account().status === "absent" && props.account().reason === null}>
        <p class="text-xs leading-relaxed text-muted" data-testid={TESTID.mailRedirect} data-mail-redirect={redirectFor(props.account(), window.location.origin)}>
          Register {redirectFor(props.account(), window.location.origin)} in Google Cloud.
        </p>
      </Show>
      <Show when={asksForAPerson()}>
        <div class="flex gap-1.5">
          <button type="button" class={button} disabled={busy()} data-testid={TESTID.mailAction} data-mail-action="connect"
            onClick={() => press(() => props.client.procedures.connect.begin({ origin: window.location.origin }))}>
            {props.account().status === "absent" ? "Connect Gmail" : "Reconnect"}
          </button>
        </div>
      </Show>
      <Show when={props.account().status === "connected" || props.account().status === "fault"}>
        <div class="flex gap-1.5">
          <button type="button" class={`${button} border-alarm/45 text-alarm`} disabled={busy()}
            data-testid={TESTID.mailAction} data-mail-action="disconnect"
            onClick={() => press(() => props.client.procedures.connect.disconnect())}>
            Disconnect
          </button>
        </div>
      </Show>
      <Show when={refused()}>{(sentence) => <p class="text-xs leading-relaxed text-alarm" data-testid={TESTID.mailRefused} data-mail-refused={sentence()}>{sentence()}</p>}</Show>
    </div>
  )
}
