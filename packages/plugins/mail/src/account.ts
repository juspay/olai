/**
 * THE ACCOUNT'S STATE MACHINE — the three arms, and every edge between them.
 *
 * It is the plugin's whole server-side behaviour in PR 1: a memory record on
 * disk, a short-lived access token in a generated Himalaya config, and the
 * `account` cell the pill and the panel row read. Everything else in this
 * package is either a protocol description (`./oauth.ts`), a runner
 * (`./himalaya/run.ts`), the passive route that receives the redirect
 * (`./route.ts`) or a registration (`./server.ts`).
 *
 * ## The three arms, and the one sentence about each
 *
 *   - `absent` — no record on disk. The ordinary state of a serve that has not
 *     been pointed at a mailbox. Its `reason` is NOT a fault: it says what a
 *     connect would still need and this serve has not got (the two credential
 *     doors), or `null` when Connect will work. That is what lets the panel row
 *     offer a button and know whether it is worth offering.
 *   - `connected` — a record, a refreshed access token, and a `gmail profile`
 *     this serve has answered. The address and the message total are the
 *     profile's, and nothing else invents them.
 *   - `fault` — something the person asked for is not working: Google refused
 *     the refresh (`invalid_grant` is a revoked or expired grant, and its own
 *     word is what the panel shows), the credentials are gone from the
 *     environment, or the pinned binary is not there because the serve was not
 *     started from the Nix build.
 *
 * ## The refresh fiber
 *
 * One, forked onto the plugin's scope by `./server.ts`, waking when the access
 * token is within five minutes of expiry and refreshing it. This is the honest
 * shape rather than a request-time refresh because the token is spent by a
 * CHILD PROCESS: the config file hands Himalaya one string, and a call that
 * discovered the token had expired would have to fail once before it could
 * succeed. Refreshing ahead of the deadline means every call a tool or a poll
 * makes has a live token already written down.
 *
 * The fiber's own arithmetic is a pure function ({@link wakeIn}), because that is
 * the part that can be wrong — a lead time spelled with the wrong sign is a
 * refresh every second or none at all, and both look like nothing happening.
 *
 * ## Why the machine takes a `net`
 *
 * Three calls in this file go to Google, and the whole of what they need is
 * `fetch` twice and a JSON parse. Taking it as an argument is what lets
 * `account.test.ts` drive every transition without a socket and without a fake
 * HTTP server; `./server.ts` passes the platform's own. It is the same seam
 * `Env.dial` is for a plugin that speaks somebody else's client library
 * (`olai-plugin-xyne-spaces`), reduced to the platform primitive because this
 * plugin has no client library to be handed.
 */

import type { Clock, Refusal } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { type Account, MAIL_UNCONNECTED, MailRefusal, REDIRECT_PATH, SCOPE } from "./wire.ts"
import { type Himalaya, NO_BINARY } from "./himalaya/run.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import type { Memory, MemoryRecord } from "./local.ts"
import {
  type Answer,
  authorizationUrl,
  challengeOf,
  type Endpoints,
  exchangeRequest,
  newState,
  newVerifier,
  refreshRequest,
  revokeRequest,
  tokenAnswer,
} from "./oauth.ts"

/** How long before expiry the refresh wakes. Five minutes of a token that lives
 *  for an hour is a refresh that lands long before the config file is read. */
export const LEAD_MS = 5 * 60 * 1000

/** How long a `state` stays good for. Ten minutes is the plan's number and
 *  Google's own recommendation for a code's lifetime; a second tab's consent
 *  screen left open overnight must not be an authorization this serve honours. */
export const PENDING_MS = 10 * 60 * 1000

/** What is left of a token's life when the fiber should wake, in milliseconds —
 *  never negative, so a token that is already inside the lead time is refreshed
 *  at once rather than slept past. Pure, and the one piece of the loop worth a
 *  test of its own. */
export const wakeIn = (input: { readonly expiresAt: number; readonly now: number }): number =>
  Math.max(0, input.expiresAt - LEAD_MS - input.now)

/** The profile's own JSON, as the pinned binary prints it under `--json`:
 *  `{"email": …, "messages-total": …, "threads-total": …, "history-id": …}`
 *  (kebab-case keys, and the two totals are omitted when Gmail does not send
 *  them). Everything optional except the address, which is the arm's whole
 *  proof that the token is a Gmail token. */
export const profileOf = (raw: unknown): { readonly address: string; readonly messages: number | null } | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const address = record["email"]
  if (typeof address !== "string" || address === "") return undefined
  const total = record["messages-total"]
  return { address, messages: typeof total === "number" && Number.isFinite(total) ? total : null }
}

/**
 * ONE POST, AS THIS PLUGIN SPENDS IT — the whole of what the machine needs from
 * the network, and the reason it is a `post` rather than a `fetch`.
 *
 * `fetch` is a global with a platform-shaped type (`Bun`'s carries `preconnect`,
 * the DOM's does not) and three of the four things this plugin would have to
 * restate about it — the method, the content type, the body encoding — are
 * properties of the REQUEST `./oauth.ts` already composes. So the seam takes the
 * composed request and answers the status and the text: the machine decides what
 * an answer MEANS, the platform decides how bytes leave the process, and
 * `account.test.ts` drives every transition with a queue of answers.
 */
export type Poster = (
  request: { readonly url: string; readonly body: string },
) => Promise<{ readonly status: number; readonly body: string }>

export interface AccountInputs {
  readonly binary: string | undefined
  readonly clock: Clock
  readonly client: string | undefined
  readonly secret: string | undefined
  readonly endpoints: Endpoints
  readonly himalaya: Himalaya
  readonly memory: Memory
  readonly post: Poster
  readonly paint: (account: Account) => void
  readonly warn: (line: string) => void
}

/** The names of the two doors a connect spends, in the order an operator meets
 *  them — the sentence a row shows when neither is set. */
export const DOORS = "OLAI_MAIL_OAUTH_CLIENT and OLAI_MAIL_OAUTH_SECRET"

export interface AccountMachine {
  /** Arm a connect: mint a state and a PKCE verifier, answer the URL. */
  readonly begin: (origin: string) => Effect.Effect<{ readonly url: string }, MailRefusal>
  /** Spend the callback: exchange the code, ask the profile, publish
   *  `connected`. Answers the address, which is what the landing page says. */
  readonly complete: (callback: { readonly code: string; readonly state: string }) => Effect.Effect<{ readonly address: string }, MailRefusal>
  /** Revoke at Google (best effort), forget the record, publish `absent`. */
  readonly disconnect: () => Effect.Effect<void, MailRefusal>
  /** The first arm, run once at activation: the record, if any, brought up. */
  readonly boot: () => Effect.Effect<void>
  /** The refresh fiber's body. `./server.ts` forks it onto the plugin's scope;
   *  it never ends, and the scope is what stops it. */
  readonly refresh: Effect.Effect<void>
}

interface Pending {
  readonly state: string
  readonly verifier: string
  readonly redirect: string
  readonly at: number
}

export const makeAccount = (inputs: AccountInputs): AccountMachine => {
  const { binary, clock, endpoints, himalaya, memory, paint, post, warn } = inputs
  const client = inputs.client?.trim() ? inputs.client.trim() : undefined
  const secret = inputs.secret?.trim() ? inputs.secret.trim() : undefined
  /** The access token's deadline, in epoch milliseconds. Absent means "nothing
   *  to refresh": no account, a fault, or a disconnect — which is what parks the
   *  fiber rather than stopping it (a reconnect arms it again without a
   *  restarted row). */
  let expiresAt: number | undefined
  let pending: Pending | undefined
  let redirect = ""
  /** THE LAST THING PUBLISHED, kept for one reason: arming a connect must not
   *  blank a pill that is telling the truth. `begin` re-draws the reading with
   *  the redirect the press made knowable, and that is a change of ONE field
   *  rather than a return to `absent` — a connected account that is asked to
   *  connect again stays connected until something actually moves it. */
  let shown: Account = MAIL_UNCONNECTED
  const now = (): number => Date.parse(clock.now())
  const publish = (next: Account): void => {
    shown = next
    paint(next)
  }

  /** The credentials' absence, as the sentence the row says; `null` when a
   *  connect would actually work. */
  const unconnectable = (): string | null =>
    client === undefined || secret === undefined
      ? `${DOORS} are not set in this serve's environment, so Connect has nothing to authorize with`
      : null

  const absent = (reason: string | null): Account => ({
    status: "absent",
    address: null,
    messages: null,
    refreshedAt: null,
    scope: SCOPE,
    redirect,
    reason,
  })

  const fault = (reason: string): Account => ({
    status: "fault",
    address: null,
    messages: null,
    refreshedAt: null,
    scope: SCOPE,
    redirect,
    reason,
  })

  /** ...AND A TRANSPORT FAILURE IS AN ANSWER, not a defect: Google being
   *  unreachable is a thing a person can be told, and an Effect defect would be
   *  a row that died instead of a row that says which door is shut. Every
   *  failure below lands on the same arm `./oauth.ts` reads a 4xx onto, with a
   *  word (`unreachable`) no Google error can be. */
  const asked = async (request: { readonly url: string; readonly body: string }): Promise<{ status: number; body: string }> => {
    try {
      return await post(request)
    } catch (error) {
      return { status: 0, body: JSON.stringify({ error: "unreachable", error_description: String(error) }) }
    }
  }

  /** The reason a token answer gives, in the words the panel shows: Google's
   *  own `error` word on the front, its description after. */
  const why = (answer: Answer & { readonly ok: false }): string =>
    answer.description === null ? answer.error : `${answer.error}: ${answer.description}`

  /** Core's memory door refuses in the ops vocabulary (`Refusal` is a tag), and
   *  the two procedures on this plugin's surface declare THIS plugin's refusal
   *  (`./wire.ts`). One conversion, at the two call sites that write the record
   *  from a procedure, so a disk that would not take a refresh token is a
   *  sentence a person reads rather than a tag nobody can act on. */
  const asMail = <A>(work: Effect.Effect<A, Refusal>): Effect.Effect<A, MailRefusal> =>
    Effect.mapError(work, (refusal) => new MailRefusal({ reason: `this serve could not write its memory record: ${refusal._tag}` }))

  /** THE LAST HALF OF BOTH ROADS INTO `connected`: with a live access token in
   *  hand, write it into the generated config, ask the profile, and publish.
   *
   * Throws nothing, and that is what a boot needs (it is where the first failure
   * is met and there is no caller to fail): every failing arm paints the fault
   * and returns. Both callers — the refresh a boot makes and the exchange a
   * connect makes — reach here with a token, so neither can forget the profile
   * call the `connected` arm is a claim ABOUT. */
  const settle = (record: MemoryRecord, tokens: { readonly accessToken: string; readonly refreshToken: string | null; readonly expiresIn: number; readonly scope: string | null }): Effect.Effect<void> =>
    Effect.gen(function*() {
      expiresAt = now() + tokens.expiresIn * 1000
      const keep: MemoryRecord = {
        ...record,
        // Google rotates a refresh token only sometimes; `null` means the one
        // already on disk is still the one to use.
        refreshToken: tokens.refreshToken ?? record.refreshToken,
        scope: tokens.scope ?? record.scope,
      }
      const wrote = yield* Effect.result(himalaya.useToken({ token: tokens.accessToken, address: record.address }))
      if (wrote._tag === "Failure") {
        expiresAt = undefined
        publish(fault(wrote.failure.reason))
        return
      }
      const asked = yield* Effect.result(himalaya.run({ verb: GMAIL.profileGet }))
      if (asked._tag === "Failure") {
        expiresAt = undefined
        publish(fault(asked.failure.reason))
        return
      }
      const profile = profileOf(asked.success)
      if (profile === undefined) {
        expiresAt = undefined
        publish(fault("the pinned Himalaya answered a profile this plugin cannot read"))
        return
      }
      const settled: MemoryRecord = { ...keep, address: profile.address }
      yield* memory.remember(settled).pipe(
        Effect.catch((refusal: Refusal) => Effect.sync(() => {
          // The connection works and the disk did not take the note; saying so
          // is the whole of what this arm can do without turning a working
          // mailbox into a fault.
          warn(`mail: could not write ${profile.address} to the memory record: ${refusal._tag}`)
        })),
      )
      publish({
        status: "connected",
        address: profile.address,
        messages: profile.messages,
        refreshedAt: clock.now(),
        scope: settled.scope ?? SCOPE,
        redirect,
        reason: null,
      })
    })

  /** Refresh, then {@link settle}. The road a boot and the refresh fiber take. */
  const bringUp = (record: MemoryRecord): Effect.Effect<void> =>
    Effect.gen(function*() {
      if (client === undefined || secret === undefined) {
        expiresAt = undefined
        publish(fault(unconnectable() ?? DOORS))
        return
      }
      if (binary === undefined) {
        expiresAt = undefined
        publish(fault(NO_BINARY))
        return
      }
      const fetched = yield* Effect.promise(() => asked(refreshRequest(endpoints, { client, secret, refreshToken: record.refreshToken })))
      const answer = tokenAnswer(fetched.status, fetched.body)
      if (!answer.ok) {
        // A refusal HERE is the fault arm the plan names: `invalid_grant` means
        // the grant is gone (revoked at Google, or expired by Google's own
        // inactivity rule) and only a person pressing Reconnect can fix it.
        expiresAt = undefined
        yield* Effect.promise(() => himalaya.close())
        publish(fault(why(answer)))
        return
      }
      yield* settle(record, answer.tokens)
    })

  const machine: AccountMachine = {
    begin: (origin) =>
      Effect.gen(function*() {
        const missing = unconnectable()
        if (missing !== null) return yield* Effect.fail(new MailRefusal({ reason: missing }))
        if (binary === undefined) return yield* Effect.fail(new MailRefusal({ reason: NO_BINARY }))
        const where = yield* Effect.try({
          try: () => {
            const parsed = new URL(origin)
            // AN ORIGIN, not a page or an address with a path: the redirect
            // Google is handed must be this serve's own origin plus one path
            // segment, and a value carrying a path, a query, a fragment or
            // credentials would be a redirect URI registered wrongly.
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("not http")
            if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "" || parsed.username !== "" || parsed.password !== "") {
              throw new Error("not an origin")
            }
            return parsed.origin
          },
          catch: () => new MailRefusal({ reason: `\`${origin}\` is not the origin of a page this serve is on` }),
        })
        redirect = `${where}${REDIRECT_PATH}`
        const state = newState()
        const verifier = newVerifier()
        pending = { state, verifier, redirect, at: now() }
        // The row's hint tells a person what to register in Google Cloud, and
        // that string is only knowable once a page has said where it is.
        publish({ ...shown, redirect })
        return {
          url: authorizationUrl(endpoints, {
            client: client as string,
            redirect,
            state,
            challenge: challengeOf(verifier),
          }),
        }
      }),

    complete: (callback) =>
      Effect.gen(function*() {
        const armed = pending
        if (armed === undefined || armed.state !== callback.state) {
          // NOT SPENT, and the distinction is the point: a callback this serve
          // did not mint — a bookmark, a stale tab, somebody else's link — has
          // matched nothing, so the connect a person is actually waiting on is
          // still the one armed below with the verifier only it has.
          return yield* Effect.fail(new MailRefusal({ reason: "this serve is not waiting for that authorization — start Connect again" }))
        }
        // SPENT, and that is the single-use rule: a state is consumed by the
        // callback that carried it, so a replay of the same URL — a refresh in
        // the landing tab, a bookmark of the callback — is refused rather than
        // exchanging the code a second time.
        pending = undefined
        if (now() - armed.at > PENDING_MS) {
          return yield* Effect.fail(new MailRefusal({ reason: "that authorization took longer than ten minutes — start Connect again" }))
        }
        if (client === undefined || secret === undefined) {
          return yield* Effect.fail(new MailRefusal({ reason: unconnectable() ?? DOORS }))
        }
        const fetched = yield* Effect.promise(() => asked(exchangeRequest(endpoints, {
          client,
          secret,
          code: callback.code,
          redirect: armed.redirect,
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
        const kept: MemoryRecord = { refreshToken, address: null, scope: answer.tokens.scope ?? SCOPE, connectedAt: clock.now() }
        yield* asMail(memory.remember(kept))
        redirect = armed.redirect
        // STRAIGHT INTO THE PROFILE, with the token Google just handed us in
        // the exchange — a refresh here would be a second round trip for a
        // token that is seconds old, and it would make the connect flow depend
        // on the refresh grant working at the moment of connecting. The address
        // is the arm's proof: a record that cannot answer one is a record this
        // serve must not report as connected.
        yield* settle(kept, answer.tokens)
        const painted = memory.current()
        if (painted === undefined || painted.address === null) {
          return yield* Effect.fail(new MailRefusal({ reason: "the connection was stored but the mailbox did not answer — press Reconnect" }))
        }
        return { address: painted.address }
      }),

    disconnect: () =>
      Effect.gen(function*() {
        const held = memory.current()
        expiresAt = undefined
        pending = undefined
        if (held !== undefined && client !== undefined && secret !== undefined) {
          // BEST EFFORT, and said so: a revoke that could not be sent leaves a
          // grant at Google that this serve has already stopped using, and
          // turning a person's Disconnect into an error would leave the token
          // on disk — the one outcome that is actually worse.
          const fetched = yield* Effect.promise(() => asked(revokeRequest(endpoints, held.refreshToken)))
          if (fetched.status < 200 || fetched.status >= 300) {
            warn(`mail: Google did not revoke the grant (HTTP ${fetched.status}) — the token is forgotten here regardless`)
          }
        }
        yield* asMail(memory.forget())
        yield* Effect.promise(() => himalaya.close())
        redirect = ""
        publish(absent(unconnectable()))
      }),

    boot: () =>
      Effect.gen(function*() {
        if (binary === undefined) {
          publish(fault(NO_BINARY))
          return
        }
        const record = memory.current()
        if (record === undefined) {
          publish(absent(unconnectable()))
          return
        }
        yield* bringUp(record)
      }),

    refresh: Effect.gen(function*() {
      while (true) {
        const due = expiresAt
        if (due === undefined) {
          // Nothing to refresh: no account, a fault a person has to answer, or
          // a disconnect. A second of sleep is the cheapest honest wait — this
          // fiber exists for the whole life of the row either way, and waking
          // to find nothing to do is one comparison.
          yield* Effect.sleep("1 second")
          continue
        }
        yield* Effect.sleep(Math.max(0, wakeIn({ expiresAt: due, now: now() })))
        // Re-read rather than trusting the wait: a connect, a disconnect or a
        // fault may have moved the deadline while this fiber slept.
        if (expiresAt !== due) continue
        const record = memory.current()
        if (record === undefined) {
          expiresAt = undefined
          continue
        }
        yield* bringUp(record)
      }
    }),
  }

  return machine
}
