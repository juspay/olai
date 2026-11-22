# Three example plugins you can copy

Three complete plugins, written out file by file. Copy any one into the directory olai serves, turn it on, and watch it run.[^how]

## A plugin that runs on a schedule

The morning agenda plugin reads your journal's agenda, which lists the rows that are overdue and the ones dated today. From 7 in the morning, by the clock of the machine olai runs on, it sends that list once a day into every conversation a node agent has open. A node agent is an agent that works on one row of an outline and the rows under it.[^agenda]

## A plugin that draws a colour on a row

The swatch plugin teaches olai a `hex` property kind, so a row that carries a property such as `swatch-hex: "#ff8800"` shows a small square of that colour beside it. A property is a key and a value on one line of an outline.[^swatch]

## A plugin that writes to your notes

The reading companion shows a book in French beside its English, one sentence per row. Click a French word and it becomes a row of your vocabulary. Open the **Vocabulary** row and it asks you the word due longest, and **Again**, **Good** or **Easy** writes when you see it next.[^reader]

All three are written out below, step by step: writing each file, reading it on the plugin's page, and pressing **Turn on**.

[^how]: How a plugin is written, approved and checked is explained in [dynamic-plugins.md](dynamic-plugins.md). This page shows the three plugins end to end instead.

[^agenda]: The morning agenda has no browser file, because it draws nothing on screen: it is two files, a `README.md` and a `server.ts`. It does not ship with olai, so you get one by asking your agent to write it into your directory, or by copying the code on this page.

[^swatch]: The swatch is three files, and both code files declare the same `name`, which has to be the folder's name. On a row the property key is `swatch-hex`: the plugin contributes the bare word `hex`, and olai puts the plugin's own name in front of it.

[^reader]: The reading companion is a README and seven code files, one of them in a folder of its own. Its writes go through the same checks as your typing, so each one shows in the commit panel. Switch it off and all it drew goes with it.

<details>
<summary>The three plugins, file by file</summary>

<!-- guide:start -->

## The morning agenda

A plugin that reads your journal's agenda each morning and puts it into the conversation of every node agent. It uses the agenda the journal plugin offers, reads the time from the server's clock, and sends a message it writes itself.

### 1. Ask which services you may use

Call `vault-plugins_inspect`. It lists the services, and says for each one whether it belongs to a plugin's server file or its browser file. A server service appears while the plugin offering it is running, and a browser service appears because a server file has declared it.

```
"services": [
  { "key": "clock", "half": "server", "availability": "core" },
  { "key": "journal.agenda", "half": "server", "availability": "provided" },
  { "key": "identity.viewer", "half": "browser", "availability": "declared" },
  …
]
```

`journal.agenda` is the service the journal plugin offers ([plugins/journal.md](plugins/journal.md)). Naming it in `needs` is all you have to do: your plugin waits while the journal is switched off, and says so on its row, starts when the journal comes back, and unloads if the journal goes away.

### 2. Make the folder

Two files, because this plugin draws nothing on screen, and a plugin that draws nothing needs no browser file:

```
plugins/morning-agenda/
  README.md
  server.ts
```

`README.md` is what a person reads on the plugin's page:

```md
# Morning agenda

Puts what is overdue and what is on today into your agent's conversation, once each morning.
```

### 3. Write `server.ts`

Write each file with `vault-plugins_write`, which tells you in the same reply whether that file compiles. A plugin your directory defines cannot import `@olai/format`, so it writes out the fields it reads itself, and the journal's own types match them because they have the same shape. The service key names a dependency; it does not check that the shape is right.

`server.ts`:

```ts
import { Clock, definePlugin, Deliveries, serviceTag, Vault } from "@olai/plugin-api"
import { Effect, Schedule } from "effect"

// WHEN, and HOW OFTEN THIS LOOKS. Kept in the source rather than in a `Config`,
// which is a choice and not an oversight: a knob is a thing the owner can move
// without reading code again, and the hour somebody wants their morning at is
// exactly that. Left here, changing either is an EDIT — and an edit is a fresh
// approval.
//
// THE HOUR IS THE SERVER'S OWN, which is the machine olai is serving from and
// not the machine you are reading on: `Clock` answers an instant and `Date`
// turns it into local time where the process runs. For a vault you serve on
// your own laptop those are the same place. For one you reach from another
// zone they are not, and seven o'clock means seven where the serve is.
const AT_HOUR = 7
const EVERY = "5 minutes"

// What `journal.agenda` answers, in the fields this plugin reads.
interface Row { readonly title: string }
interface Group { readonly file: string; readonly nodes: ReadonlyArray<Row> }
interface Day { readonly date: string; readonly groups: ReadonlyArray<Group> }
interface Answer {
  readonly date: string
  readonly dated: ReadonlyArray<Group>
  readonly agenda: { readonly overdue: ReadonlyArray<Day> }
}

const Agenda = serviceTag<{
  readonly read: (
    ask: { readonly at: unknown; readonly date: string },
  ) => Effect.Effect<Answer, { readonly reason: string }>
}>("journal.agenda")

const two = (value: number): string => String(value).padStart(2, "0")

// THE WORDS ARE THE PLUGIN'S, whole, and they say who is speaking: a
// conversation resumed from the agent's own store rebuilds its rows out of
// message chunks and core's mark is not among them, so a body that did not name
// its author would be put in the person's mouth on replay.
const words = (answer: Answer): string | null => {
  const late = answer.agenda.overdue.flatMap((day) =>
    day.groups.flatMap((group) =>
      group.nodes.map((row) => `- ${row.title} — owed ${day.date}, in ${group.file}`)
    )
  )
  const on = answer.dated.flatMap((group) =>
    group.nodes.map((row) => `- ${row.title}, in ${group.file}`)
  )
  if (late.length === 0 && on.length === 0) return null
  return [
    `Morning agenda for ${answer.date}, from your journal.`,
    ...(late.length === 0 ? [] : ["", "Overdue:", ...late]),
    ...(on.length === 0 ? [] : ["", "On today:", ...on]),
  ].join("\n")
}

export default definePlugin({
  name: "morning-agenda",
  needs: [Agenda, Clock, Deliveries, Vault],
  apply: Effect.gen(function*() {
    const agenda = yield* Agenda
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const vault = yield* Vault

    // The reading every answer will be about, kept as the vault publishes it
    // and handed back unchanged. This plugin never looks inside it.
    let at: unknown
    yield* vault.revision((snapshot: { readonly value: unknown }) =>
      Effect.sync(() => {
        at = snapshot.value
      })
    )
    yield* vault.unloaded(Effect.sync(() => {
      at = undefined
    }))

    // The day already spoken for, so a morning is one message rather than one
    // per tick.
    let said: string | null = null

    const consider = Effect.gen(function*() {
      const now = new Date(clock.now())
      const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
      if (at === undefined || day === said || now.getHours() < AT_HOUR) return
      // Every node agent with a live session, derived from its own subtree —
      // nobody has to pick a file for one.
      const scopes = deliveries.scopes()
      if (scopes.length === 0) return
      const answer = yield* Effect.catch(
        agenda.read({ at, date: day }),
        () => Effect.succeed(null),
      )
      if (answer === null) return
      const body = words(answer)
      if (body === null) return
      for (const scope of scopes) {
        yield* deliveries.deliver(scope, () => body)
      }
      said = day
    })

    yield* Effect.forkScoped(Effect.repeat(consider, Schedule.spaced(EVERY)))
  }),
})
```

### 4. Turn it on, and read what happens

Call `vault-plugins_run` once the folder is complete: that call is what tells the person the plugin is ready. They open its page at `/plugins/morning-agenda`, read it, and press **Turn on**.

- From seven in the morning, by the clock of the machine olai is served from, every node agent with a session running is sent one message listing what is overdue and what is dated today ([node-agents.md](node-agents.md)).
- A morning nobody was there for is not counted as done: `said` is set only after a message went out, so if no conversation was open at seven, the plugin still sends the message when one is opened.
- `deliveries.deliver` takes a function rather than a string, so the text is built at the moment it enters the conversation. The message may wait while the agent finishes a turn, so that moment is the only one at which the text is still accurate.
- The repeating check runs on the plugin's own scope, so switching the plugin off interrupts it along with everything else the plugin is holding. There is no timer to clear.
- None of this ships with olai: you get a morning agenda by asking your own agent to write it into your directory, or by copying the code here.

## A coloured square beside a colour

A plugin that draws a small coloured square next to a `hex` property. The first example acts on a schedule; this one draws on screen, which is the other thing a plugin can do.

### 1. Make the folder

```
plugins/swatch/
  README.md
  server.ts
  browser.tsx
```

Both code files declare the same `name`, and it has to be the folder's own name. A server file that declares a different name makes the plugin fail with a sentence naming both. A browser file that does is not loaded: the plugin's row in the **Plugins** panel says **Failed in this tab**, with a sentence naming both names.

### 2. Write `server.ts`, which teaches olai the property kind

`server.ts`:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "swatch",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({ kind: "hex", takes: "text", admits: (value) => /^#[0-9a-f]{6}$/i.test(value) })
  }),
})
```

### 3. Write `browser.tsx`, which draws the coloured square

`browser.tsx`:

```tsx
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

const Swatch = (context: { readonly entry: { readonly value: string } }) => (
  <span style={{ background: context.entry.value }} class="inline-block h-3 w-3 rounded" />
)

export default definePlugin({
  name: "swatch",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", "hex", Swatch)
  }),
})
```

A component a plugin draws is given a context object, not a bare value. `outline.row.chip`, the place on a row where the square is drawn, passes a context with `entry`, holding the property's `key`, `value` and `values`, plus `opened`, `onToggle` and `chrome`. The colour you draw is `context.entry.value`.

> A component that reads `props.value` gets `undefined`, and fails in the quietest way there is: it compiles, it is drawn, the plugin's row says `running`, and the square is invisible. `vault-plugins_inspect` lists the places a plugin can draw, and what each one passes.

### 4. Turn it on, and put a colour on a row

Read the files on the plugin's page and press **Turn on**. The browser file's code loads without a reload, so the squares appear while you watch.

- The property kind is called `swatch-hex`: the plugin contributes the bare word `hex`, and olai puts the plugin's own name in front of it, exactly as it does for a built-in plugin.
- Registering the kind claims that name, so a property `swatch-hex: "#ff8800"` is checked against the pattern and shows the coloured square, with no `_olai/Properties.olai` file in your directory at all.
- What you cannot do is declare the kind yourself. A `type` in `_olai/Properties.olai` is checked against the kinds the binary was built with, so `{"title":"colour","custom":{"type":"swatch-hex"}}` is refused. Use `swatch-hex` as the property key instead.

## A reading companion that writes to your vocabulary

`reader` is a companion for reading a book in French. Each sentence of the book is a row of `book.olai` whose `reader-pair` property holds the French, ` | `, and the English, and the plugin draws the two side by side under the row. Each French word is a button that adds it to `vocabulary.olai`, and the page of the vocabulary's top row asks you, at its foot, the word that has been due longest.

It also adds a **Reading** section to the sidebar, a key that opens the vocabulary, and a palette row that opens the book, as [dynamic-plugins-faces.md](dynamic-plugins-faces.md) shows.

### 1. Make the folder

It is seven code files, and each file imports the ones it needs by a relative path:

```
plugins/reader/
  README.md
  server.ts      the reader-pair property kind, the .reader file kind, and the calls
  browser.tsx    everything it draws
  words.ts       the calls the browser file may make, imported by both entries
  columns.tsx    the two columns, imported by browser.tsx
  pairs.ts       reading reader-pair values, imported by both entries
  types.ts       the shapes both entries agree on
  lib/sm2.ts     when a word is next due, imported by server.ts
```

`vocabulary.olai` has to exist with a root row whose id is `vocabulary`, since each new word is added under it.

### 2. Write the files both entries import

`types.ts`:

```ts
// The shapes both halves of the reader agree on.

/** One sentence of the book and its translation. */
export interface Pair {
  readonly french: string
  readonly english: string
}

/** How hard a word was to recall, as the review's three buttons say it. */
export type Grade = "again" | "good" | "easy"

/** A word being learnt, and when it is next due. */
export interface Card {
  readonly word: string
  readonly due: string
  readonly interval: number
  readonly ease: number
}
```

`pairs.ts`:

```ts
import type { Pair } from "./types.ts"

/** A `reader-pair` value is the French sentence, ` | `, and its English. */
export const splitPair = (value: string): Pair | null => {
  const cut = value.indexOf(" | ")
  if (cut <= 0 || cut + 3 >= value.length) return null
  return { french: value.slice(0, cut).trim(), english: value.slice(cut + 3).trim() }
}

/** A text of such lines, a page or a block in a note: the lines that are pairs. */
export const pairsIn = (text: string): ReadonlyArray<Pair> =>
  text.split("\n").flatMap((line) => {
    const pair = splitPair(line)
    return pair === null ? [] : [pair]
  })
```

`words.ts` is the surface: the three calls the browser file may make, what each takes and what it answers, and who may make them.

`words.ts`:

```ts
import { defineSurface, OpFailure } from "@olai/plugin-api"
import { Schema } from "effect"

// What the browser file may ask the server file. Both import this one value:
// the server file answers it, and the browser file calls it. A call the gate
// refuses fails with the gate's own `OpFailure`, sentence and all.
export const surface = defineSurface({
  procedures: {
    words: {
      add: { input: Schema.Struct({ word: Schema.String }), output: Schema.Struct({}), error: OpFailure },
      next: {
        input: Schema.Struct({}),
        output: Schema.NullOr(Schema.Struct({ node: Schema.String, word: Schema.String })),
        error: OpFailure,
      },
      grade: {
        input: Schema.Struct({ node: Schema.String, grade: Schema.Literals(["again", "good", "easy"]) }),
        output: Schema.Struct({ due: Schema.String }),
        error: OpFailure,
      },
    },
    pages: {
      // A transcribed page's text, as the vault holds it now.
      read: { input: Schema.Struct({ file: Schema.String }), output: Schema.Struct({ text: Schema.String }), error: OpFailure },
    },
  },
})

// Who may call each one: the page in your browser, and not your agents.
export const faces = {
  browser: { "words.add": "tool", "words.next": "tool", "words.grade": "tool", "pages.read": "tool" },
} as const

// The calls that write. The transport hands each of these the caller's own
// writer and session rule, and the server file passes them to the gate.
export const writes = ["surface/words/add", "surface/words/grade"]
```

### 3. Write `server.ts`, which answers the calls and writes through the gate

`lib/sm2.ts`:

```ts
import type { Card, Grade } from "../types.ts"

const DAY = 24 * 60 * 60 * 1000

/** The day `days` after `from`, both as `YYYY-MM-DD`. */
const after = (from: string, days: number): string =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

/**
 * When a word is next due, by the SM-2 rule: a word you missed comes back
 * tomorrow, and one you knew comes back after a gap that grows each time.
 */
export const scheduled = (card: Card, grade: Grade, today: string): Card => {
  if (grade === "again") return { ...card, interval: 1, due: after(today, 1) }
  const ease = Math.max(1.3, card.ease + (grade === "easy" ? 0.15 : 0))
  const interval = card.interval <= 1 ? (grade === "easy" ? 4 : 2) : Math.round(card.interval * ease)
  return { ...card, ease, interval, due: after(today, interval) }
}
```

`server.ts`:

```ts
import {
  Clock,
  definePlugin,
  FileKinds,
  type ImplementSurfaceDeps,
  Kinds,
  Ops,
  RequestAuthority,
  Surfaces,
  type WriteRequest,
} from "@olai/plugin-api"
import { Effect } from "effect"

import { scheduled } from "./lib/sm2.ts"
import { splitPair } from "./pairs.ts"
import type { Card } from "./types.ts"
import { faces, surface, writes } from "./words.ts"

const VOCABULARY = "vocabulary.olai"

// A word's card, read off the properties of its row.
const cardOf = (word: string, custom: Readonly<Record<string, unknown>>, today: string): Card => ({
  word,
  due: typeof custom["reader-due"] === "string" ? custom["reader-due"] : today,
  interval: Number(custom["reader-interval"] ?? 0),
  ease: Number(custom["reader-ease"] ?? 2.5),
})

export default definePlugin({
  name: "reader",
  needs: [Clock, FileKinds, Kinds, Ops, Surfaces],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({
      kind: "pair",
      takes: "`reader-pair`: a French sentence, ` | `, and its English",
      admits: (value: string) => splitPair(value) !== null,
    })

    // A `.reader` file is a transcribed page: one sentence and its English per
    // line. The vault keeps its text (`kept`), and reads none of it as prose
    // (`opaque`), so it is this plugin's to draw.
    yield* (yield* FileKinds).register({
      exts: [".reader"],
      holds: "text",
      kept: true,
      opaque: true,
      fetched: false,
      noun: "transcribed page",
      article: "a",
    })

    // Today, the way the vocabulary writes dates, by the serve's clock.
    const clock = yield* Clock
    const today = (): string => clock.now().slice(0, 10)

    // The write gate: every write below goes through it, exactly as a
    // keystroke's does, and lands in the ledger beside it. A refusal is the
    // call's failure, and the browser file shows its sentence.
    const gate = (yield* Ops).gate
    // ...as whoever made the call: the transport hands a member listed in
    // `writes` its caller's writer and session rule.
    const write = (request: WriteRequest) =>
      Effect.gen(function*() {
        const caller = yield* RequestAuthority
        return yield* gate.run(request, caller.writer, caller.rule)
      })

    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      procedures: {
        words: {
          // A clicked word becomes a row of the vocabulary, due today.
          add: ({ input }) =>
            write({
              op: "add",
              parent: "vocabulary",
              title: input.word,
              props: { "reader-due": today(), "reader-interval": "0", "reader-ease": "2.5" },
            }).pipe(Effect.as({})),
          // The word that has been due longest, or nothing.
          next: () =>
            Effect.gen(function*() {
              const reading = yield* gate.read
              const due = reading.derived.nodes.flatMap((at) => {
                const custom: Readonly<Record<string, unknown>> = "custom" in at.node ? at.node.custom ?? {} : {}
                const when = custom["reader-due"]
                return at.file === VOCABULARY && typeof when === "string" && when <= today()
                  ? [{ node: at.node.id, word: "title" in at.node ? at.node.title : "", when }]
                  : []
              })
              const first = due.sort((a, b) => a.when.localeCompare(b.when))[0]
              return first === undefined ? null : { node: first.node, word: first.word }
            }),
          // Again, Good or Easy: the next due date, written on the word's row.
          grade: ({ input }) =>
            Effect.gen(function*() {
              const reading = yield* gate.read
              const at = reading.derived.byId.get(input.node)
              const custom: Readonly<Record<string, unknown>> = at !== undefined && "custom" in at.node ? at.node.custom ?? {} : {}
              const title = at !== undefined && "title" in at.node ? at.node.title : ""
              const next = scheduled(cardOf(title, custom, today()), input.grade, today())
              const props: Readonly<Record<string, string>> = {
                "reader-due": next.due,
                "reader-interval": String(next.interval),
                "reader-ease": String(next.ease),
              }
              // The gate refuses a write that changes nothing, and one refusal
              // stops the whole batch, so only the properties that moved go in.
              const ops = Object.entries(props)
                .filter(([key, value]) => custom[key] !== value)
                .map(([key, value]) => ({ op: "prop" as const, id: input.node, key, value }))
              if (ops.length > 0) yield* write({ op: "apply", ops })
              return { due: next.due }
            }),
        },
        pages: {
          // The text of a transcribed page, as the gate last read the vault.
          read: ({ input }) =>
            Effect.gen(function*() {
              const reading = yield* gate.read
              const document = reading.set.documents.find((one) => one.path === input.file)
              return { text: document !== undefined && "body" in document ? document.body : "" }
            }),
        },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, writes, deps })
  }),
})
```

- `gate.read` answers the vault as the gate last read it: `derived.nodes` is every row with its file, and `derived.byId` finds one row by its id.
- `gate.run` takes the same write a keystroke makes. `write` passes it the writer and session rules of whoever made the call, which the transport hands a call listed in `writes`. Your own clicks are recorded as `web`, as your typing is.
- A refusal is the call's failure, an `OpFailure` with the gate's sentence; the surface declares it, so the browser file gets it typed.
- `{ op: "apply", ops }` writes several changes as one, or none of them. A change that sets a property to the value it already has is refused, so `grade` leaves out the ones that did not move.
- The date comes from `Clock`, the serve's clock.

### 4. Write `browser.tsx`, which draws and calls

`columns.tsx`:

```tsx
import { createSignal, For } from "solid-js"

import type { Pair } from "./types.ts"

/** A word as it is learnt: without the punctuation around it. */
const bare = (word: string): string => word.replace(/^[«"(]+|[.,;:!?»")]+$/g, "")

/**
 * A sentence and its translation side by side. Pointing at either half lights
 * both, so you can see which English goes with which French, and each French
 * word is a button that adds it to your vocabulary.
 */
export const Columns = (props: { readonly pair: Pair; readonly onWord: (word: string) => void }) => {
  const [lit, light] = createSignal(false)
  return (
    <div
      data-reader="columns"
      class="grid grid-cols-2 gap-4 py-1 text-body"
      onPointerEnter={() => light(true)}
      onPointerLeave={() => light(false)}
    >
      <p lang="fr" class={lit() ? "bg-doing/10" : ""}>
        <For each={props.pair.french.split(" ")}>
          {(word) => (
            <>
              <button type="button" data-reader="word" data-word={bare(word)} class="hover:underline" onClick={() => props.onWord(bare(word))}>
                {word}
              </button>{" "}
            </>
          )}
        </For>
      </p>
      <p lang="en" class={lit() ? "bg-doing/10" : ""}>{props.pair.english}</p>
    </div>
  )
}
```

`browser.tsx`:

```tsx
import { clientOf, definePlugin, Navigate, type OpFailure, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"

import { Columns } from "./columns.tsx"
import { pairsIn, splitPair } from "./pairs.ts"
import type { Grade } from "./types.ts"
import { surface } from "./words.ts"

// The tab dials this plugin's server file by the surface its browser file exports.
export { surface }

const BOOK = "/book.olai"
const VOCABULARY = "/vocabulary.olai"
const REVIEW = "/plugins/reader/app/review"

const Section = () => (
  <nav data-reader="section" class="flex flex-col px-3 py-2 text-body">
    <span class="text-label text-muted">Reading</span>
    <a href={BOOK}>The book</a>
    <a href={VOCABULARY}>Vocabulary</a>
    <a href={REVIEW}>Review</a>
  </nav>
)

// What the gate said when it refused a write, where the write was asked for.
const Refused = (props: { readonly said: string | null }) => (
  <Show when={props.said}>{(said) => <p data-reader="refused" class="text-label text-alarm">{said()}</p>}</Show>
)

export default definePlugin({
  name: "reader",
  needs: [Navigate, Slots, Wired],
  apply: Effect.gen(function*() {
    const navigate = yield* Navigate
    const slots = yield* Slots
    const wired = yield* Wired
    // This plugin's own server file, by the surface both files share.
    const client = () => clientOf(surface, wired)?.procedures

    // Runs one call: `then` gets the answer, and a refusal's sentence goes to
    // `refused`, which a face draws beside what was pressed.
    const ask = <A,>(
      call: Effect.Effect<A, OpFailure> | undefined,
      then: (answer: A) => void,
      refused: (said: string | null) => void,
    ) => {
      if (call === undefined) return
      void Effect.runPromise(Effect.match(call, {
        onFailure: (failure) => refused(failure.message),
        onSuccess: (answer) => { refused(null); then(answer) },
      }))
    }

    // A `reader-pair` property, drawn under its row as two columns.
    const Pair = (context: { readonly entry: { readonly value: string } }) => {
      const pair = splitPair(context.entry.value)
      const [refused, setRefused] = createSignal<string | null>(null)
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return pair === null ? null : (
        <>
          <Columns pair={pair} onWord={add} />
          <Refused said={refused()} />
        </>
      )
    }

    // The word due longest, and three buttons.
    const Review = () => {
      const [card, setCard] = createSignal<{ readonly node: string; readonly word: string } | null>(null)
      const [refused, setRefused] = createSignal<string | null>(null)
      const load = () => ask(client()?.words.next({}), setCard, setRefused)
      const grade = (node: string, value: Grade) => ask(client()?.words.grade({ node, grade: value }), load, setRefused)
      onMount(load)
      return (
        <>
          <Show when={card()}>
            {(due) => (
              <div data-reader="review" data-word={due().word} class="flex items-center gap-2 py-2 text-body">
                <span class="font-medium">{due().word}</span>
                <button type="button" data-grade="again" onClick={() => grade(due().node, "again")}>Again</button>
                <button type="button" data-grade="good" onClick={() => grade(due().node, "good")}>Good</button>
                <button type="button" data-grade="easy" onClick={() => grade(due().node, "easy")}>Easy</button>
              </div>
            )}
          </Show>
          <Refused said={refused()} />
        </>
      )
    }

    // At the foot of the vocabulary row's own page, the review.
    const Foot = (props: { readonly node: string }) => (
      <Show when={props.node === "vocabulary"}><Review /></Show>
    )

    // The plugin's own page: `/plugins/reader/app`, and the review under it.
    const Own = (props: { readonly rest: string }) => (
      <section data-reader="app" data-rest={props.rest} class="flex flex-col gap-2 p-4 text-body">
        <h1 class="text-title">Reading</h1>
        <Show when={props.rest === "review"} fallback={<a href={REVIEW}>Start review</a>}>
          <Review />
        </Show>
      </section>
    )

    // A transcribed page, drawn whole: each line's French beside its English.
    // `revision` moves when the file does, and the text is read again; a read
    // still in flight for an older revision is called off, so it cannot land
    // after the newer one.
    const Transcribed = (props: { readonly file: string; readonly revision: number | undefined }) => {
      const [text, setText] = createSignal("")
      const [refused, setRefused] = createSignal<string | null>(null)
      createEffect(on(() => [props.file, props.revision], () => {
        const call = client()?.pages.read({ file: props.file })
        if (call === undefined) return
        const controller = new AbortController()
        onCleanup(() => controller.abort())
        void Effect.runPromise(Effect.match(call, {
          onFailure: (failure) => ({ refused: failure.message }),
          onSuccess: (read) => ({ text: read.text }),
        }), { signal: controller.signal }).then(
          (answer) => {
            if (controller.signal.aborted) return
            if ("text" in answer) { setRefused(null); setText(answer.text) } else setRefused(answer.refused)
          },
          // Called off: a newer revision is being read.
          () => {},
        )
      }))
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return (
        <section data-reader="file" data-file={props.file} class="flex flex-col p-4">
          <For each={pairsIn(text())}>{(pair) => <Columns pair={pair} onWord={add} />}</For>
          <Refused said={refused()} />
        </section>
      )
    }

    // A block in any Markdown note whose fence names `reader`: its lines, drawn
    // the same way. The block is handed its text exactly as written in the note.
    const Block = (props: { readonly text: string; readonly file: string }) => {
      const [refused, setRefused] = createSignal<string | null>(null)
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return (
        <section data-reader="block" data-file={props.file} class="flex flex-col py-2">
          <For each={pairsIn(props.text)}>{(pair) => <Columns pair={pair} onWord={add} />}</For>
          <Refused said={refused()} />
        </section>
      )
    }

    // Above every Markdown note's text: whose face this is.
    const NoteHead = (props: { readonly file: string }) => (
      <p data-reader="note-head" data-file={props.file} class="text-label text-muted">Reading companion</p>
    )

    // Under every Markdown note: the way back to the review.
    const Note = (props: { readonly file: string }) => (
      <p data-reader="note" data-file={props.file} class="text-body">
        <a href={REVIEW}>Review the words from your reading</a>
      </p>
    )

    yield* slots.register("sidebar.section", { said: "Reading", body: Section })
    yield* slots.register("app.keys", {
      key: "y",
      shift: true,
      whileEditing: false,
      said: "Open your vocabulary",
      press: () => navigate.open(VOCABULARY),
    })
    yield* slots.register("app.palette", {
      id: "reader-book",
      label: "Open the book you are reading",
      search: "reader book french read",
      href: BOOK,
    })
    yield* slots.register("outline.row.block", "pair", Pair)
    yield* slots.register("outline.page.foot", Foot)
    yield* slots.register("plugin.page", Own)
    yield* slots.register("app.command", {
      id: "reader-review",
      label: "Start review",
      search: "reader review start words vocabulary",
      run: () => navigate.open(REVIEW),
      chord: { key: "e", shift: true, whileEditing: false },
    })
    yield* slots.register("file.page", Transcribed)
    yield* slots.register("document.page.head", NoteHead)
    yield* slots.register("document.page.foot", Note)
    yield* slots.register("document.block", Block)
  }),
})
```

- `export { surface }` is what connects the tab to the plugin's server file. Without it `clientOf` answers `null`, so no call is made and nothing is written.
- `pairs.ts`, `types.ts` and `words.ts` are imported by both entries. Each entry builds its own copy, so in each it reaches the services of the entry that imported it.
- `outline.page.foot` is drawn at the foot of every row's own page, the page you open by zooming into a row, and not on a whole file's page. So `Foot` checks `props.node` and draws the review only on the page of the row whose id is `vocabulary`.
- `Own` is the plugin's own page, drawn at `/plugins/reader/app` and handed what follows it, so `/plugins/reader/app/review` is the review. **Start review** in the palette, `Cmd` + `Shift` + `E` and the sidebar's **Review** link all open it.
- `Block` is drawn in place of each fenced block in a Markdown note whose language is `reader`, handed the block's text as written. On the plugin's own page, and anywhere else that is not the note's page, such a block is code.

### 5. Turn it on, and click a word

Read the files on the plugin's page and press **Turn on**. The columns appear under each sentence of `book.olai`.

- Click a French word and a row with that word appears in `vocabulary.olai`, due today, and the commit panel lists the file as changed.
- Open the **Vocabulary** row, the top row of `vocabulary.olai`, and the foot of its page shows the word due longest. **Again** makes it due tomorrow; **Good** and **Easy** push it further out.
- The same review is a page of its own at `/plugins/reader/app/review`, and a reload draws it again.
- A `.reader` file, one French sentence and its English per line, is listed under **Reference** and opens as the same two columns. Change it on disk and its page is drawn again.
- Every Markdown note says **Reading companion** above its text and has a link to the review at its foot.
- In a Markdown note, a fenced block whose language is `reader`, one sentence and its English per line, is drawn as the same two columns. Change the note on disk and the block is drawn again.
- A word the gate will not add, because the vocabulary has no row called `vocabulary` to add it under, shows the gate's sentence under the sentence you clicked it in, and nothing is written.
- Edit any of the seven code files and the plugin pauses until you turn the new version on. Its page's address then says it is paused and links to the page where you turn it on again.
- Switch it off and the columns, the review, the section, the key, the palette rows, the page and the note's link go together, and a `reader` block in a note is code again. The `words.*` and `pages.*` calls leave the connection, and while it is off olai cannot open `.reader` files.
<!-- guide:end -->

</details>
