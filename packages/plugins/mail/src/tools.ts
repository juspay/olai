import { gate } from "@olai/effect-cordis"
import { UsageFailure } from "@olai/format"
import { calls, type Tool } from "@olai/ops"
import { Effect, Fiber, Result, Schema, Semaphore } from "effect"
import type { AccountMachine } from "./account.ts"
import { openAttachments } from "./attachments.ts"
import type { Himalaya, Run } from "./himalaya/run.ts"
import { delta, fullOf, idsOf, Listing, rowOf, Thread } from "./himalaya/threads.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import { makeLabels } from "./labels.ts"
import { MailRefusal } from "./wire.ts"

const described = (description: string) => Schema.String.annotate({ description })
const thread = described("Opaque hexadecimal Gmail thread id. File as <address>/<thread id>.").check(Schema.isPattern(/^[0-9a-f]+$/i))
const ThreadArgs = Schema.Struct({ thread })
const pagination = {
  max: Schema.optionalKey(Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 50 })).annotate({ description: "Maximum threads, 1–50; defaults to 20." })),
  page: Schema.optionalKey(described("Opaque next-page token from the previous reply.")),
}
const names = Schema.Array(described("Label name as Gmail shows it; system labels use capitals: INBOX, UNREAD, STARRED, IMPORTANT.")).check(Schema.isMinLength(1), Schema.isMaxLength(10))
const manual = " Gmail query syntax is passed verbatim: from:, newer_than:1d, is:unread, has:attachment, label:. Thread ids are opaque Gmail hex ids; file a thread as <address>/<thread id>. Labels use Gmail's displayed names (system labels INBOX, UNREAD, STARRED, IMPORTANT)."

/** Activation-local capabilities only: no vault or conversation identity is needed. */
export const makeTools = (himalaya: Himalaya, machine: Pick<AccountMachine, "current" | "usable">, runtime?: string) => Effect.gen(function*() {
  const spawns = yield* Semaphore.make(4)
  const run = (call: Run) => spawns.withPermits(1)(Effect.suspend(() => {
    const state = machine.current()
    if (!machine.usable()) return Effect.fail(new MailRefusal({ reason: state.status === "absent"
      ? "no Gmail account is connected to this serve — connect one in ⧉ plugins"
      : state.reason ?? "the Gmail access token has expired; reconnect in ⧉ plugins" }))
    return himalaya.run(call)
  }))
  const labels = makeLabels(run)
  const attachments = yield* openAttachments(runtime, run)
  const owned = yield* gate("mail", "tools")
  const writes = new Map<string, { permit: Semaphore.Semaphore; users: number }>()
  let address: string | null = null
  const ready = Effect.gen(function*() {
    const state = machine.current()
    if (!machine.usable()) return yield* Effect.fail(new MailRefusal({ reason: state.status === "absent" ? "no Gmail account is connected to this serve — connect one in ⧉ plugins" : state.reason ?? "the Gmail access token has expired; reconnect in ⧉ plugins" }))
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
  const perform = <A>(verb: string, args: unknown, work: Effect.Effect<A, MailRefusal>) => Effect.gen(function*() {
    const started = Date.now()
    const result = yield* owned.through(Effect.result(work), fiber => fiber ? Fiber.join(fiber) : Effect.succeed(Result.fail(new MailRefusal({ reason: "mail is no longer running" }))))
    yield* Effect.logDebug(`mail tool verb=${verb} args=${JSON.stringify(args)} duration=${Date.now() - started} outcome=${result._tag === "Success" ? "ok" : "refused"}`)
    if (result._tag === "Failure") {
      const reason = !result.failure.reason.startsWith("the write was sent") && /\b404\b|not found|notFound/i.test(result.failure.reason) ? `this thread is not in ${machine.current().address}` : result.failure.reason
      return yield* Effect.fail(new UsageFailure({ reason }))
    }
    return { ...result.success, mail: verb }
  })
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
  const tools: ReadonlyArray<Tool> = [
    calls("inbox", "Read inbox", "List inbox threads." + manual, Schema.Struct({ ...pagination, unread: Schema.optionalKey(Schema.Boolean.annotate({ description: "Only unread threads when true." })) }), false,
      (_client: unknown, args) => perform("inbox", args, list("inbox", args))),
    calls("search", "Search mail", "Search Gmail threads." + manual, Schema.Struct({ ...pagination, query: described("Gmail query, passed untouched."), includeSpamTrash: Schema.optionalKey(Schema.Boolean.annotate({ description: "Include spam and trash." })) }), false,
      (_client: unknown, args) => perform("search", args, list("search", args))),
    calls("thread", "Read mail thread", "Read messages, raw HTML and plain text; bodies capped at 64 KiB. Lists attachments without fetching them." + manual, ThreadArgs, false,
      (_client: unknown, args) => perform("thread", args, Effect.gen(function*() {
        const address = yield* ready
        yield* labels.load
        const answer = fullOf(address, yield* get(args.thread, true), labels.names)
        for (const m of answer.messages) attachments.remember(m.id, m.attachments)
        return answer
      }))),
    calls("attachment", "Save mail attachment", "Read the thread first. Saves an attachment up to 50 MB in this mail activation's temporary directory, removed when mail stops." + manual,
      Schema.Struct({ message: described("Opaque Gmail message id from mail_thread.").check(Schema.isPattern(/^[0-9a-f]+$/i)), attachment: described("Opaque attachment id from mail_thread.").check(Schema.isPattern(/^[A-Za-z0-9_][A-Za-z0-9_-]*$/)), filename: Schema.optionalKey(described("Optional filename; sanitised and capped at 120 characters.")) }), false,
      (_client: unknown, args) => perform("attachment", args, ready.pipe(Effect.andThen(attachments.get(args.message, args.attachment, args.filename))))),
    ...(["archive", "trash", "untrash"] as const).map(kind => calls(kind, `${kind} mail thread`, `${kind === "archive" ? "Remove INBOX from" : kind === "trash" ? "Move to Gmail Trash:" : "Restore from Gmail Trash:"} a thread. Never permanently deletes mail.` + manual, ThreadArgs, true,
      (_client: unknown, args) => perform(kind, args, write(kind, args)))),
    calls("label", "Label mail thread", "Add or remove existing labels by name. Supply at least one list; unknown labels refuse before any write." + manual,
      Schema.Struct({ thread, add: Schema.optionalKey(names), remove: Schema.optionalKey(names) }), true,
      (_client: unknown, args) => perform("label", args, write("label", args))),
    calls("read", "Mark mail read", "Set whether a thread is read." + manual, Schema.Struct({ thread, read: Schema.Boolean.annotate({ description: "True marks read; false marks unread." }) }), true,
      (_client: unknown, args) => perform("read", args, write("read", args))),
  ]
  return tools
})
