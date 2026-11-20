import type { Identity, Person, RequestHeaders } from "@olai/plugin-api/services"
import { WHO_PATH, type Who } from "@olai/surface"
import { Context, Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"

export class CurrentWho extends Context.Service<CurrentWho, Who | null>()(
  "olai/CurrentWho",
) {}

export type Reading = (headers: RequestHeaders) => Who | null

export const NOBODY: Identity = {
  headers: [],
  who: () => null,
}

const asWho = (person: Person | null): Who | null => person

export const readingOf = (door: () => Identity): Reading => (headers) =>
  asWho(door().who(headers))

export const whoRoute = (who: Reading) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const person = who(request.headers)
      if (person === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(person))
    },
  )
