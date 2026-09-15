/**
 * THE REDIRECT'S LANDING — one passive route, on the listener the serve
 * already has.
 *
 * ## What arrives here, and what does not
 *
 * Google sends the browser back to `${origin}${REDIRECT_PATH}` with a `code` and
 * the `state` this plugin minted, or with an `error`. That is a plain GET on
 * the app's own listener, and it is registered through `TransportSurface` the
 * way `olai-plugin-vault`'s media and resync routes are — `passive: true`,
 * because this plugin is a row on somebody else's server and never opens a
 * port: switching the row off takes the route with it, which is exactly the
 * property a person expects from a switch and which a second listener would
 * break.
 *
 * ## Why the answers are pages
 *
 * The URL is one a person's BROWSER lands on, and it has no app in it: this is
 * not a page of the vault, so it must not pretend to be one — no app shell, no
 * websocket, nothing that claims a directory is being served. One small page,
 * in the serve's own words, that says what happened and that the tab can be
 * closed. The good arm's sentence names the address, because the only question
 * a person has at that moment is *was that the right mailbox*.
 *
 * ## Every failure is 400, and every failure has a sentence
 *
 * An unknown or replayed `state`, an authorization that sat past its ten
 * minutes, Google's own refusal, a token exchange that failed: all of them are
 * the same HTTP answer with different prose, and the prose is the refusal the
 * state machine composed (`../account.ts`). A 500 would say *we broke* about
 * what is almost always a stale tab.
 *
 * The text is ESCAPED on the way into the page. It carries an address, a query
 * parameter and Google's error description — three things this process did not
 * write — and a landing page is a page.
 */

import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

import type { AccountMachine } from "./account.ts"
import { type Callback, parseCallback } from "./oauth.ts"
import { REDIRECT_PATH } from "./wire.ts"

/** The one page shape this route writes: a title, a sentence, nothing else.
 *  Set in the app's own vocabulary, drawn with no stylesheet — a redirect
 *  landing has no bundle to load and must not wait for one. */
const page = (title: string, said: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font:15px/1.5 system-ui,sans-serif;margin:12vh auto;max-width:34rem;padding:0 1.5rem;color:#222">
<h1 style="font-size:1.15rem;margin:0 0 .6rem">${title}</h1>
<p style="margin:0">${said}</p>
</body></html>
`

/** HTML text, with the five characters that can end a text node or an
 *  attribute escaped. Written out rather than imported: this is the whole of
 *  the HTML this plugin emits. */
export const escaped = (said: string): string =>
  said
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const html = (status: number, title: string, said: string): HttpServerResponse.HttpServerResponse =>
  // `.text` rather than `.html`: the string overload of the latter takes no
  // options, and this route has a STATUS to say (200 connected, 400 refused).
  // The content type is then this line's to declare.
  HttpServerResponse.text(page(escaped(title), escaped(said)), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })

/**
 * WHAT THE CALLBACK DOES WITH THE MACHINE'S ANSWERS, as a pure mapping — so the
 * route is one line per arm and a test can read the whole of the protocol
 * without a listener.
 */
export const landingOf = (
  outcome: { readonly ok: true; readonly address: string } | { readonly ok: false; readonly reason: string },
): HttpServerResponse.HttpServerResponse =>
  outcome.ok
    ? html(200, `Connected as ${outcome.address}`, "You can close this tab.")
    : html(400, "Gmail was not connected", outcome.reason)

export const mailRoute = (machine: AccountMachine) =>
  HttpRouter.add("GET", REDIRECT_PATH, (request: HttpServerRequest.HttpServerRequest) =>
    Effect.gen(function*() {
      const callback: Callback = parseCallback(request.url)
      if (callback.kind === "refused") return landingOf({ ok: false, reason: callback.reason })
      const spent = yield* Effect.result(machine.complete({ code: callback.code, state: callback.state }))
      return landingOf(spent._tag === "Failure"
        ? { ok: false, reason: spent.failure.reason }
        : { ok: true, address: spent.success.address })
    }))
