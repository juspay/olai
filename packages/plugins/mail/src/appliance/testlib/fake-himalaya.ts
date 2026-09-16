/**
 * A HIMALAYA THAT IS NOT HIMALAYA — the pinned binary's shape, spawned the way
 * the plugin spawns the real one, answering the verbs `../../himalaya/verbs.ts`
 * freezes.
 *
 * ## Why a fake BINARY rather than a stub runner
 *
 * The plugin does not call a library: it composes an argv from the verb table
 * and SPAWNS `env.vars.OLAI_HIMALAYA` (`../../himalaya/run.ts`). So everything
 * that can be wrong about "what olai asks Himalaya" is a PROCESS BOUNDARY — a
 * global `-c <config>`, the global `--json`, the verb's own words, JSON on
 * stdout, and a refusal that is `{"error": …}` on STDOUT with a non-zero exit.
 * A fake that did not cross that boundary would test the plugin's own spelling
 * of the boundary and nothing else, so this one writes the boundary into a temp
 * directory and hands the harness ONE ABSOLUTE PATH for `OLAI_HIMALAYA`:
 *
 *   - `<temp>/himalaya` — mode 0755, `#!/usr/bin/env bun`, importing this
 *     module and running `main(process.argv.slice(2))`. Spawning it is spawning
 *     a program: `shell: false`, no `which`, no PATH walk, exactly as `run.ts`
 *     does it;
 *   - `<temp>/fixture.json` — what the next call answers. It is re-read on
 *     EVERY run (the `fake-service.ts` habit, and the reason the two files are
 *     separate), so `rewrite(fixture)` moves the answers of a conversation that
 *     is already running.
 *
 * The file is written with `writeFileSync` and `rewrite` is synchronous because
 * that is the shape the harness wants: a scenario changes what the next call
 * says between two `await`s, with no promise to thread through a step.
 *
 * ## What it refuses, and why the refusals are the point
 *
 * A fake that answers anything proves nothing. This one OFFERS exactly the rows
 * of `GMAIL_VERBS`, matched on `verb.path`, so a scenario cannot pass against a
 * fake that answers a subcommand the pin does not have — and refuses everything
 * else in clap's own shape (`error: unrecognized subcommand '<words>'`, exit 2)
 * with a sentence naming what it does speak. Two more refusals stand on the
 * same principle:
 *
 *   - it answers only `--json` invocations, because that is the only shape the
 *     plugin asks for, and the table the pinned binary draws without it is a
 *     shape this fake does not pretend to render;
 *   - it will not answer a verb when `-c` names no file. That file is the
 *     plugin's own token — `../../himalaya/run.ts` writes it before it runs
 *     anything, and a runner that reached the network without one would be a
 *     bug the fake should catch rather than a bug it should paper over.
 *
 * ## The pin's two facts, held here as answers
 *
 * `--version` prints the pin's first line — `himalaya v2.1.0 +msgraph …`, the
 * one `scripts/check-himalaya-surface.ts` parses — then the `build:` and `git:`
 * lines the real binary prints under it. A `version` in the fixture replaces
 * the FIRST line only, which is how a scenario makes a serve read a pin that is
 * too old. Version is answered BEFORE any verb and regardless of `-c`: a serve
 * whose binary cannot state its version cannot do anything else either.
 *
 * `failure` overrides every verb: a scenario drives the plugin's `fault` arm by
 * making the next call refuse with Google's own sentence, in the `--json` error
 * shape — `{"error": …, "sources": [], "backtrace": null}`, on STDOUT, exit 1.
 * JSON goes to stdout in this fake and never to stderr, which is the property
 * `run.ts`'s `refusedWith` is written around.
 */

import { appendFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { GMAIL, GMAIL_VERBS, type GmailVerb } from "../../himalaya/verbs.ts"
import { fixtureNamed, MAILBOXES, LABELS, THREADS } from "./fixtures.ts"

/** The first line `himalaya --version` prints at the pin this repo carries, and
 *  the string a scenario replaces when it wants a serve to see an older one.
 *  Spelled here rather than derived from `himalaya.nix`: the point of a fake is
 *  to say what the plugin expects, and the check that the PIN matches this is
 *  `scripts/check-himalaya-surface.ts`'s, run against the built binary. */
export const PINNED_VERSION = "himalaya v2.1.0 +msgraph +rustls-ring +imap +sieve +smtp +gmail +jmap +maildir"

/** The two lines under it. Nothing reads them — they are here so `--version`
 *  has the shape a reader (or a parser with no `head -1`) expects, and so a
 *  plugin that started reading the second line would have something to fail
 *  against rather than an empty one. */
const BUILD_LINE = "build: linux gnu x86_64"
const GIT_LINE = "git: olai-fake-himalaya"

/** WHAT THIS FAKE OFFERS, by verb id — the answer to "is this fake the pin's
 *  binary?", and what `startFakeHimalaya` returns as `speaks`. Derived from the
 *  frozen table, so PR 2's verbs appear here the moment they appear there. */
export const SPEAKS: ReadonlyArray<string> = GMAIL_VERBS.map((verb) => verb.id)

/** The mailbox and the answers, as a scenario writes them. Every field is
 *  optional because every field is a thing a scenario is CHOOSING to say: a
 *  fixture with a `failure` is a binary that refuses, one with a `profile` is a
 *  signed-in mailbox, and one with neither is a binary that offers verbs and
 *  has nothing to answer them with (which the fake says in a sentence rather
 *  than answering `null`). */
export interface MailFixture {
  readonly mailbox?: boolean
  readonly stale?: boolean
  /** Replaces the first line of `--version`. */
  readonly version?: string
  /** What `gmail profile get --json` answers. `messagesTotal` and
   *  `threadsTotal` are OMITTED from the answer when omitted here — Gmail does
   *  not always send them, and the plugin's `profileOf` reads them as nullable
   *  — so a fixture that leaves them out is how the `null` arm is reached.
   *  `historyId` is carried in the answer as the kebab-case `history-id`. */
  readonly profile?: {
    readonly email: string
    readonly messagesTotal?: number
    readonly threadsTotal?: number
    readonly historyId?: string
  }
  /** When set, the NEXT call refuses with this sentence, as the real binary
   *  refuses under `--json`: exit 1, `{"error": …}` on stdout. `--version` is
   *  answered as usual — a pin is not a permission. */
  readonly failure?: string
}

/** The fake, as the harness holds it. */
export interface FakeHimalaya {
  /** The executable to hand the plugin as `OLAI_HIMALAYA` — one absolute path,
   *  spawned as `<path> -c <config> --json <verb…>`. */
  readonly path: string
  /** The fixture file, for a harness that would rather write it itself. */
  readonly fixturePath: string
  /** The verb ids this fake answers — {@link SPEAKS}. */
  readonly speaks: ReadonlyArray<string>
  /** What the next call answers, as a FIXTURE — this fake's own currency. A
   *  scenario moves between the suite's named worlds instead, through the
   *  interface below. Synchronous, so a scenario can move it between two awaits
   *  without threading a promise through the step. */
  readonly deliver: (thread: string, subject: string, inbox?: boolean) => void
  readonly expireHistory: () => void
  readonly rewrite: (fixture: MailFixture) => void
  /** Remove the temp directory. The spawned runs are short-lived processes the
   *  plugin owns, so there is nothing else to stop. */
  readonly stop: () => Promise<void>
}

/** The two files the temp directory holds. */
const SCRIPT = "himalaya"
const FIXTURE = "fixture.json"

/** What one invocation of the fake prints, and what it exits with — the two
 *  streams kept apart on purpose, because a rule of this fake is that JSON is
 *  only ever written to stdout. */
interface Answered {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

/** One invocation, as clap would see the part of it this plugin uses: the
 *  GLOBAL flags first (`himalayaArgv` puts `-c` and `--json` there, and clap's
 *  global flags are accepted before the subcommand words), then the subcommand
 *  words and their arguments. */
interface Invocation {
  readonly config: string | null
  readonly json: boolean
  readonly version: boolean
  /** Every word after the global flags: the verb's own path first, then the
   *  arguments it was given. */
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

/** What this fake offers, in one sentence — the half of a refusal that says
 *  what WOULD have worked, built from the table's own `says` so it cannot drift
 *  from what the verb is for. */
const ANNOUNCES = `this fake speaks ${GMAIL_VERBS
  .map((verb) => `\`himalaya ${verb.path.join(" ")}\` (${verb.id}, ${verb.says})`)
  .join("; ")} — and nothing else.`

/** A usage refusal: clap's shape, exit 2, stdout empty. */
const refused = (stderr: string): Answered => ({ code: 2, stdout: "", stderr })

/** The real binary's own refusal under `--json`: the sentence as an `error` on
 *  STDOUT, exit 1 — the shape `run.ts` reads back. */
const failed = (sentence: string): Answered => ({
  code: 1,
  stdout: JSON.stringify({ error: sentence, sources: [], backtrace: null }),
  stderr: "",
})

/** One verb's answer, and the arm for a verb this fake has no answer for — a
 *  refusal rather than a throw, because that is a fixture nobody has written
 *  yet and a conversation is a better place to read it than a stack trace. */
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

/** Write the answer and let the PROCESS exit with its code: `process.exitCode`
 *  rather than `process.exit`, so a spawn that is reading a pipe sees every
 *  byte before the runtime ends. */
const says = (answer: Answered): void => {
  if (answer.stdout !== "") process.stdout.write(`${answer.stdout}\n`)
  if (answer.stderr !== "") process.stderr.write(`${answer.stderr}\n`)
  process.exitCode = answer.code
}

/**
 * ONE INVOCATION OF THE FAKE BINARY — what the generated `himalaya` script runs
 * with `process.argv.slice(2)`. It never throws for anything the argv can say:
 * every wrong invocation is an exit code and a sentence, because that is what a
 * spawn sees.
 */
export const main = async (argv: ReadonlyArray<string>): Promise<void> => {
  const invocation = parseInvocation(argv)

  // The fixture is BESIDE THE RUNNING SCRIPT, which is the whole reason the
  // harness needs only one path. `process.argv[1]` is that script — bun's own
  // path when the shebang ran, the script's own when it was passed to `bun`.
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
    // The FIRST line is the fixture's to move; the two under it are the shape
    // the real binary prints, kept so nothing here depends on there being one
    // line to read.
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

  // The verb whose path these words begin with, or nothing the pin has at all.
  // Matched on `verb.path` rather than on a spelling here, so the frozen table
  // is the only place a subcommand is named.
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

/** The executable the harness hands the plugin, as one constant: it re-enters
 *  THIS module by absolute path, so the fake the plugin talks to is the fake a
 *  test reads.
 *
 *  It leaves the exit to the runtime rather than `.then(process.exit)`: the
 *  answer is written inside `main`, and `process.exit` does not promise a pipe
 *  has drained. */
const SCRIPT_BODY = `#!/usr/bin/env bun
// Written by olai-plugin-mail's appliance testlib. Not edited and not committed:
// it lives in the temp directory beside fixture.json for the length of one
// scenario, and it is the whole of what "a Himalaya this build did not pin"
// looks like to the serve that spawns it.
import { main } from ${JSON.stringify(path.resolve(import.meta.dirname, "fake-himalaya.ts"))}

await main(process.argv.slice(2))
`

/**
 * THE FAKE, STARTED — one temp directory holding the executable and the
 * fixture. `fixture` is what the FIRST call answers; {@link FakeHimalaya.rewrite}
 * moves it afterwards.
 */
/**
 * START THE FAKE BY FIXTURE NAME — `@mail-himalaya:<name>`, resolved here.
 *
 * The NAME is the whole of what a caller hands over, and this module is what
 * turns it into an answering mailbox: the tables are this row's vocabulary
 * (`./fixtures.ts`), and a door that handed them out would make every consumer
 * resolve a name and compose a fixture — one operation spread across the door
 * and all its callers. A name nobody wrote is a sentence naming what there is.
 */
export const startFakeHimalaya = async (name: string): Promise<FakeHimalayaByName> => {
  const fake = await startFakeHimalayaFor(fixtureNamed(MAILBOXES, "mailbox", name))
  return {
    ...fake,
    rewrite: (next) => {
      fake.rewrite(fixtureNamed(MAILBOXES, "mailbox", next))
    },
  }
}

/** ...AND WHAT THAT HANDS BACK: the same fake with its answers addressed by the
 *  name a scenario wrote rather than by a fixture. One operation, one currency
 *  per audience — a scenario moves a serve between the worlds this suite
 *  stands behind, and a test of the fake itself moves a fixture. */
export interface FakeHimalayaByName extends Omit<FakeHimalaya, "rewrite"> {
  readonly rewrite: (name: string) => void
}

/** The same, for a fixture a TEST's own file wrote (and the internal half of
 *  the name-taking starter above). Not exported from the door: a scenario
 *  points a serve at one of the named worlds, and a fixture nobody named is a
 *  test's own business. */
/** The fixture-level starter, for a test that writes its own world. */
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

/** Per-thread files let separate fake processes preserve writes without lost updates on other threads. */
export const mailAnswer = (verb: GmailVerb, args: ReadonlyArray<string>, directory: string, stale = false): Answered => {
  const ok = (value: unknown): Answered => ({ code: 0, stdout: JSON.stringify(value), stderr: "" })
  const flag = (name: string) => args[args.indexOf(name) + 1]
  const values = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1] ?? ""] : [])
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
    if (stale || args[0] !== "a32" || args[1] !== "attachment_1") return failed("404 not found")
    const output = flag("-o")
    if (!output) return failed("output path required")
    writeFileSync(output, Buffer.alloc(12288, 65))
    return ok(`Saved 12288 bytes to ${output}`)
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
  const thread = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as typeof THREADS[number] : structuredClone(THREADS.find(t => t.id === id) ?? { id, messages: [] })
  const message = { payload: { mimeType: "text/plain", parts: [] }, id: id + history.latest, "label-ids": inbox ? ["INBOX", "UNREAD"] : ["UNREAD"], snippet: subject + " preview", headers: [{ name: "Subject", value: subject }, { name: "From", value: "Ravi <ravi@example.com>" }, { name: "Date", value: "2026-09-15T09:15:00Z" }] }
  thread.messages.push(message)
  writeFileSync(file, JSON.stringify(thread))
  history.records.push({ id: history.latest, "messages-added": [message.id], "messages-deleted": [], "labels-added": [], "labels-removed": [], "messages-added-details": [{ id: message.id, "thread-id": id, "label-ids": message["label-ids"] }] })
  writeFileSync(path.join(directory, "history.json"), JSON.stringify(history))
}
