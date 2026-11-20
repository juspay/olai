import { createSignal, Show, type Accessor } from "solid-js"
import { Effect, Result } from "effect"

import { agoOf, createNow } from "@olai/web/client/ago.ts"

import { TESTID } from "../testids.ts"
import { REDIRECT_PATH, type Account } from "../wire.ts"

export interface MailClient {
  readonly procedures: {
    readonly connect: {
      readonly begin: (input: { readonly origin: string }) => Effect.Effect<{ readonly url: string }, unknown>
      readonly disconnect: () => Effect.Effect<unknown, unknown>
    }
  }
}

export const mailNeedsYou = (account: Account): boolean =>
  account.canConnect && !account.retrying && account.status !== "connected"

export const redirectFor = (account: Account, origin: string): string =>
  account.redirect !== "" ? account.redirect : `${origin}${REDIRECT_PATH}`

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

  const press = (call: () => Effect.Effect<{ readonly url: string } | unknown, unknown>): void => {
    if (busy()) return
    setRefused(null)
    setBusy(true)
    Effect.runPromise(Effect.result(call())).then(
      (outcome) => {
        setBusy(false)
        if (Result.isFailure(outcome)) return setRefused(sentenceOf(outcome.failure))
        const url = (outcome.success as { readonly url?: unknown }).url
        if (typeof url === "string") window.open(url, "_blank", "noopener,noreferrer")
      },
      (thrown: unknown) => {
        setBusy(false)
        setRefused(sentenceOf(thrown))
      },
    )
  }

  const now = createNow()
  const refreshed = (): string => {
    const at = props.account().refreshedAt
    if (at === null) return "never"
    return agoOf(at, now()) || "an unknown time"
  }

  const said = () => {
    const account = props.account()
    switch (account.status) {
      case "connected":
        return `Connected as ${account.address}${account.messages === null ? "" : ` · ${account.messages} messages`} · token refreshed ${refreshed()} · scope ${account.scope}`
          + (account.retrying ? `. ${account.reason ?? "Retrying sign-in…"}` : "")
      case "fault":
        return `${account.reason ?? "Gmail isn't working."}${account.retrying ? " Retrying…" : ""}`
      case "absent":
        if (account.reason !== null) return account.reason
        return account.canConnect
          ? "No Gmail account connected. Connecting opens Google in a new tab. Your sign-in stays in olai's memory, never in your notes."
          : "No Gmail account connected."
    }
  }

  const asksForAPerson = (): boolean => mailNeedsYou(props.account())

  const button = "rounded-control border border-rule px-2 py-0.5 text-label"
  return (
    <div class="flex flex-col gap-1.5" data-testid={TESTID.mailRow} data-mail-row={props.account().status}>
      <p class="text-label leading-relaxed text-muted">{said()}</p>
      <Show when={props.account().status === "absent" && props.account().reason === null}>
        <p class="text-label leading-relaxed text-muted" data-testid={TESTID.mailRedirect} data-mail-redirect={redirectFor(props.account(), window.location.origin)}>
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
          <button type="button" class={`${button} border-alarm/40 text-alarm`} disabled={busy()}
            data-testid={TESTID.mailAction} data-mail-action="disconnect"
            onClick={() => press(() => props.client.procedures.connect.disconnect())}>
            Disconnect
          </button>
        </div>
      </Show>
      <Show when={refused()}>{(sentence) => <p class="text-label leading-relaxed text-alarm" data-testid={TESTID.mailRefused} data-mail-refused={sentence()}>{sentence()}</p>}</Show>
    </div>
  )
}
