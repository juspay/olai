import { Effect, Schema, Semaphore } from "effect"
import type { AccountMachine } from "./account.ts"
import { openAttachments } from "./attachments.ts"
import type { Himalaya, Run } from "./himalaya/run.ts"
import { delta, fullOf, idsOf, Listing, rowOf, Thread } from "./himalaya/threads.ts"
import { History } from "./himalaya/history.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import { makeLabels } from "./labels.ts"
import { addressList, compose, validateDraft, type DraftArgs } from "./compose.ts"
import { MailRefusal } from "./wire.ts"

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
  const run = (call: Run) => spawns.withPermits(1)(Effect.suspend(() => {
    const state = account()
    if (state instanceof MailRefusal) return Effect.fail(state)
    return himalaya.run(call).pipe(Effect.mapError(error => {
      if (!/\b404\b|not found|notFound/i.test(error.reason)) return error
      const reason = call.verb === GMAIL.attachmentsGet ? "this attachment is not on that message"
        : [GMAIL.threadsGet, GMAIL.threadsModify, GMAIL.threadsTrash, GMAIL.threadsUntrash].some(verb => verb === call.verb) ? `this thread is not in ${state.address}`
        : call.verb === GMAIL.draftsUpdate ? `this draft is not in ${state.address}`
        : error.reason
      return new MailRefusal({ reason })
    }))
  }))
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
  const get = (id: string, full = false) => Effect.gen(function*() {
    const raw = yield* run({ verb: GMAIL.threadsGet, args: [id, "--format", full ? "full" : "metadata", ...(full ? [] : ["--header", "subject", "--header", "from", "--header", "date"])] })
    const decoded = yield* decode(Thread, raw)
    yield* labels.ensureIds(idsOf(decoded))
    return decoded
  })
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
  const write = (kind: string, args: { thread: string; add?: ReadonlyArray<string>; remove?: ReadonlyArray<string>; read?: boolean }) => serialize(args.thread, Effect.gen(function*() {
    const address = yield* ready
    const add = kind === "read" && !args.read ? ["UNREAD"] : args.add ?? []
    const remove = kind === "archive" ? ["INBOX"] : kind === "read" && args.read ? ["UNREAD"] : args.remove ?? []
    if (kind === "label" && !add.length && !remove.length) return yield* Effect.fail(new MailRefusal({ reason: "supply at least one label to add or remove" }))
    const added = yield* labels.resolve(add)
    const removed = yield* labels.resolve(remove)
    if (added.some(id => removed.includes(id))) return yield* Effect.fail(new MailRefusal({ reason: "a label cannot be both added and removed" }))
    const before = yield* get(args.thread)
    const verb = kind === "trash" ? GMAIL.threadsTrash : kind === "untrash" ? GMAIL.threadsUntrash : GMAIL.threadsModify
    yield* run({ verb, args: [args.thread, ...added.flatMap(id => ["--add-label", id]), ...removed.flatMap(id => ["--remove-label", id])] })
    const after = yield* get(args.thread).pipe(Effect.mapError(error => new MailRefusal({ reason: `the write was sent, but its result could not be read; check this thread before retrying: ${error.reason}` })))
    const changed = delta(labels.names(idsOf(before)), labels.names(idsOf(after)))
    yield* Effect.logInfo(`mail wrote thread=${args.thread} added=${JSON.stringify(changed.added)} removed=${JSON.stringify(changed.removed)}`)
    return { address, id: after.id, labels: labels.names(idsOf(after)), changed }
  }))
  const thread = (id: string) => Effect.gen(function*() {
    const address = yield* ready
    yield* labels.load
    const answer = fullOf(address, yield* get(id, true), labels.names)
    for (const m of answer.messages) attachments.remember(m.id, m.attachments)
    return answer
  })
  const DraftOutput = Schema.Struct({ id: Schema.String, "message-id": Schema.String, "thread-id": Schema.NullOr(Schema.String) })
  const draft = (args: DraftArgs) => {
    const work = Effect.gen(function*() {
      const address = yield* ready
      yield* Effect.fromResult(validateDraft(args))
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
          const from = yield* Effect.fromResult(addressList(header("From") ?? ""))
          const mine = from.some(sender => sender.toLowerCase() === address.toLowerCase())
          to = yield* Effect.fromResult(addressList(mine ? header("To") ?? "" : header("Reply-To") || header("From") || ""))
        }
        const original = header("Subject") ?? ""
        subject ??= /^re:/i.test(original) ? original : `Re: ${original}`
      }
      const resolved = { ...args, from: address, to: to!, subject: subject!, inReplyTo, references }
      const message = yield* Effect.fromResult(compose(resolved))
      const raw = yield* run({ verb: args.draft ? GMAIL.draftsUpdate : GMAIL.draftsCreate,
        args: [...args.draft ? [args.draft] : [], ...args.thread ? ["--thread-id", args.thread] : []], message })
      const output = yield* decode(DraftOutput, raw)
      return { address, draft: output.id, message: output["message-id"], thread: output["thread-id"], to: resolved.to, cc: args.cc ?? [], subject: resolved.subject, updated: args.draft !== undefined }
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
  return { list, thread, attachment, write, draft, history, seed, summary }
})
