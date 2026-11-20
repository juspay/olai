import { createHash } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { GMAIL, GMAIL_VERBS, type GmailVerb } from "../../himalaya/verbs.ts"
import { ATTACHMENT_BYTES, fixtureNamed, MAILBOXES, LABELS, THREADS } from "./fixtures.ts"

export const PINNED_VERSION = "himalaya v2.1.0 +msgraph +rustls-ring +imap +sieve +smtp +gmail +jmap +maildir"

const BUILD_LINE = "build: linux gnu x86_64"
const GIT_LINE = "git: olai-fake-himalaya"

export const SPEAKS: ReadonlyArray<string> = GMAIL_VERBS.map((verb) => verb.id)

export interface MailFixture {
  readonly mailbox?: boolean
  readonly stale?: boolean
  readonly version?: string
  readonly profile?: {
    readonly email: string
    readonly messagesTotal?: number
    readonly threadsTotal?: number
    readonly historyId?: string
  }
  readonly failure?: string
}

export interface FakeHimalaya {
  readonly path: string
  readonly fixturePath: string
  readonly speaks: ReadonlyArray<string>
  readonly deliver: (thread: string, subject: string, inbox?: boolean) => void
  readonly expireHistory: () => void
  readonly rewrite: (fixture: MailFixture) => void
  readonly stop: () => Promise<void>
}

const SCRIPT = "himalaya"
const FIXTURE = "fixture.json"

interface Answered {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

interface Invocation {
  readonly config: string | null
  readonly json: boolean
  readonly version: boolean
  readonly words: ReadonlyArray<string>
}

const parseInvocation = (argv: ReadonlyArray<string>): Invocation => {
  let at = 0
  let config: string | null = null
  let json = false
  let version = false
  while (at < argv.length) {
    const word = argv[at]
    if (word === undefined) break
    if (word === "-c" || word === "--config") {
      const named = argv[at + 1]
      if (named !== undefined) config = named
      at += named === undefined ? 1 : 2
      continue
    }
    if (word.startsWith("--config=")) {
      config = word.slice("--config=".length)
      at += 1
      continue
    }
    if (word === "--json") {
      json = true
      at += 1
      continue
    }
    if (word === "--version" || word === "-V") {
      version = true
      at += 1
      continue
    }
    break
  }
  return { config, json, version, words: argv.slice(at) }
}

const ANNOUNCES = `this fake speaks ${GMAIL_VERBS
  .map((verb) => `\`himalaya ${verb.path.join(" ")}\` (${verb.id}, ${verb.says})`)
  .join("; ")} — and nothing else.`

const refused = (stderr: string): Answered => ({ code: 2, stdout: "", stderr })

const failed = (sentence: string): Answered => ({
  code: 1,
  stdout: JSON.stringify({ error: sentence, sources: [], backtrace: null }),
  stderr: "",
})

const answerFor = (verb: GmailVerb, fixture: MailFixture, fixturePath: string): Answered => {
  if (verb.id !== GMAIL.profileGet.id) {
    return failed(`this fake has no answer for ${verb.id}; speak it with a fixture that does`)
  }
  const profile = fixture.profile
  if (profile === undefined) {
    return failed(`the fixture at ${fixturePath} carries no profile, so this fake has nothing to answer \`himalaya ${verb.path.join(" ")}\` with`)
  }
  // The pinned binary's own JSON: `email`, the two totals — `messages-total` and
  // `threads-total`, OMITTED when Gmail does not send them — then `history-id`.
  // Kebab-case keys are the real spelling, and `../../account.ts`'s `profileOf`
  // reads the two omissions as its `null` arm.
  return {
    code: 0,
    stdout: JSON.stringify({
      email: profile.email,
      ...(profile.messagesTotal === undefined ? {} : { "messages-total": profile.messagesTotal }),
      ...(profile.threadsTotal === undefined ? {} : { "threads-total": profile.threadsTotal }),
      ...(profile.historyId === undefined ? {} : { "history-id": profile.historyId }),
    }),
    stderr: "",
  }
}

const says = (answer: Answered): void => {
  if (answer.stdout !== "") process.stdout.write(`${answer.stdout}\n`)
  if (answer.stderr !== "") process.stderr.write(`${answer.stderr}\n`)
  process.exitCode = answer.code
}

export const main = async (argv: ReadonlyArray<string>): Promise<void> => {
  const invocation = parseInvocation(argv)

  const script = process.argv[1]
  if (script === undefined) {
    says(refused("fake-himalaya: no script in argv[1] to find the fixture beside"))
    return
  }
  const fixturePath = path.join(path.dirname(path.resolve(script)), FIXTURE)

  let fixture: MailFixture
  try {
    fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as MailFixture
  } catch (error) {
    says(refused(`fake-himalaya: could not read ${fixturePath}: ${String(error)}`))
    return
  }

  if (invocation.version) {
    says({ code: 0, stdout: [fixture.version ?? PINNED_VERSION, BUILD_LINE, GIT_LINE].join("\n"), stderr: "" })
    return
  }

  if (invocation.config === null) {
    says(refused(`error: the required argument '--config <PATH>' was not provided

this fake answers only the invocation the plugin composes: \`himalaya -c <config> --json <verb…>\`.`))
    return
  }

  if (!existsSync(invocation.config)) {
    says(refused(`error: the config named by '--config' does not exist: ${invocation.config}

\`-c\` names the file \`../../himalaya/run.ts\` writes the access token into before it runs anything, and this fake will not answer a verb against a config that is not there.`))
    return
  }

  if (!invocation.json) {
    says(refused(`error: an invocation with no '--json'

this fake answers only the JSON shape the plugin reads, and never the table the pinned binary draws without \`--json\`.`))
    return
  }

  const verb = GMAIL_VERBS.find((one) => one.path.every((word, at) => invocation.words[at] === word))
  if (verb === undefined) {
    says(refused(`error: unrecognized subcommand '${invocation.words.join(" ")}'

${ANNOUNCES}

Usage: himalaya [OPTIONS] [COMMAND]

For more information, try '--help'.`))
    return
  }

  if (fixture.failure !== undefined) {
    says(failed(fixture.failure))
    return
  }

  appendFileSync(path.join(path.dirname(fixturePath), "calls.ndjson"), JSON.stringify({ verb: verb.id, args: invocation.words.slice(verb.path.length) }) + "\n")
  if (verb.id === GMAIL.profileGet.id && fixture.mailbox && fixture.profile) {
    const history = historyAt(path.dirname(fixturePath))
    says(answerFor(verb, { ...fixture, profile: { ...fixture.profile, historyId: history.latest } }, fixturePath))
    return
  }
  if (verb.id !== GMAIL.profileGet.id && fixture.mailbox) {
    says(mailAnswer(verb, invocation.words.slice(verb.path.length), path.dirname(fixturePath), fixture.stale))
    return
  }
  says(answerFor(verb, fixture, fixturePath))
}

const SCRIPT_BODY = `#!/usr/bin/env bun
// Written by olai-plugin-mail's appliance testlib. Not edited and not committed:
// it lives in the temp directory beside fixture.json for the length of one
// scenario, and it is the whole of what "a Himalaya this build did not pin"
// looks like to the serve that spawns it.
import { main } from ${JSON.stringify(path.resolve(import.meta.dirname, "fake-himalaya.ts"))}

await main(process.argv.slice(2))
`

export const startFakeHimalaya = async (name: string): Promise<FakeHimalayaByName> => {
  const fake = await startFakeHimalayaFor(fixtureNamed(MAILBOXES, "mailbox", name))
  return {
    ...fake,
    rewrite: (next) => {
      fake.rewrite(fixtureNamed(MAILBOXES, "mailbox", next))
    },
  }
}

export interface FakeHimalayaByName extends Omit<FakeHimalaya, "rewrite"> {
  readonly rewrite: (name: string) => void
}

export const startFakeHimalayaFor = async (fixture: MailFixture): Promise<FakeHimalaya> => {
  const directory = mkdtempSync(path.join(tmpdir(), "olai-fake-himalaya-"))
  const fixturePath = path.join(directory, FIXTURE)
  const executable = path.join(directory, SCRIPT)
  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2))
  writeFileSync(executable, SCRIPT_BODY)
  // Written and then chmodded rather than created with a mode: the umask masks
  // the mode of a new file, and the one thing this file MUST be is executable
  // by whoever spawns it.
  chmodSync(executable, 0o755)
  return {
    path: executable,
    fixturePath,
    speaks: SPEAKS,
    deliver: (thread, subject, inbox = true) => deliverMail(directory, thread, subject, inbox),
    expireHistory: () => { const history = historyAt(directory); history.latest = String(Number(history.latest) + 10); history.floor = history.latest; writeFileSync(path.join(directory, "history.json"), JSON.stringify(history)) },
    rewrite: (next) => {
      writeFileSync(fixturePath, JSON.stringify(next, null, 2))
    },
    stop: () => rm(directory, { recursive: true, force: true }),
  }
}

export const draftContents = (contentType: string, body: string): { body: string; attachments: Array<{ filename: string; type: string; bytes: number; sha256: string }> } => {
  const boundary = /boundary="([^"]+)"/.exec(contentType)?.[1]
  if (!/^multipart\/mixed/i.test(contentType.trim()) || boundary === undefined) return { body: Buffer.from(body, "base64").toString("utf8"), attachments: [] }
  const [text, ...rest] = parseParts(body, boundary)
  return {
    body: text === undefined ? "" : text.content.toString("utf8"),
    attachments: rest.map(part => ({
      filename: partFilename(part.headers),
      type: (part.headers["Content-Type"] ?? "application/octet-stream").split(";")[0]!.trim(),
      bytes: part.content.length,
      sha256: createHash("sha256").update(part.content).digest("hex"),
    })),
  }
}
interface DraftPart { readonly headers: Record<string, string>; readonly content: Buffer }
const headersOf = (head: string): Record<string, string> => Object.fromEntries(head.replace(/\r\n[ \t]+/g, " ").split("\r\n").filter(Boolean).map(line => {
  const at = line.indexOf(":")
  return [line.slice(0, at), line.slice(at + 1).trim()]
}))
const parseParts = (body: string, boundary: string): DraftPart[] => body.split(`--${boundary}`).slice(1)
  .filter(part => !part.startsWith("--"))
  .map(part => {
    const whole = part.replace(/^\r\n/, "")
    const blank = whole.indexOf("\r\n\r\n")
    const headers = headersOf(blank === -1 ? whole : whole.slice(0, blank))
    const content = blank === -1 ? "" : whole.slice(blank + 4).replace(/\r\n$/, "")
    return { headers, content: Buffer.from(content, (headers["Content-Transfer-Encoding"] ?? "").toLowerCase() === "base64" ? "base64" : "utf8") }
  })
const partFilename = (headers: Record<string, string>): string => {
  const disposition = headers["Content-Disposition"] ?? ""
  const extended = /filename\*=([^;]+)/i.exec(disposition)?.[1]
  if (extended !== undefined) {
    const value = /^(?:[^']*)'[^']*'(.*)$/.exec(extended.trim())?.[1] ?? extended.trim()
    return Buffer.from(value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))), "binary").toString("utf8")
  }
  const quoted = /filename="([^"]*)"/i.exec(disposition)?.[1] ?? /\bname="([^"]*)"/i.exec(headers["Content-Type"] ?? "")?.[1]
  return quoted === undefined ? "" : decodeWords(quoted)
}
const decodeWords = (value: string): string => value
  .replace(/(\?=)\s+(=\?UTF-8\?B\?)/gi, "$1$2")
  .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_, encoded: string) => Buffer.from(encoded, "base64").toString("utf8"))

export const mailAnswer = (verb: GmailVerb, args: ReadonlyArray<string>, directory: string, stale = false): Answered => {
  const ok = (value: unknown): Answered => ({ code: 0, stdout: JSON.stringify(value), stderr: "" })
  const flag = (name: string) => args[args.indexOf(name) + 1]
  const values = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1] ?? ""] : [])
  if (verb.id === "drafts.create" || verb.id === "drafts.update") {
    const id = verb.id === "drafts.update" ? args[0]! : `draft_${readdirSync(directory).filter(file => /^draft-.*\.json$/.test(file)).length + 1}`
    const saved = path.join(directory, `draft-${id}.json`)
    if (verb.id === "drafts.update" && !existsSync(saved)) return failed("404 draft not found")
    const file = args[args.indexOf("--") + 1]
    if (!args.includes("--") || !file || !existsSync(file)) return failed("draft message must be a file after --")
    const raw = readFileSync(file, "utf8")
    const [head, ...body] = raw.split("\r\n\r\n")
    const headers = Object.fromEntries(Object.entries(headersOf(head!)).map(([name, value]) => [name, decodeWords(value)]))
    const record = { id, headers, ...draftContents(headers["Content-Type"] ?? "", body.join("\r\n\r\n")), args, file }
    writeFileSync(saved, JSON.stringify(record))
    return ok({ id, "message-id": `message_${id}`, "thread-id": args.includes("--thread-id") ? flag("--thread-id") : null })
  }
  const originals = [...THREADS]
  for (const file of readdirSync(directory).filter(file => /^thread-[0-9a-f]+\.json$/.test(file))) {
    const saved = JSON.parse(readFileSync(path.join(directory, file), "utf8")) as typeof THREADS[number]
    if (!originals.some(t => t.id === saved.id)) originals.push(saved)
  }
  const threads = originals.map(original => {
    const file = path.join(directory, `thread-${original.id}.json`)
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as typeof original : structuredClone(original)
  })
  if (stale) {
    threads[0]!.messages[0]!["label-ids"].push("Label_deleted", "SYSTEM_UNKNOWN")
  }
  if (verb.id === "history.list") {
    if (!args.includes("--start-history-id") || flag("--label-id") !== "INBOX" || flag("--history-type") !== "messageAdded") return failed("history requires a start id and the inbox messageAdded filters")
    const history = historyAt(directory)
    const since = Number(flag("--start-history-id"))
    if (since < Number(history.floor)) return failed("404 history id expired")
    const records = history.records.filter(record => Number(record.id) > since)
    const start = args.includes("--page-token") ? Number(flag("--page-token")) : 0
    const max = Math.min(Number(flag("-s")), 2)
    return ok({ history: records.slice(start, start + max), "history-id": history.latest, next_page: start + max < records.length ? String(start + max) : null })
  }
  if (verb.id === "labels.list") return ok(LABELS)
  if (verb.id === "threads.list") {
    const query = args.includes("-q") ? flag("-q") ?? "" : ""
    let selected = threads.filter(t => {
      const labels = t.messages.flatMap(m => m["label-ids"])
      if (!args.includes("--include-spam-trash") && !query.includes("in:trash") && !query.includes("in:spam") && (labels.includes("TRASH") || labels.includes("SPAM"))) return false
      if (!values("-l").every(l => labels.includes(l))) return false
      return query.split(/\s+/).filter(Boolean).every(word => word === "is:unread" ? labels.includes("UNREAD")
        : word === "in:trash" ? labels.includes("TRASH")
        : word.startsWith("from:") ? t.messages.some(m => m.headers.some(h => h.name === "From" && h.value.includes(word.slice(5))))
        : t.messages.some(m => m.headers.some(h => h.name === "Subject" && h.value.toLowerCase().includes(word.toLowerCase()))))
    })
    const start = args.includes("--page-token") ? Number(flag("--page-token")) : 0
    const max = args.includes("-s") ? Number(flag("-s")) : 20
    const next = start + max < selected.length ? String(start + max) : null
    selected = selected.slice(start, start + max)
    return ok({ threads: selected.map(t => ({ id: t.id })), ...(next ? { next_page: next } : {}) })
  }
  if (verb.id === "attachments.get") {
    const size = args[1] === undefined ? undefined : ATTACHMENT_BYTES[args[1]]
    if (stale || args[0] !== "a32" || size === undefined) return failed("404 not found")
    const output = flag("-o")
    if (!output) return failed("output path required")
    writeFileSync(output, Buffer.alloc(size, 65))
    return ok(`Saved ${size} bytes to ${output}`)
  }
  const thread = threads.find(t => t.id === args[0])
  if (!thread) return failed("404 not found")
  if (verb.id === "threads.get") {
    return ok(flag("--format") === "full" ? thread : { ...thread, messages: thread.messages.map(({ payload, ...message }) => message) })
  }
  const add = verb.id === "threads.trash" ? ["TRASH"] : values("--add-label")
  const remove = verb.id === "threads.untrash" ? ["TRASH"] : values("--remove-label")
  if ([...add, ...remove].some(id => !LABELS.labels.some(l => l.id === id))) return failed("Invalid label: unknown label id")
  for (const message of thread.messages) message["label-ids"] = [...new Set([...message["label-ids"], ...add])].filter(id => !remove.includes(id))
  writeFileSync(path.join(directory, `thread-${thread.id}.json`), JSON.stringify(thread))
  return ok(`Gmail thread ${thread.id} successfully modified`)
}

interface FakeHistory {
  latest: string
  floor: string
  records: Array<{ id: string; "messages-added": string[]; "messages-deleted": string[]; "labels-added": never[]; "labels-removed": never[]; "messages-added-details": Array<{ id: string; "thread-id": string; "label-ids": string[] }> }>
}
const historyAt = (directory: string): FakeHistory => {
  const file = path.join(directory, "history.json")
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { latest: "100", floor: "0", records: [] }
}
const deliverMail = (directory: string, id: string, subject: string, inbox: boolean): void => {
  const history = historyAt(directory)
  history.latest = String(Number(history.latest) + 1)
  const file = path.join(directory, `thread-${id}.json`)
  let thread: typeof THREADS[number]
  try {
    thread = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    thread = structuredClone(THREADS.find(t => t.id === id) ?? { id, messages: [] })
  }
  const message = { payload: { mimeType: "text/plain", parts: [] }, id: id + history.latest, "label-ids": inbox ? ["INBOX", "UNREAD"] : ["UNREAD"], snippet: subject + " preview", headers: [{ name: "Subject", value: subject }, { name: "From", value: "Ravi <ravi@example.com>" }, { name: "Date", value: "2026-09-15T09:15:00Z" }] }
  thread.messages.push(message)
  writeFileSync(file, JSON.stringify(thread))
  history.records.push({ id: history.latest, "messages-added": [message.id], "messages-deleted": [], "labels-added": [], "labels-removed": [], "messages-added-details": [{ id: message.id, "thread-id": id, "label-ids": message["label-ids"] }] })
  writeFileSync(path.join(directory, "history.json"), JSON.stringify(history))
}
