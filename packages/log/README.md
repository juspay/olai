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
| `cause.ts` | what a failure says, in the two lengths anything wants it: `prettyCause` for a log, `reasonOf` for a sentence somebody reads |
| `emit.ts` | `emitter`: how a plain Node callback emits a line without losing the fiber's level, annotations and spans |
| `lines.testlib.ts` | how a TEST hears a line, on the `./testlib` subpath: the collecting logger inside the process, the logfmt decoder outside it |

## Levels

Effect's, used the way [kolu's own logger](https://github.com/juspay/kolu) documents them:

| level | for |
|---|---|
| `logDebug` | what an operator wants only when they are looking — a relayed agent stderr chunk, a tab closed at the handshake |
| `logInfo` | lifecycle: the address bound, the agent started, the reason there is no agent |
| `logWarning` | degraded but recoverable — bound off loopback, a connection that failed, a boot the next prompt will retry |
| `logError` | a failure something stops for |

**Quiet by default, and the switch is not ours.** Effect's minimum level is `Info`, so `logDebug` is off until asked for; `--log-level` is Effect's own CLI global flag — already parsed, already in `--help`, and already the thing that sets the minimum for the command it runs:

```sh
olai web ~/outlines --log-level debug
```

A second spelling (`--verbose`, `OLAI_LOG_LEVEL`) would be a second answer to one question, so there isn't one.

## The format

**Two faces, one decision point.** The sink picks the face from the destination stream (and an optional override) — call sites still say only `toStdout` or `toStderr`.

| when | face |
|---|---|
| destination is a TTY | **pretty** — Effect's `Logger.consolePretty`: local time, coloured level, message first, key=values after |
| piped / systemd / tests | **logfmt** — byte-identical to Effect's `formatLogFmt`, what it always was |
| `OLAI_LOG=pretty` or `OLAI_LOG=logfmt` | that face, regardless of the TTY |

Pretty is for a human watching a terminal. Logfmt is for everything that parses a line — the `@olai/log` testlib decoder, the e2e suite reading the bound address off stdout, any agent grepping `url=`. Pretty may only exist where no machine reads; colour and multi-line pretty layout would break those readers.

Colour follows the **destination** stream (stdout for `toStdout`, stderr for `toStderr`), not always stdout — otherwise a stderr sink would never colour, since its stdout is the protocol pipe. `NO_COLOR` (set and non-empty) turns colour off on a TTY.

### logfmt (machines)

One line per event, `key=value`, quoted only where it has to be:

```
timestamp=2026-08-10T17:45:36.770Z level=INFO fiber=#5 message=serving serve=12ms root=/home/you/outlines url=http://127.0.0.1:7714
timestamp=2026-08-10T17:45:36.812Z level=WARN fiber=#8 message="the agent is running a model its picker does not offer" serve=54ms root=/home/you/outlines agent=claude-code-acp model=opus-5
```

The message is a short, stable sentence; every value that varies is an annotation. That is what makes a line greppable by field rather than by substring — `url=` is the address, wherever the message went — and it is why a relayed multi-line agent message is still ONE line: the value is escaped, not wrapped.

`serve=12ms` is a log SPAN: `Effect.withLogSpan` around the boot, so every line emitted during it says how far in it was. Annotations set with `Effect.annotateLogsScoped` (`root=`) are inherited by everything forked under that scope, which is how the store's own probe warning ends up saying which directory it was probing.

### pretty (humans)

Same event on a TTY looks more like:

```
[13:45:36.770] INFO (#5) serve=12ms: serving
  root: /home/you/outlines
  url: http://127.0.0.1:7714
```

Force either face when the auto pick is wrong (a TTY you want to pipe from, or a non-TTY you still want to read):

```sh
OLAI_LOG=logfmt olai web ~/outlines | …   # keep logfmt on a TTY
OLAI_LOG=pretty olai web ~/outlines       # pretty even when redirected
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

It matches the message exactly (two of this server's lines carry a `url=`), unquotes what the encoder quoted, and simply does not match a half-written trailing line — which is what a test polling a spawned process's buffer needs. `lines.test.ts` holds it against lines `formatLogFmt` actually produced, so the pair cannot drift.

## Logging from a callback

Half of what a server has to say happens in a Node callback — a websocket that hung up, a promise the surface runtime rejected, a subprocess writing to its stderr. There is no fiber there, and `Effect.runFork` would emit the line against the defaults: the operator's `--log-level` would silently not apply to the noisiest half of the program.

So capture the services once, where there IS a fiber, and run every later line under them. Annotate first, then take the emitter — the capture reads what is in force at that point:

```ts
const say = yield* Effect.annotateLogs(emitter, { agent: command })
child.stderr.on("data", (chunk: string) => say(Effect.logDebug(chunk.trimEnd())))
```

## Layering

Depends on `effect` and nothing else, at the bottom beside `format` and `store` ([docs/architecture.md](../../docs/architecture.md)). Everything above logs, so a workspace sibling here would put a package between a caller and the ability to say what it is doing.
