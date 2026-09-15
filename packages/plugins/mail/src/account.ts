/**
 * THE ACCOUNT'S STATE MACHINE — the three arms, every edge between them, and
 * the one fiber that keeps a token live.
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
 *   - `absent` — no account here. The ordinary state of a serve that has not
 *     been pointed at a mailbox; its `reason`, when it has one, says what an
 *     OPERATOR still has to set (the two credential doors), which is what lets
 *     the row explain itself without offering a button that cannot work.
 *   - `connected` — a record, a refreshed access token, and a `gmail profile`
 *     this serve has answered. The address and the message total are the
 *     profile's, and nothing else invents them.
 *   - `fault` — mail is not working, and `reason` says why — but TWO KINDS land
 *     here and the cell says which, because they ask different things of a
 *     person:
 *       - **a verdict** (`retrying: false`): Google answered with a word about
 *         the grant (`invalid_grant` and its family), the environment is
 *         missing a door, the pinned binary is not there, or the binary
 *         answered something this plugin cannot read. No amount of waiting
 *         changes these.
 *       - **a wait** (`retrying: true`): the transport failed, Google answered
 *         5xx, or the child process did not answer in time. The refresh token
 *         is still valid and the record is still on disk, so the machine KEEPS
 *         both and retries on a doubling backoff.
 *
 *     The kind is a FIELD rather than a word appended to the reason, because it
 *     is what the faces branch on: whether to file the row under Needs you,
 *     whether to offer a button, and what the pill's tooltip should promise.
 *     Composing `— retrying` on the server would have made all three of those a
 *     string match, and the reason itself is whoever refused's own sentence
 *     (`./browser/Row.tsx` puts the words together for a reader).
 *
 * ## What decides all of it: one readiness reading
 *
 * {@link Readiness} is asked once per edge and answers one of three things —
 * this serve can reach Google, it is BORNE without something a press cannot
 * supply (no pinned binary, a Google origin that is not loopback), or it is
 * only UNARMED for want of an operator's two doors. Every arm above is that
 * reading plus what is on disk, and the cell's `canConnect` is the same reading
 * — so a row cannot be filed as asking for a person while its own face offers
 * no button, and a button cannot be drawn for a press that would refuse.
 *
 * ## The refresh fiber, and the one channel it reads
 *
 * One, forked onto the plugin's scope by `./server.ts`. Its only input is a
 * QUEUE of deadlines: every arm that has a next moment to try offers one
 * (`settle` from the token's own life, a retry from the backoff), a verdict
 * offers `undefined` to park it, and the fiber sleeps until the moment it was
 * handed and then refreshes. There is no shared deadline variable and no
 * wake-up callback — the queue is the whole of the handoff, so a wake-up cannot
 * be missed and there is nothing to re-read.
 *
 * The arithmetic that turns a token into that deadline is a pure function
 * ({@link refreshDue}), because it is the part that can be wrong and the part
 * worth a test: a lead time spelled with the wrong sign is a refresh every
 * second or none at all, and a token that lives SHORTER than the lead would be
 * a refresh loop with no sleep in it at all.
 *
 * ## Why the machine takes a `post`
 *
 * Three calls in this file go to Google, and the whole of what they need is a
 * POST and a JSON parse. Taking that as an argument is what lets
 * `account.test.ts` drive every transition without a socket and without a fake
 * HTTP server; `./server.ts` passes the platform's own with a timeout on it. It
 * is the same seam `Env.dial` is for a plugin that speaks somebody else's
 * client library (`olai-plugin-xyne-spaces`), reduced to the platform primitive
 * because this plugin has no client library to be handed.
 */

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

/** How long before expiry the refresh wakes. Five minutes of a token that lives
 *  for an hour is a refresh that lands long before the config file is read. */
export const LEAD_MS = 5 * 60 * 1000

/** The floor under any refresh gap. A token whose life is at or under the lead
 *  — Google does answer small `expires_in` values, and a fixture can — would
 *  otherwise be refreshed the moment it arrives, forever. */
export const MINIMUM_GAP_MS = 5 * 1000

/** Retry backoff for a failure that is the world rather than a verdict: the
 *  first wait, and the ceiling a doubling sequence stops at. Ten minutes is a
 *  compromise a person can feel: quick enough that a blip heals unnoticed, slow
 *  enough that a serve left running with no network is not a load generator. */
export const RETRY_MS = 30 * 1000
export const RETRY_CAP_MS = 10 * 60 * 1000

/** How long a `state` stays good for. Ten minutes is the plan's number and
 *  Google's own recommendation for a code's lifetime; a second tab's consent
 *  screen left open overnight must not be an authorization this serve honours. */
export const PENDING_MS = 10 * 60 * 1000

/**
 * WHEN TO REFRESH, from a token's own life, in epoch milliseconds.
 *
 * Two subtractions and a floor, and each is a mistake this plugin could make:
 * the lead is why a call never has to fail once before it succeeds, HALF THE
 * TOKEN'S OWN LIFE is why a short-lived token is not refreshed in a tight loop
 * (`expires_in <= LEAD_MS` would otherwise answer *now* every time), and
 * {@link MINIMUM_GAP_MS} is why an absurd `expires_in` cannot spin at all.
 */
export const refreshDue = (input: { readonly now: number; readonly expiresIn: number }): number =>
  input.now + Math.max(input.expiresIn * 1000 - LEAD_MS, input.expiresIn * 500, MINIMUM_GAP_MS)

/** What a profile call answers, once `gmail profile get` has been read. */
export interface Profile {
  readonly address: string
  readonly messages: number | null
}

/** The profile's own JSON, as the pinned binary prints it under `--json`:
 *  `{"email": …, "messages-total": …, "threads-total": …, "history-id": …}`
 *  (kebab-case keys, and the two totals are omitted when Gmail does not send
 *  them). Everything optional except the address, which is the arm's whole
 *  proof that the token is a Gmail token. */
export const profileOf = (raw: unknown): Profile | undefined => {
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
 * composed request and answers the status and the text, and `./server.ts` is
 * the one place that knows a socket is involved (it puts a timeout on it).
 */
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
  /** Arm a connect: mint a state and a PKCE verifier, answer the URL. */
  readonly begin: (origin: string) => Effect.Effect<{ readonly url: string }, MailRefusal>
  /** Spend the callback: exchange the code, ask the profile, publish
   *  `connected`. Answers the address, which is what the landing page says. */
  readonly complete: (callback: { readonly code: string; readonly state: string }) => Effect.Effect<{ readonly address: string }, MailRefusal>
  /** Revoke at Google (best effort), forget the record, publish `absent`. */
  readonly disconnect: () => Effect.Effect<void, MailRefusal>
  /** The first arm, run once at activation: the record, if any, brought up. */
  readonly boot: () => Effect.Effect<void>
  /** The reading this machine last published — what a cell that has just been
   *  connected to is set to (`./server.ts`). The ONLY reason the reading is
   *  kept here rather than in the composition root: whoever knows it is the
   *  writer, and there must be one. */
  readonly current: () => Account
  /** The refresh fiber's body. `./server.ts` forks it onto the plugin's scope;
   *  it never ends, and the scope is what stops it. */
  readonly refresh: Effect.Effect<void>
}

/**
 * CAN THIS SERVE REACH GOOGLE AT ALL.
 *
 * `every` carries the endpoints so no caller has to narrow the union again;
 * `broken` is an obstruction a PRESS cannot fix (a serve that was not started
 * from the Nix build, an origin that is not loopback) and is the row's fault
 * whatever is on disk; `unarmed` is the operator's two doors, which is the one
 * obstruction that leaves the row an ordinary no-account one.
 */
type Readiness =
  | { readonly kind: "every"; readonly endpoints: Endpoints }
  | { readonly kind: "broken"; readonly reason: string }
  | { readonly kind: "unarmed"; readonly reason: string }

/** ONE ARMED CONNECT — the state a callback must carry, the PKCE verifier the
 *  exchange must prove, and when it was minted. The redirect is deliberately
 *  NOT here: the module-level `redirect` is what the callback is exchanged
 *  against, and a second copy of it would only be a copy (`begin` writes it
 *  before minting this, so the two could never differ). */
interface Pending {
  readonly state: string
  readonly verifier: string
  readonly at: number
}

export const makeAccount = (inputs: AccountInputs): AccountMachine => {
  const { clock, google, himalaya, memory, paint, post, warn } = inputs
  const client = inputs.client?.trim() ? inputs.client.trim() : undefined
  const secret = inputs.secret?.trim() ? inputs.secret.trim() : undefined

  /** The current retry gap, doubling to {@link RETRY_CAP_MS} and reset by any
   *  success. State rather than a computation because a backoff is a fact about
   *  a sequence of failures, not about any one of them. */
  let backoff = RETRY_MS
  let pending: Pending | undefined
  let redirect = ""
  /** THE READING, and its one owner. Every arm publishes through
   *  {@link publish}, `begin` re-reads it to keep the redirect it just made
   *  knowable, and `current` hands it to a cell that has just been bound. */
  let shown: Account = MAIL_UNCONNECTED

  /**
   * THE FIBER'S INPUT — the deadlines the arms hand it, and the only channel
   * between them. `refresh` mints the queue when it starts and publishes
   * {@link arm} for the arms to offer through; a deadline that arrives while
   * the fiber sleeps waits in the queue rather than being lost, which is what
   * the shared-variable version needed two re-reads to fake.
   */
  let arm: ((deadline: number | undefined) => void) | undefined

  const now = (): number => Date.parse(clock.now())

  /** THE ONE READING every edge and every arm is decided by. See {@link Readiness}. */
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

  /** PARK: the answer is a person's, so nothing is retried until somebody
   *  answers — a Reconnect, a Disconnect, or a restart with the environment
   *  fixed. `arm(undefined)` is what stops the fiber: a parked fiber takes a
   *  value, sees there is nothing to wait for, and takes again. */
  const stops = (reason: string, address: string | null = null): void => {
    arm?.(undefined)
    publish(account({ status: "fault", reason, address }))
  }

  /** ...AND WAIT: the token and the record are both still good, so the next
   *  attempt is armed on the backoff and the cell says it is retrying rather
   *  than asking for a consent it does not need. */
  const retrying = (reason: string, address: string | null = null): void => {
    arm?.(now() + backoff)
    backoff = Math.min(backoff * 2, RETRY_CAP_MS)
    publish(account({ status: "fault", reason, retrying: true, address }))
  }

  /** NOTHING TO DO, and why: a serve with no account of its own. `broken` is a
   *  fault whatever is on disk; `unarmed` is the ordinary absent arm carrying
   *  the operator's sentence, which is what the row explains itself with. */
  const idle = (): void => {
    const state = ready()
    if (state.kind === "broken") return stops(state.reason)
    arm?.(undefined)
    publish(account({ status: "absent", reason: state.kind === "unarmed" ? state.reason : null }))
  }

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

  /**
   * THE LAST HALF OF BOTH ROADS INTO `connected`: with a live access token in
   * hand, write it into the generated config, ask the profile, and publish.
   *
   * THROWS NOTHING, and ANSWERS THE PROFILE it saw — `undefined` on every
   * failing arm, which has already published the fault that says why. Both
   * callers want exactly that value: `bringUp` discards it, and `complete` is a
   * procedure whose answer IS the address, so it must not have to read the
   * mailbox back out of the disk record the way it used to (a refused write
   * there would have left it answering *the mailbox did not answer* about a
   * mailbox whose profile had just been read).
   *
   * A CHILD PROCESS THAT DOES NOT ANSWER IS A RETRY, not a verdict: the token
   * and the config are already in place, so nothing here is a person's to fix.
   * The one exception is a profile this plugin cannot read, which is a fact
   * about the pin's JSON and cannot change under a running serve — so it parks.
   */
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
      const settled: MemoryRecord = { ...keep, address: profile.address }
      yield* memory.remember(settled).pipe(
        Effect.catch((refusal: Refusal) => Effect.sync(() => {
          // The connection works and the disk did not take the note; saying so
          // is the whole of what this arm can do without turning a working
          // mailbox into a fault. The reading, the profile and the answer to
          // the procedure are all still the mailbox this serve just read.
          warn(`mail: could not write ${profile.address} to the memory record: ${refusal._tag}`)
        })),
      )
      arm?.(refreshDue({ now: now(), expiresIn: tokens.expiresIn }))
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

  /** Refresh, then {@link settle}. The road a boot and the refresh fiber take. */
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
        // A VERDICT: the grant is gone (revoked at Google, or expired by
        // Google's own inactivity rule) and only a person pressing Reconnect
        // can replace it. The generated config holds a token Google just
        // refused, so it goes.
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
        pending = { state: newState(), verifier: newVerifier(), at: now() }
        // The row's hint tells a person what to register in Google Cloud, and
        // that string is only knowable once a page has said where it is.
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
        const kept: MemoryRecord = { refreshToken, address: null, scope: answer.tokens.scope ?? SCOPE, connectedAt: clock.now() }
        yield* asMail(memory.remember(kept))
        // STRAIGHT INTO THE PROFILE, with the token Google just handed us in
        // the exchange — a refresh here would be a second round trip for a
        // token that is seconds old, and it would make the connect flow depend
        // on the refresh grant working at the moment of connecting. The address
        // is the arm's proof: a record that cannot answer one is a record this
        // serve must not report as connected.
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
          // BEST EFFORT, and said so: a revoke that could not be sent leaves a
          // grant at Google that this serve has already stopped using, and
          // turning a person's Disconnect into an error would leave the token
          // on disk — the one outcome that is actually worse.
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

    current: () => shown,

    refresh: Effect.gen(function*() {
      // THE CHANNEL, minted by its only reader. The arms reach it through the
      // closure below, so a deadline cannot be offered before the fiber is
      // listening (an offer that lands first waits in the queue) and nothing
      // shared has to be re-read after a sleep.
      const deadlines = yield* Queue.unbounded<number | undefined>()
      arm = (deadline) => {
        Queue.offerUnsafe(deadlines, deadline)
      }
      while (true) {
        const due = yield* Queue.take(deadlines)
        // `undefined` is PARKED: nothing to refresh — no account, a verdict, a
        // disconnect. Take again and wait for the next arm.
        if (due === undefined) continue
        yield* Effect.sleep(Math.max(0, due - now()))
        const record = memory.current()
        if (record === undefined) continue
        yield* bringUp(record)
      }
    }),
  }
}
