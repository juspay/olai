import { createHash } from "node:crypto"
import { Effect, Result, Schema, Semaphore } from "effect"
import type { AccountMachine } from "./account.ts"
import { openAttachments } from "./attachments.ts"
import type { Himalaya, Run } from "./himalaya/run.ts"
import { delta, fullOf, idsOf, Listing, rowOf, Thread } from "./himalaya/threads.ts"
import { History } from "./himalaya/history.ts"
import { GMAIL, type GmailVerb } from "./himalaya/verbs.ts"
import { makeLabels } from "./labels.ts"
import { addressList, compose, validateDraft, type DraftArgs } from "./compose.ts"
import { readEnclosures } from "./enclosures.ts"
import { MailRefusal } from "./wire.ts"

const DraftOutput = Schema.Struct({ id: Schema.String, "message-id": Schema.NullOr(Schema.String), "thread-id": Schema.NullOr(Schema.String) })
// Empty defaults are a reply-policy refusal; malformed nonempty headers still
// use the composer's address syntax refusal. Explicit recipients bypass this.
const replyAddresses = (header: string) => header.trim() ? addressList(header)
  : Result.fail(new MailRefusal({ reason: "this thread names no one to reply to; pass `to`" }))

/** The most threads one `mail_bulk` call acts on: the schema's bound on `threads` and `max`, and the default `max`. */
export const BULK_LIMIT = 50
/** What one write does to a thread, for `mail_bulk` and the five single-thread tools alike. */
type Action = "archive" | "trash" | "untrash" | "read" | "unread" | "label"
/** `mail_bulk`'s arguments: exactly one of `threads` and `query`; the rest refine one of them. */
interface BulkArgs {
  readonly action: Action
  readonly threads?: ReadonlyArray<string>
  readonly query?: string
  readonly includeSpamTrash?: boolean
  readonly max?: number
  readonly confirm?: string
  readonly add?: ReadonlyArray<string>
  readonly remove?: ReadonlyArray<string>
}
/** One write resolved before any thread is touched; see `change` below. */
interface WritePlan {
  readonly action: Action
  readonly verb: GmailVerb
  readonly added: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
  readonly argv: (id: string) => string[]
  readonly settled: (thread: Thread) => boolean
}

/** Mailbox operations and caches share the owning mail activation's scope.
 * Tool schemas, transcript decoration and the invocation gate belong to tools.ts. */
export const openMailbox = (himalaya: Himalaya, machine: Pick<AccountMachine, "current" | "usable">, runtime?: string) => Effect.gen(function*() {
  const account = () => {
    const state = machine.current()
    return machine.usable() ? state : new MailRefusal({ reason: state.status === "absent"
      ? "no Gmail account is connected to this serve — connect one in ⧉ plugins"
      : state.reason ?? "the Gmail access token has expired; reconnect in ⧉ plugins" })
  }
  const spawns = yield* Semaphore.make(4)
  /** One spawn, its refusal reworded for the agent. `absent` is Gmail's "no such
   *  thread", read off Himalaya's own sentence before the rewording, so a bulk
   *  run tells one missing thread from a failing mailbox without parsing prose. */
  const attempt = (call: Run) => spawns.withPermits(1)(Effect.suspend(() => {
    const state = account()
    if (state instanceof MailRefusal) return Effect.fail({ refusal: state, absent: false })
    return himalaya.run(call).pipe(Effect.mapError(error => {
      if (!/\b404\b|not found|notFound/i.test(error.reason)) return { refusal: error, absent: false }
      const thread = [GMAIL.threadsGet, GMAIL.threadsModify, GMAIL.threadsTrash, GMAIL.threadsUntrash].some(verb => verb === call.verb)
      const reason = call.verb === GMAIL.attachmentsGet ? "this attachment is not on that message"
        : thread ? `this thread is not in ${state.address}`
        : call.verb === GMAIL.draftsUpdate ? `this draft is not in ${state.address}`
        : error.reason
      return { refusal: new MailRefusal({ reason }), absent: thread }
    }))
  }))
  const run = (call: Run) => attempt(call).pipe(Effect.mapError(failed => failed.refusal))
  const labels = makeLabels(run)
  const attachments = yield* openAttachments(runtime, run)
  const writes = new Map<string, { permit: Semaphore.Semaphore; users: number }>()
  let address: string | null = null
  const ready = Effect.gen(function*() {
    const state = account()
    if (state instanceof MailRefusal) return yield* Effect.fail(state)
    if (address !== state.address) { labels.clear(); attachments.clear(); address = state.address }
    return state.address ?? ""
  })
  const decode = <A>(schema: Schema.Codec<A>, raw: unknown) => Schema.decodeUnknownEffect(schema)(raw).pipe(Effect.mapError(() => new MailRefusal({ reason: "Himalaya answered JSON that does not match its published schema" })))
  /** A thread read, failing as `attempt` does so a bulk run can tell a missing thread from a failing mailbox. */
  const readThread = (id: string, full = false) => Effect.gen(function*() {
    const raw = yield* attempt({ verb: GMAIL.threadsGet, args: [id, "--format", full ? "full" : "metadata", ...(full ? [] : ["--header", "subject", "--header", "from", "--header", "date"])] })
    return yield* decode(Thread, raw).pipe(Effect.tap(decoded => labels.ensureIds(idsOf(decoded))), Effect.mapError(refusal => ({ refusal, absent: false })))
  })
  const get = (id: string, full = false) => readThread(id, full).pipe(Effect.mapError(failed => failed.refusal))
  const serialize = <A>(id: string, work: Effect.Effect<A, MailRefusal>) => Effect.acquireUseRelease(
    Effect.sync(() => {
      let entry = writes.get(id)
      if (!entry) { entry = { permit: Semaphore.makeUnsafe(1), users: 0 }; writes.set(id, entry) }
      entry.users++
      return entry
    }),
    entry => entry.permit.withPermits(1)(work),
    entry => Effect.sync(() => { if (--entry.users === 0) writes.delete(id) }),
  )
  const list = (kind: "inbox" | "search", args: { max?: number; page?: string; unread?: boolean; query?: string; includeSpamTrash?: boolean }) => Effect.gen(function*() {
    const address = yield* ready
    yield* labels.load
    const query = kind === "inbox" ? (args.unread ? "is:unread" : undefined) : args.query
    const raw = yield* run({ verb: GMAIL.threadsList, args: ["-s", String(args.max ?? 20), ...(kind === "inbox" ? ["-l", "INBOX"] : []), ...(query === undefined ? [] : ["-q", query]), ...(args.page ? ["--page-token", args.page] : []), ...(args.includeSpamTrash ? ["--include-spam-trash"] : [])] })
    const listed = yield* decode(Listing, raw)
    const threads = yield* Effect.forEach(listed.threads, t => get(t.id).pipe(Effect.map(t => rowOf(t, labels.names))), { concurrency: 4 })
    return { address, threads, next: listed.next_page ?? null, ...(kind === "search" ? { query } : {}) }
  })
  /** What a write sends, the same for one thread and for many: Gmail's verb, its
   *  argv, the label ids resolved once, and whether a thread is already where the
   *  write would put it: every message carries every label added (trash adds
   *  TRASH) and none carries a label removed (untrash removes TRASH). */
  const change = (action: Action, labelled: { add?: ReadonlyArray<string>; remove?: ReadonlyArray<string> }) => Effect.gen(function*() {
    const add = action === "unread" ? ["UNREAD"] : labelled.add ?? []
    const remove = action === "archive" ? ["INBOX"] : action === "read" ? ["UNREAD"] : labelled.remove ?? []
    if (action === "label" && !add.length && !remove.length) return yield* Effect.fail(new MailRefusal({ reason: "supply at least one label to add or remove" }))
    const added = yield* labels.resolve(add)
    const removed = yield* labels.resolve(remove)
    if (added.some(id => removed.includes(id))) return yield* Effect.fail(new MailRefusal({ reason: "a label cannot be both added and removed" }))
    const carries = action === "trash" ? ["TRASH"] : added
    const lacks = action === "untrash" ? ["TRASH"] : removed
    return {
      action, added, removed,
      verb: action === "trash" ? GMAIL.threadsTrash : action === "untrash" ? GMAIL.threadsUntrash : GMAIL.threadsModify,
      argv: (id: string) => [id, ...added.flatMap(label => ["--add-label", label]), ...removed.flatMap(label => ["--remove-label", label])],
      settled: (thread: Thread) => thread.messages.every(m => carries.every(label => m["label-ids"].includes(label)) && !lacks.some(label => m["label-ids"].includes(label))),
    } satisfies WritePlan
  })
  const write = (kind: Exclude<Action, "unread">, args: { thread: string; add?: ReadonlyArray<string>; remove?: ReadonlyArray<string>; read?: boolean }) => serialize(args.thread, Effect.gen(function*() {
    const address = yield* ready
    const plan = yield* change(kind === "read" && !args.read ? "unread" : kind, args)
    const before = yield* get(args.thread)
    yield* run({ verb: plan.verb, args: plan.argv(args.thread) })
    const after = yield* get(args.thread).pipe(Effect.mapError(error => new MailRefusal({ reason: `the write was sent, but its result could not be read; check this thread before retrying: ${error.reason}` })))
    const changed = delta(labels.names(idsOf(before)), labels.names(idsOf(after)))
    yield* Effect.logInfo(`mail wrote thread=${args.thread} added=${JSON.stringify(changed.added)} removed=${JSON.stringify(changed.removed)}`)
    return { address, id: after.id, labels: labels.names(idsOf(after)), changed }
  }))
  /** Up to BULK_LIMIT threads, each under its own thread permit: one read, then the
   *  write unless the thread is already in place. A missing thread fails alone;
   *  any other failure is the mailbox's or the session's, so no further thread
   *  starts and the rest are skipped. The run's state ends with the call. */
  const apply = (ids: ReadonlyArray<string>, plan: WritePlan) => Effect.gen(function*() {
    const halt: { reason: string | null } = { reason: null }
    const failed = (failure: { refusal: MailRefusal; absent: boolean }) => {
      if (!failure.absent) halt.reason ??= failure.refusal.reason
      return { outcome: "failed" as const, reason: failure.refusal.reason }
    }
    const one = (id: string) => Effect.gen(function*() {
      if (halt.reason !== null) return { id, outcome: "skipped" as const }
      return yield* serialize(id, Effect.gen(function*() {
        const read = yield* Effect.result(readThread(id))
        if (read._tag === "Failure") return { id, ...failed(read.failure) }
        const row = rowOf(read.success, labels.names)
        if (plan.settled(read.success)) return { ...row, outcome: "unchanged" as const }
        const wrote = yield* Effect.result(attempt({ verb: plan.verb, args: plan.argv(id) }))
        if (wrote._tag === "Failure") return { ...row, ...failed(wrote.failure) }
        yield* Effect.logInfo(`mail bulk ${plan.action} wrote thread=${id}`)
        return { ...row, outcome: "applied" as const }
      }))
    })
    const threads = yield* Effect.forEach(ids, one, { concurrency: 4 })
    const counts = { applied: 0, unchanged: 0, failed: 0, skipped: 0 }
    for (const row of threads) counts[row.outcome]++
    return { action: plan.action, threads, counts, stopped: halt.reason }
  })
  /** By id list: applied at once. By query: a preview that writes nothing and
   *  answers a code over the action, its label ids and the matched ids; then the
   *  same call with that code, listed again and applied only if the code still
   *  matches. Nothing is kept between the two calls. */
  const bulk = (args: BulkArgs) => Effect.gen(function*() {
    const refuse = (reason: string) => Effect.fail(new MailRefusal({ reason }))
    if ((args.threads === undefined) === (args.query === undefined)) return yield* refuse("supply either `threads`, a list of thread ids, or `query`, a Gmail query, and not both")
    if (args.threads && (args.confirm !== undefined || args.max !== undefined || args.includeSpamTrash !== undefined)) return yield* refuse("`confirm`, `max` and `includeSpamTrash` go with `query`; a list of thread ids is applied at once")
    if (args.action !== "label" && (args.add !== undefined || args.remove !== undefined)) return yield* refuse("`add` and `remove` go only with the action label")
    const address = yield* ready
    const plan = yield* change(args.action, args)
    if (args.threads) return { address, ...yield* apply([...new Set(args.threads)], plan) }
    const query = args.query!
    const max = args.max ?? BULK_LIMIT
    const raw = yield* run({ verb: GMAIL.threadsList, args: ["-s", String(max + 1), "-q", query, ...(args.includeSpamTrash ? ["--include-spam-trash"] : [])] })
    const listed = (yield* decode(Listing, raw)).threads
    const covered = listed.slice(0, max)
    const ids = covered.map(t => t.id)
    const found = { address, query, matched: ids.length, more: listed.length > max }
    const code = createHash("sha256").update(JSON.stringify([args.action, plan.added, plan.removed, [...ids].sort()])).digest("hex").slice(0, 16)
    if (args.confirm === undefined) {
      const sample = yield* Effect.forEach(ids.slice(0, 10), id => get(id).pipe(Effect.map(t => rowOf(t, labels.names))), { concurrency: 4 })
      return { ...found, action: args.action, threads: covered.map(t => ({ id: t.id, snippet: t.snippet ?? "" })), sample, ...(ids.length ? { confirm: code } : {}) }
    }
    if (!ids.length) return yield* refuse("nothing matches this query now, so there is nothing to confirm")
    if (args.confirm !== code) return yield* refuse("the matching threads changed since the preview; call again without confirm to see them")
    return { ...found, ...yield* apply(ids, plan) }
  })
  const thread = (id: string) => Effect.gen(function*() {
    const address = yield* ready
    yield* labels.load
    const answer = fullOf(address, yield* get(id, true), labels.names)
    for (const m of answer.messages) attachments.remember(m.id, m.attachments)
    return answer
  })
  const draft = (args: DraftArgs) => {
    const work = Effect.gen(function*() {
      const address = yield* ready
      yield* Effect.fromResult(validateDraft(args))
      // Read before the thread is looked up: an unreadable file is a refusal
      // the caller earns without this serve asking Gmail anything.
      const attachments = yield* readEnclosures(args.attachments)
      let to = args.to
      let subject = args.subject
      let inReplyTo: string | undefined
      let references: string | undefined
      if (args.thread) {
        const raw = yield* run({ verb: GMAIL.threadsGet, args: [args.thread, "--format", "metadata", ...["Message-ID", "References", "Reply-To", "From", "To", "Subject"].flatMap(name => ["--header", name])] })
        const thread = yield* decode(Thread, raw)
        const last = thread.messages.at(-1)
        const header = (name: string) => last?.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value
        inReplyTo = header("Message-ID")
        if (!inReplyTo) return yield* Effect.fail(new MailRefusal({ reason: "this thread's last message has no Message-ID to reply to" }))
        references = [header("References"), inReplyTo].filter(Boolean).join(" ")
        if (to === undefined) {
          const fromHeader = header("From") ?? ""
          const from = yield* Effect.fromResult(replyAddresses(fromHeader))
          const mine = from.some(sender => sender.toLowerCase() === address.toLowerCase())
          const recipients = mine ? header("To") ?? "" : header("Reply-To") || fromHeader
          to = yield* Effect.fromResult(replyAddresses(recipients))
        }
        const original = header("Subject") ?? ""
        subject ??= /^re:/i.test(original) ? original : `Re: ${original}`
      }
      const resolved = { ...args, from: address, to: to!, subject: subject!, inReplyTo, references }
      const message = yield* Effect.fromResult(compose(resolved, attachments))
      const raw = yield* run({ verb: args.draft ? GMAIL.draftsUpdate : GMAIL.draftsCreate,
        args: [...args.draft ? [args.draft] : [], ...args.thread ? ["--thread-id", args.thread] : []], message })
      const output = yield* decode(DraftOutput, raw)
      return { address, draft: output.id, message: output["message-id"], thread: output["thread-id"], to: resolved.to, cc: args.cc ?? [], subject: resolved.subject, updated: args.draft !== undefined,
        attachments: attachments.map(one => ({ filename: one.filename, type: one.type, bytes: one.data.length })) }
    })
    // A reply shares the thread permit with label/trash writes. Replacements
    // additionally share a draft permit, always acquired before a thread permit.
    const threaded = args.thread ? serialize(args.thread, work) : work
    return args.draft ? serialize(`draft:${args.draft}`, threaded) : threaded
  }
  const attachment = (message: string, id: string, filename?: string) => ready.pipe(Effect.andThen(attachments.get(message, id, filename)))
  // History/profile cadence has its own sequential fiber, outside tool permits.
  const history = (since: string, page?: string) => ready.pipe(Effect.andThen(himalaya.run({ verb: GMAIL.historyList,
    args: ["--start-history-id", since, "--label-id", "INBOX", "--history-type", "messageAdded", "-s", "500", ...(page ? ["--page-token", page] : [])],
  })), Effect.flatMap(raw => decode(History, raw)))
  const seed = ready.pipe(Effect.andThen(himalaya.run({ verb: GMAIL.profileGet, args: [] })), Effect.flatMap(raw => decode(Schema.Struct({ "history-id": Schema.String }), raw)), Effect.map(raw => raw["history-id"]))
  const summary = (id: string) => ready.pipe(Effect.andThen(get(id)), Effect.map(t => rowOf(t, labels.names)))
  return { list, thread, attachment, write, bulk, draft, history, seed, summary }
})
