import { gate } from "@olai/effect-cordis"
import { UsageFailure } from "@olai/format"
import { calls, type Tool } from "@olai/ops"
import { Effect, Fiber, Result, Schema } from "effect"
import type { openMailbox } from "./mailbox.ts"
import { MailRefusal } from "./wire.ts"

const described = (description: string) => Schema.String.annotate({ description })
const thread = described("Opaque hexadecimal Gmail thread id. File as <address>/<thread id>.").check(Schema.isPattern(/^[0-9a-f]+$/i))
const ThreadArgs = Schema.Struct({ thread })
const pagination = {
  max: Schema.optionalKey(Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 50 })).annotate({ description: "Maximum threads, 1–50; defaults to 20." })),
  page: Schema.optionalKey(described("Opaque next-page token from the previous reply.")),
}
const names = Schema.Array(described("Label name as Gmail shows it; system labels use capitals: INBOX, UNREAD, STARRED, IMPORTANT.")).check(Schema.isMinLength(1), Schema.isMaxLength(10))
const attachments = Schema.Array(Schema.Struct({
  path: described("Absolute path to a file this server can read: one uploaded into this conversation, one saved by mail_attachment, or one in the vault.").check(Schema.isPattern(/^\/[^\r\n\x00]*$/)),
  filename: Schema.optionalKey(described("Name the file arrives under; defaults to the path's own. Capped at 120 characters.")),
  type: Schema.optionalKey(described("MIME type as type/subtype, such as application/pdf. Defaults to the filename's extension, else application/octet-stream.")),
})).check(Schema.isMinLength(1), Schema.isMaxLength(10))
const draftFields = {
  to: Schema.optionalKey(Schema.Array(described("Recipient address or display name <address>. Required for new mail; Replies default to Reply-To or From; if you sent the last message, its To recipients."))),
  cc: Schema.optionalKey(Schema.Array(described("Explicit copy recipients, including for reply-all."))),
  bcc: Schema.optionalKey(Schema.Array(described("Blind copy recipients."))),
  subject: Schema.optionalKey(described("Required for new mail; replies default to Re: and the original subject.")),
  body: described("Plain text only, nonempty, at most 256 KiB. No HTML; send a document with `attachments` instead of pasting it here."),
  thread: Schema.optionalKey(thread),
  attachments: Schema.optionalKey(attachments.annotate({ description: "Attachments to send, 1–10, 25 MB in total and each. Every path must be absolute; a path that is missing, unreadable or not a regular file refuses the whole draft before anything is written." })),
}
const draftDescription = "Writes a draft in Gmail Drafts for the person to review and send; olai cannot send mail. At most 50 recipients, and at most 10 attachments totalling 25 MB."
const manual = " Gmail query syntax is passed verbatim: from:, newer_than:1d, is:unread, has:attachment, label:. Thread ids are opaque Gmail hex ids; file a thread as <address>/<thread id>. Labels use Gmail's displayed names (system labels INBOX, UNREAD, STARRED, IMPORTANT)."

/** Activation-local capabilities only: no vault or conversation identity is needed. */
export const makeTools = (mailbox: Effect.Success<ReturnType<typeof openMailbox>>) => Effect.gen(function*() {
  const owned = yield* gate("mail", "tools")
  const perform = <A>(verb: string, args: unknown, work: Effect.Effect<A, MailRefusal>) => Effect.gen(function*() {
    const started = Date.now()
    const result = yield* owned.through(Effect.result(work), fiber => fiber ? Fiber.join(fiber) : Effect.succeed(Result.fail(new MailRefusal({ reason: "mail is no longer running" }))))
    yield* Effect.logDebug(`mail tool verb=${verb} args=${JSON.stringify(args)} duration=${Date.now() - started} outcome=${result._tag === "Success" ? "ok" : "refused"}`)
    if (result._tag === "Failure") {
      return yield* Effect.fail(new UsageFailure({ reason: result.failure.reason }))
    }
    return { ...result.success, mail: verb }
  })
  const tools: ReadonlyArray<Tool> = [
    calls("inbox", "Read inbox", "List inbox threads." + manual, Schema.Struct({ ...pagination, unread: Schema.optionalKey(Schema.Boolean.annotate({ description: "Only unread threads when true." })) }), false,
      (_client: unknown, args) => perform("inbox", args, mailbox.list("inbox", args))),
    calls("search", "Search mail", "Search Gmail threads." + manual, Schema.Struct({ ...pagination, query: described("Gmail query, passed untouched."), includeSpamTrash: Schema.optionalKey(Schema.Boolean.annotate({ description: "Include spam and trash." })) }), false,
      (_client: unknown, args) => perform("search", args, mailbox.list("search", args))),
    calls("thread", "Read mail thread", "Read messages, raw HTML and plain text; bodies capped at 64 KiB. Lists attachments without fetching them." + manual, ThreadArgs, false,
      (_client: unknown, args) => perform("thread", args, mailbox.thread(args.thread))),
    calls("attachment", "Save mail attachment", "Read the thread first. Saves an attachment up to 50 MB in this mail activation's temporary directory, removed when mail stops." + manual,
      Schema.Struct({ message: described("Opaque Gmail message id from mail_thread.").check(Schema.isPattern(/^[0-9a-f]+$/i)), attachment: described("Opaque attachment id from mail_thread.").check(Schema.isPattern(/^[A-Za-z0-9_][A-Za-z0-9_-]*$/)), filename: Schema.optionalKey(described("Optional filename; sanitised and capped at 120 characters.")) }), false,
      (_client: unknown, args) => perform("attachment", args, mailbox.attachment(args.message, args.attachment, args.filename))),
    ...(["archive", "trash", "untrash"] as const).map(kind => calls(kind, `${kind} mail thread`, `${kind === "archive" ? "Remove INBOX from" : kind === "trash" ? "Move to Gmail Trash:" : "Restore from Gmail Trash:"} a thread. Never permanently deletes mail.` + manual, ThreadArgs, true,
      (_client: unknown, args) => perform(kind, args, mailbox.write(kind, args)))),
    calls("label", "Label mail thread", "Add or remove existing labels by name. Supply at least one list; unknown labels refuse before any write." + manual,
      Schema.Struct({ thread, add: Schema.optionalKey(names.annotate({ description: "Existing label names to add, 1–10. Supply add or remove (or both)." })), remove: Schema.optionalKey(names.annotate({ description: "Existing label names to remove, 1–10. Unknown names refuse the entire write." })) }), true,
      (_client: unknown, args) => perform("label", args, mailbox.write("label", args))),
    calls("read", "Mark mail read", "Set whether a thread is read." + manual, Schema.Struct({ thread, read: Schema.Boolean.annotate({ description: "True marks read; false marks unread." }) }), true,
      (_client: unknown, args) => perform("read", args, mailbox.write("read", args))),
    calls("draft", "Draft mail", draftDescription, Schema.Struct(draftFields), true,
      (_client: unknown, args) => perform("draft", args, mailbox.draft(args))),
    calls("draft_update", "Update mail draft", "Full replacement: supply the complete recipients, subject, body and attachments again (or thread for reply defaults). Omitted attachments are dropped. To keep a reply draft threaded, pass the same thread again. " + draftDescription,
      Schema.Struct({ ...draftFields, draft: described("Opaque Gmail draft id returned by mail_draft.").check(Schema.isPattern(/^[A-Za-z0-9_-]+$/)) }), true,
      (_client: unknown, args) => perform("draft_update", args, mailbox.draft(args))),
  ]
  return tools
})
