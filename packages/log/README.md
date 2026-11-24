# @olai/log — how olai says what it is doing

Three decisions and no logger. The levels and the verbs are Effect's own, so a package with something to say imports nothing from here:

```ts
yield* Effect.logInfo("serving")
yield* Effect.logWarning("olai store: probe failed", cause)
```

What this package owns is what a logging seam is otherwise re-decided at, once per caller.

| file | what it owns |
|---|---|
| `sinks.ts` | two streams and which face each line wears — stdout for `olai web`, stderr for a process whose stdout is already spoken for; pretty on a TTY, logfmt everywhere a machine reads |
| `level.ts` | a serve-owned live level and presentation, supplied by the composition root |
| `cause.ts` | what a failure says, in the two lengths anything wants it: `prettyCause` for a log, `reasonOf` for a sentence somebody reads |
| `emit.ts` | `emitter` and `emitterOf`: how a plain Node callback, or one handed a fiber, emits a line without losing that fiber's level, annotations and spans |
| `link.ts` | the vocabulary of a browser tab's connection diary, on the `./link` subpath: its events, the closed set of drop causes, close codes, the loop rule, and `describe`, which says how each entry reads |
| `lines.testlib.ts` | how a TEST hears a line, on the `./testlib` subpath: the collecting logger inside the process, the logfmt decoder outside it |

## Levels

Effect's, used the way [kolu's own logger](https://github.com/juspay/kolu) documents them:

| level | for |
|---|---|
| `logDebug` | what an operator wants only when they are looking — a relayed agent stderr chunk, a tab closed at the handshake |
| `logInfo` | lifecycle: the address bound, the agent started, the reason there is no agent |
| `logWarning` | degraded but recoverable — bound off loopback, a connection that failed, a boot the next prompt will retry |
| `logError` | a failure something stops for |

**Quiet by default.** The serve starts at `info`. Its composition root follows `log-level` and `log-format` on the `olai` node in the shared settings file and updates the live logging layer. Existing fibers and callback emitters consult that layer when emitting; changing logging does not restart their resources. The scoped owner supplies both the sinks and the live presentation getter. Log level and format are not read from environment variables; `NO_COLOR` remains the terminal colour convention or global mutable state.

## The format

**Two faces, one decision point.** The sink picks the face from the destination stream (and an optional override) — call sites still say only `toStdout` or `toStderr`.

| when | face |
|---|---|
| destination is a TTY | **pretty** — Effect's `formatStructured` composed with `Logger.map`: local time, coloured level, message and inline key=values |
| piped / systemd / tests | **logfmt** — byte-identical to Effect's `formatLogFmt`, what it always was |
| `log-format: pretty` or `log-format: logfmt` | that face, regardless of the TTY |

Pretty is for a human watching a terminal. Logfmt is for everything that parses a line — the `@olai/log` testlib decoder, the e2e suite reading the bound address off stdout, any agent grepping `url=`. Pretty may only exist where no machine reads; colour and abbreviated terminal fields would break those readers.

Colour follows the **destination** stream (stdout for `toStdout`, stderr for `toStderr`), not always stdout — otherwise a stderr sink would never colour, since its stdout is the protocol pipe. `NO_COLOR` (set and non-empty) turns colour off on a TTY.

### logfmt (machines)

One line per event, `key=value`, quoted only where it has to be:

```
timestamp=2026-08-10T17:45:36.770Z level=INFO fiber=#5 message=serving root=/home/you/outlines url=http://127.0.0.1:7714
timestamp=2026-08-10T17:45:36.812Z level=WARN fiber=#8 message="the agent is running a model its picker does not offer" root=/home/you/outlines agent=claude-code-acp model=opus-5
```

The message is a short, stable sentence; every value that varies is an annotation. That is what makes a line greppable by field rather than by substring — `url=` is the address, wherever the message went — and it is why a relayed multi-line agent message is still ONE line: the value is escaped, not wrapped.

Use `Effect.withLogSpan` only around bounded operations; the server lifetime is not an operation duration. Annotations set with `Effect.annotateLogsScoped` (`root=`) are inherited by everything forked under that scope, which is how the store's own probe warning ends up saying which directory it was probing.

### pretty (humans)

Same event on a TTY looks more like:

```
13:45:36 INFO  serving root=/home/you/outlines url=http://127.0.0.1:7714
```

Routine events occupy one line; errors retain Effect-rendered causes on indented lines. The terminal omits fiber IDs and empty fields, abbreviates UUID session IDs to eight characters, and shows the root when it changes (always for warnings, errors and debug events). Machine logs retain full annotations. Agent names and readiness are info events; executable paths, arguments and successful tool probes are debug diagnostics.

Force either face when the auto pick is wrong (a TTY you want to pipe from, or a non-TTY you still want to read):

```sh
# Set log-format: logfmt on the olai node to keep logfmt on a TTY
# Set log-format: pretty there for pretty output even when redirected
NO_COLOR=1 olai web ~/outlines            # pretty layout, no ANSI
```

## Two lengths for a failure

An Effect `Cause` renders through neither `.message` nor a template literal, so a failure nobody rendered deliberately is a failure nobody could read. Both renderings live in `cause.ts` because the choice between them is a real one:

| | for | keeps |
|---|---|---|
| `prettyCause` | a log line | every reason in the cause, and the stack — a newline in a logfmt value is escaped, not wrapped |
| `reasonOf` | a sentence a person reads: a tagged error's `message`, a notice in the chat panel | one line, squashed to the one failure that can be named |

Interpolating the first where the second belongs answers a question nobody asked with a trace of our own call site; using neither is how `cannot listen on …: [object Object]` happens.

## Hearing a line in a test

```ts
import { collector, findSaid } from "@olai/log/testlib"

const { layer, said } = collector()
await Effect.runPromise(somethingThatLogs.pipe(Effect.provide(layer)))
expect(findSaid(said, "serving")?.annotations.url).toBe(…)
```

It collects the PIECES — level, message, annotations — rather than a rendered line, so a test says what it means and does not fail on a change to a format it does not care about. On a `./testlib` subpath rather than the main entry for the same reason `@olai/format`'s fixtures are: it is not product.

A test that SPAWNED the binary has no layer to install, so what it reads is the format itself — which makes the decoder the other half of a contract this package already owns the encoder for, and it ships beside the collector rather than as a regex in each suite:

```ts
import { findLogfmt } from "@olai/log/testlib"

const url = findLogfmt(serverStdout, "serving")?.url
```

It matches the message exactly (two of this server's lines carry a `url=`), unquotes what the encoder quoted, and simply does not match a half-written trailing line — a chunk that has not yet ended in `\n` is still arriving, even when `message=` already looks right. `lines.test.ts` holds it against lines `formatLogFmt` actually produced, so the pair cannot drift.

## Logging from a callback

Half of what a server has to say happens in a Node callback — a websocket that hung up, a promise the surface runtime rejected, a subprocess writing to its stderr. There is no fiber there, and `Effect.runFork` would emit the line against the defaults: the operator's the live minimum level would silently not apply to the noisiest half of the program.

So capture the services once, where there IS a fiber, and run every later line under them. Annotate first, then take the emitter — the capture reads what is in force at that point:

```ts
const say = yield* Effect.annotateLogs(emitter, { agent: command })
child.stderr.on("data", (chunk: string) => say(Effect.logDebug(chunk.trimEnd())))
```

Some callbacks are handed the fiber they speak for instead of running in it — an Effect `ErrorReporter` is told which fiber's call failed. `emitterOf(fiber)` makes the same capture from that fiber's services, so the line carries that fiber's level, format and annotations. It is how a connection's failed calls are logged with the connection named (`@olai/server`'s `report.ts`).

## The connection's diary: `./link`

A browser tab keeps a diary of its socket — dialled, opened, dropped and why, the connection-lost card going up and down — and posts it to the server, which logs each entry with `side=browser` beside its own `tab connected` / `tab disconnected` lines. Both ends speak one vocabulary, and it lives here, on its own door, because the root door loads the sinks and the sinks read `process.stdout`, which a browser does not have. `./link` imports `effect` and nothing else.

| export | what it is |
|---|---|
| `LinkEvent`, `Entry`, `Batch` | the diary as Effect `Schema`: one tagged event per thing that happens to the link, an entry placing it (`seq`, `at`, `dial`, `streak`), and the batch a tab posts. Every string has a length limit, so a refused or decoded body cannot grow a line without limit |
| `describe(entry)` | how an entry reads: its level, a short stable sentence (`wire dropped`, `dial did not open`, `heartbeat gave up`, …) and its fields. A `switch` over the event's tag with no default arm, so an event nobody described is a compile error |
| `Cause` | why an opened socket ended, a closed set: `peer-closed`, `frame-over-cap`, `half-open`, `roster-refresh`, `redial`, `unload`, `severed`. The tab picks it from typed facts, never from an error's text |
| `closeMeans(code)` | what a WebSocket close code means, in a word or two, for both ends |
| `nextStreak`, `loudAt` | the loop rule: consecutive dials that lived under a minute and dropped the same way make a streak, said in full for the first three and then every tenth, at `debug` otherwise |
| `stamped`, `stampOf` | the `tab` and `dial` a tab puts on its socket's URL, written and read in one place, so the server's lines about a socket can be joined to the tab's |

Fields are sizes, codes, counts, tags and subscription labels. No frame's content is ever an entry.

## Layering

Depends on `effect` and nothing else, at the bottom beside `format` and `store` ([website/docs/architecture/overview.md](../../website/docs/architecture/overview.md)). Everything above logs, so a workspace sibling here would put a package between a caller and the ability to say what it is doing.
