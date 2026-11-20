import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"

import type { AccountMachine } from "./account.ts"
import { type Callback, parseCallback } from "./oauth.ts"
import { REDIRECT_PATH } from "./wire.ts"

const page = (title: string, said: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font:15px/1.5 system-ui,sans-serif;margin:12vh auto;max-width:34rem;padding:0 1.5rem;color:#222">
<h1 style="font-size:1.15rem;margin:0 0 .6rem">${title}</h1>
<p style="margin:0">${said}</p>
</body></html>
`

export const escaped = (said: string): string =>
  said
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const html = (status: number, title: string, said: string): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text(page(escaped(title), escaped(said)), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })

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
