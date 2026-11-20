import { PLUGIN_CHUNK_PREFIX } from "@olai/surface"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"

import type { DynamicRuntime } from "./runtime.ts"

export const pluginChunks = (dynamic: Pick<DynamicRuntime, "chunk"> | null) =>
  HttpRouter.add(
    "GET",
    `${PLUGIN_CHUNK_PREFIX}:file`,
    (request: HttpServerRequest.HttpServerRequest) =>
      Effect.sync(() => {
        const text = dynamic?.chunk(new URL(request.url, "http://olai").pathname) ?? null
        if (text === null) return HttpServerResponse.text("no such plugin chunk", { status: 404 })
        return HttpServerResponse.text(text, {
          status: 200,
          headers: {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "no-store",
          },
        })
      }),
  )
