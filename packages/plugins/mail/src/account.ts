import type { Clock, Refusal } from "@olai/plugin-api/services"
import { Effect, Queue } from "effect"

import { CREDENTIALS } from "./doors.ts"
import { type Himalaya, NO_BINARY } from "./himalaya/run.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import type { Memory, MemoryRecord } from "./local.ts"
import {
  type Answer,
  authorizationUrl,
  challengeOf,
  type Endpoints,
  exchangeRequest,
  type Google,
  newState,
  newVerifier,
  refreshRequest,
  revokeRequest,
  tokenAnswer,
} from "./oauth.ts"
import { type Account, MAIL_UNCONNECTED, MailRefusal, REDIRECT_PATH, SCOPE } from "./wire.ts"

export const LEAD_MS = 5 * 60 * 1000

export const MINIMUM_GAP_MS = 5 * 1000

export const RETRY_MS = 30 * 1000
export const RETRY_CAP_MS = 10 * 60 * 1000

export const PENDING_MS = 10 * 60 * 1000

export interface TokenLife {
  readonly from: number
  readonly until: number
}

export const lifeOf = (input: { readonly now: number; readonly expiresIn: number }): TokenLife => ({
  from: input.now,
  until: input.now + input.expiresIn * 1000,
})

export const refreshDue = (life: TokenLife): number =>
  Math.max(life.until - LEAD_MS, life.from + (life.until - life.from) / 2, life.from + MINIMUM_GAP_MS)

export interface Profile {
  readonly address: string
  readonly messages: number | null
}

/** The profile's own JSON, as the pinned binary prints it under `--json`:
 *  `{"email": …, "messages-total": …, "threads-total": …, "history-id": …}` —
 *  kebab-case keys, and the two totals are omitted when Gmail does not send
 *  them. */
export const profileOf = (raw: unknown): Profile | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const address = record["email"]
  if (typeof address !== "string" || address === "") return undefined
  const total = record["messages-total"]
  return { address, messages: typeof total === "number" && Number.isFinite(total) ? total : null }
}

export type Poster = (
  request: { readonly url: string; readonly body: string },
) => Promise<{ readonly status: number; readonly body: string }>

export interface AccountInputs {
  readonly clock: Clock
  readonly client: string | undefined
  readonly secret: string | undefined
  readonly google: Google
  readonly himalaya: Himalaya
  readonly memory: Memory
  readonly post: Poster
  readonly paint: (account: Account) => void
  readonly warn: (line: string) => void
}

export interface AccountMachine {
  readonly begin: (origin: string) => Effect.Effect<{ readonly url: string }, MailRefusal>
  readonly complete: (callback: { readonly code: string; readonly state: string }) => Effect.Effect<{ readonly address: string }, MailRefusal>
  readonly disconnect: () => Effect.Effect<void, MailRefusal>
  readonly boot: () => Effect.Effect<void>
  readonly usable: () => boolean
  readonly current: () => Account
  readonly refresh: Effect.Effect<void>
}

type Readiness =
  | { readonly kind: "every"; readonly endpoints: Endpoints }
  | { readonly kind: "broken"; readonly reason: string }
  | { readonly kind: "unarmed"; readonly reason: string }

interface Pending {
  readonly state: string
  readonly verifier: string
  readonly at: number
}

export const makeAccount = (inputs: AccountInputs): AccountMachine => {
  const { clock, google, himalaya, memory, paint, post, warn } = inputs
  const client = inputs.client?.trim() ? inputs.client.trim() : undefined
  const secret = inputs.secret?.trim() ? inputs.secret.trim() : undefined

  let life: TokenLife | undefined
  let backoff = RETRY_MS
  let pending: Pending | undefined
  let redirect = ""
  let shown: Account = MAIL_UNCONNECTED

  let arm: ((deadline: number | undefined) => void) | undefined

  const now = (): number => Date.parse(clock.now())

  const ready = (): Readiness => {
    if (google.kind === "refused") return { kind: "broken", reason: google.reason }
    if (himalaya.binary === undefined) return { kind: "broken", reason: NO_BINARY }
    if (client === undefined || secret === undefined) {
      return {
        kind: "unarmed",
        reason: `${CREDENTIALS} are not set in this serve's environment, so Connect has nothing to authorize with`,
      }
    }
    return { kind: "every", endpoints: google.endpoints }
  }

  const account = (input: {
    readonly status: Account["status"]
    readonly reason: string | null
    readonly retrying?: boolean
    readonly address?: string | null
    readonly messages?: number | null
    readonly refreshedAt?: string | null
    readonly scope?: string
  }): Account => ({
    status: input.status,
    address: input.address ?? null,
    messages: input.messages ?? null,
    refreshedAt: input.refreshedAt ?? null,
    scope: input.scope ?? SCOPE,
    redirect,
    reason: input.reason,
    retrying: input.retrying ?? false,
    canConnect: ready().kind === "every",
  })

  const publish = (next: Account): void => {
    shown = next
    paint(next)
  }

  const stops = (reason: string, address: string | null = null): void => {
    life = undefined
    arm?.(undefined)
    publish(account({ status: "fault", reason, address }))
  }

  const retrying = (reason: string, address: string | null = null): void => {
    arm?.(now() + backoff)
    backoff = Math.min(backoff * 2, RETRY_CAP_MS)
    const usable = life !== undefined && life.until > now() && shown.status === "connected"
    publish(usable
      ? { ...shown, retrying: true, reason }
      : account({ status: "fault", reason, retrying: true, address }))
  }

  const idle = (): void => {
    const state = ready()
    if (state.kind === "broken") return stops(state.reason)
    arm?.(undefined)
    publish(account({ status: "absent", reason: state.kind === "unarmed" ? state.reason : null }))
  }

  const asked = async (request: { readonly url: string; readonly body: string }): Promise<{ status: number; body: string }> => {
    try {
      return await post(request)
    } catch (error) {
      return { status: 0, body: JSON.stringify({ error: "unreachable", error_description: String(error) }) }
    }
  }

  const why = (answer: Answer & { readonly ok: false }): string =>
    answer.description === null ? answer.error : `${answer.error}: ${answer.description}`

  const asMail = <A>(work: Effect.Effect<A, Refusal>): Effect.Effect<A, MailRefusal> =>
    Effect.mapError(work, (refusal) => new MailRefusal({ reason: `this serve could not write its memory record: ${refusal._tag}` }))

  const settle = (record: MemoryRecord, tokens: { readonly accessToken: string; readonly refreshToken: string | null; readonly expiresIn: number; readonly scope: string | null }): Effect.Effect<Profile | undefined> =>
    Effect.gen(function*() {
      const keep: MemoryRecord = {
        ...record,
        // Google rotates a refresh token only sometimes; `null` means the one
        // already on disk is still the one to use.
        refreshToken: tokens.refreshToken ?? record.refreshToken,
        scope: tokens.scope ?? record.scope,
      }
      const wrote = yield* Effect.result(himalaya.useToken({ token: tokens.accessToken, address: record.address }))
      if (wrote._tag === "Failure") {
        retrying(wrote.failure.reason, record.address)
        return undefined
      }
      const ran = yield* Effect.result(himalaya.run({ verb: GMAIL.profileGet }))
      if (ran._tag === "Failure") {
        retrying(ran.failure.reason, record.address)
        return undefined
      }
      const profile = profileOf(ran.success)
      if (profile === undefined) {
        stops("the pinned Himalaya answered a profile this plugin cannot read", record.address)
        return undefined
      }
      const settled: MemoryRecord = { ...keep, address: profile.address, historyId: record.address === profile.address ? keep.historyId : null }
      yield* memory.remember(settled).pipe(
        Effect.catch((refusal: Refusal) => Effect.sync(() => {
          warn(`mail: could not write ${profile.address} to the memory record: ${refusal._tag}`)
        })),
      )
      life = lifeOf({ now: now(), expiresIn: tokens.expiresIn })
      arm?.(refreshDue(life))
      backoff = RETRY_MS
      publish(account({
        status: "connected",
        reason: null,
        address: profile.address,
        messages: profile.messages,
        refreshedAt: clock.now(),
        scope: settled.scope ?? SCOPE,
      }))
      return profile
    })

  const bringUp = (record: MemoryRecord): Effect.Effect<void> =>
    Effect.gen(function*() {
      const state = ready()
      if (state.kind !== "every") {
        stops(state.reason, record.address)
        return
      }
      const fetched = yield* Effect.promise(() => asked(refreshRequest(state.endpoints, { client: client as string, secret: secret as string, refreshToken: record.refreshToken })))
      const answer = tokenAnswer(fetched.status, fetched.body)
      if (!answer.ok) {
        if (answer.retry) {
          retrying(why(answer), record.address)
          return
        }
        yield* Effect.promise(() => himalaya.close())
        stops(why(answer), record.address)
        return
      }
      yield* settle(record, answer.tokens)
    })

  return {
    begin: (origin) =>
      Effect.gen(function*() {
        const state = ready()
        if (state.kind !== "every") return yield* Effect.fail(new MailRefusal({ reason: state.reason }))
        const where = yield* Effect.try({
          try: () => {
            const parsed = new URL(origin)
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("not http")
            if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "" || parsed.username !== "" || parsed.password !== "") {
              throw new Error("not an origin")
            }
            return parsed.origin
          },
          catch: () => new MailRefusal({ reason: `\`${origin}\` is not the origin of a page this serve is on` }),
        })
        redirect = `${where}${REDIRECT_PATH}`
        pending = { state: newState(), verifier: newVerifier(), at: now() }
        publish({ ...shown, redirect })
        return {
          url: authorizationUrl(state.endpoints, {
            client: client as string,
            redirect,
            state: pending.state,
            challenge: challengeOf(pending.verifier),
          }),
        }
      }),

    complete: (callback) =>
      Effect.gen(function*() {
        const armed = pending
        if (armed === undefined || armed.state !== callback.state) {
          return yield* Effect.fail(new MailRefusal({ reason: "this serve is not waiting for that authorization — start Connect again" }))
        }
        pending = undefined
        if (now() - armed.at > PENDING_MS) {
          return yield* Effect.fail(new MailRefusal({ reason: "that authorization took longer than ten minutes — start Connect again" }))
        }
        const state = ready()
        if (state.kind !== "every") return yield* Effect.fail(new MailRefusal({ reason: state.reason }))
        const fetched = yield* Effect.promise(() => asked(exchangeRequest(state.endpoints, {
          client: client as string,
          secret: secret as string,
          code: callback.code,
          redirect,
          verifier: armed.verifier,
        })))
        const answer = tokenAnswer(fetched.status, fetched.body)
        if (!answer.ok) return yield* Effect.fail(new MailRefusal({ reason: why(answer) }))
        const refreshToken = answer.tokens.refreshToken
        if (refreshToken === null) {
          return yield* Effect.fail(new MailRefusal({
            reason: "Google answered without a refresh token — this serve would have to ask a person to connect again after an hour, so the connection was not kept",
          }))
        }
        const kept: MemoryRecord = { historyId: null, refreshToken, address: null, scope: answer.tokens.scope ?? SCOPE, connectedAt: clock.now() }
        yield* asMail(memory.remember(kept))
        const profile = yield* settle(kept, answer.tokens)
        if (profile === undefined) {
          return yield* Effect.fail(new MailRefusal({ reason: "the connection was stored but the mailbox did not answer — press Reconnect" }))
        }
        return { address: profile.address }
      }),

    disconnect: () =>
      Effect.gen(function*() {
        const held = memory.current()
        const state = ready()
        pending = undefined
        if (held !== undefined && state.kind === "every") {
          const fetched = yield* Effect.promise(() => asked(revokeRequest(state.endpoints, held.refreshToken)))
          if (fetched.status < 200 || fetched.status >= 300) {
            warn(`mail: Google did not revoke the grant (HTTP ${fetched.status}) — the token is forgotten here regardless`)
          }
        }
        yield* asMail(memory.forget())
        yield* Effect.promise(() => himalaya.close())
        redirect = ""
        pending = undefined
        idle()
      }),

    boot: () =>
      Effect.gen(function*() {
        const record = memory.current()
        if (record === undefined) {
          idle()
          return
        }
        yield* bringUp(record)
      }),

    usable: () => shown.status === "connected" && life !== undefined && life.until > now(),
    current: () => shown,

    refresh: Effect.gen(function*() {
      const deadlines = yield* Queue.unbounded<number | undefined>()
      arm = (deadline) => {
        Queue.offerUnsafe(deadlines, deadline)
      }
      while (true) {
        const due = yield* Queue.take(deadlines)
        if (due === undefined) continue
        yield* Effect.sleep(Math.max(0, due - now()))
        if ((yield* Queue.size(deadlines)) > 0) continue
        const record = memory.current()
        if (record === undefined) continue
        yield* bringUp(record)
      }
    }),
  }
}
