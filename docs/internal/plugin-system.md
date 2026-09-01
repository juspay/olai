# The plugin system

*How olai integrates with tools that are not olai — and how it does that without
core learning any of their names.*

This page is for people working on olai. It is a tour, not a specification: the
authoritative arguments live in the code, mostly in
[`packages/plugin-api/src/plugin.ts`](../../packages/plugin-api/src/plugin.ts) and its
[README](../../packages/plugin-api/README.md). If you only read one thing, read
**Vocabulary** and **How a live property gets its face**.

---

## 1. The problem

olai talks to two things that are not olai:

- **kolu** — runs coding agents in terminals, and serves them over MCP.
- **odu** — runs CI.

Both were once "extracted into their own packages", and both left a residue
behind in the general ones:

| Where | What was there |
| --- | --- |
| `@olai/chat` | a `kolu.ts` |
| `@olai/server` | a `koluConfig.ts`, a `wiring.kolu` slot, a `koluHalf(…)` call |
| `@olai/surface` | four `...koluMembers` spreads in the middle of core's wire spec |
| `@olai/server`'s expose map | a row per plugin member |
| `@olai/web` | a `padi/` folder |
| four packages | one property key spelled at seven sites |

None of that was sloppy. It was olai's own **judgement about an appliance** —
what an absent padi means, which vault file is kolu's, which property wears which
face. What was missing was a *place to put a judgement about an appliance that is
neither the appliance nor the core*.

`packages/plugin-api/` is that place, and it is the only one — and the tenants that
stand on it live one directory over, in [`packages/plugins/`](../../packages/plugins/README.md).

> **The bar:** a general package may know a plugin's **name**. It may not know
> anything else about it — not a member, not a key, not a constructor.

---

## 2. The shape, in one breath

A plugin is a **value**. Its first field is a `name`; its second is a whole
`surface` of its own. Everything else is optional.

```ts
// packages/plugins/olai-plugin-odu/src/plugin.ts  (abridged)
export const plugin = {
  name,                                   // "odu"
  surface,                                // a whole surface, declared here
  faces,                                  // which face may see which member
  dressings: [{ kind: WORKTREE_KIND, Chip: CiChip, Pane: RunMatrix }],
  mount: OduMount,
} as const
```

Core never writes `: OlaiPlugin` on that object, and the plugin never imports
`@olai/plugin-api`. The registry imports every plugin, so a dependency back would be
a cycle. The fit is proved at the registry instead:

```ts
// packages/plugin-api/src/registry.ts
export const PLUGINS = [kolu, odu, spaces] as const satisfies ReadonlyArray<OlaiPlugin>
```

A plugin that stops fitting is a type error on **that line**, naming the plugin.

---

## 3. Vocabulary

Skim the table; the sections after it give one example each.

| Word | What it means |
| --- | --- |
| **plugin** | one value describing one integration |
| **name** | the plugin's one word — `"kolu"`, `"odu"`. Also the **sibling key** and the address of its docs page |
| **surface** | a whole `defineSurface(...)` contract, declared inside the plugin's package |
| **member** | one thing on a surface: a cell, a collection, a stream, a procedure |
| **face** | *who* may see which members — `browser`, `agent`. Default-deny |
| **probe** | "is this tool on this host?" — asked once per chat session |
| **kind** | a word a plugin teaches the vault's vocabulary. Contributed BARE (`terminal`) and composed by the registry with the plugin's name (`kolu-terminal`) |
| **claim** | the key a kind declares by convention — its own composed word, so enabling a plugin turns its faces on with no file to edit |
| **dressing** | what a live property *wears* in the browser: a chip, a pane, a block |
| **chrome** | what a plugin hangs in the app's header bar |
| **mount** | the plugin's own half of the tab — one subscription per tab |
| **mark** | the plugin's FACE — the glyph over a sentence it delivered into a conversation |
| **doorbell** (`deliveries`) | the write-only door a plugin speaks INTO a conversation through: which conversations opted in to it, and one verb that puts a whole sentence in one |
| **wake** | the plugin's own words for the control a person points that doorbell with — three pieces, and core composes none of them |
| **roster** | which plugins this build has, and which this serve runs |
| **built vs enabled** | what the binary carries vs what `--plugins` turned on |
| **licence** | permission for a face to draw, answered per drawn value |

### name

One word, and it does four jobs: the preferences row, the `--plugins` value, the
docs address (`docs/plugins/<name>.md`), and — the load-bearing one — the **wire
prefix**. Because the name *is* the prefix, the two cannot drift apart.

### surface and member

A plugin declares a surface the same way core does. odu declares one member:

```ts
export const surface = defineSurface({ cells: { ci: { /* … */ } } })
```

Core composes it as a **sibling** under the plugin's name, so it reaches the wire
as `surface/odu/ci/get`. Nothing in olai computed that string — the framework did,
out of the plugin's own name. See §5.

### face

Which members a caller may reach, written in the plugin's own package against its
own spec:

```ts
export const faces = { browser: { ci: "resource" } }
```

A face a plugin never mentions is **denied in full**. Neither plugin writes an
`agent` map today, so an MCP client can call none of their members — and that is
data, not a hardcoded rule. The day a plugin wants otherwise, it writes the map
and nothing in core changes.

### probe

*"Is your tool here, and if not, what should I tell the person?"* Asked before a
chat session starts, answered with **both halves at once**:

```ts
interface Probed {
  server: StdioServer | null   // the MCP server to hand a session
  missing: NotHere | null      // ...or the whole sentence about the one it did not get
}
```

Two fields, one reading, and that is an invariant with an incident behind it: a
caller that asked once for the server and again for the sentence would start
somebody's daemon **twice per conversation**, and could answer the two questions
about two different moments.

`missing.why` is a **whole sentence, written by the plugin**. Core displays it and
never composes it — the four ways a padi fails and the four ways a coordinator
does have nothing in common but that they failed, and a sentence built out of that
shared nothing is a debug line on a screen.

A plugin with no probe is a whole plugin. odu has none.

### kind

`@olai/format` owns seven property kinds — `text`, `date`, `int`, `path`, `doc`,
`ref`, `node` — and none of them is a terminal. So a plugin **contributes** one,
as a **bare word**:

```ts
export const kinds = [{
  kind: "worktree",                      // BARE — the registry prefixes it
  takes: `\`${WORKTREE_TYPE}\` (a path to a checkout, no whitespace)`,
  admits: isPathShaped,                  // does this value fit
}] as const
```

**The registry composes it with the plugin's name**, exactly as the framework
composes a member into a wire tag:

```
  a plugin contributes …    a vault declares …
  ─────────────────────     ────────────────────
  kolu:  terminal      →    kolu-terminal
  odu:   worktree      →    odu-worktree
```

That prefix buys two things. Two plugins cannot collide on a word, because two
plugin names cannot. And — the reason the human ruled it — **a plugin's built-in
declaration can only ever claim a key carrying its own name**, so enabling one
can never take over a column you have been using for something of your own.

### the two layers of a declaration

A key is declared by whichever of these speaks, and the first one wins:

```
  1. THE VAULT'S ROW        _olai/Properties.olai       ← always wins
  2. THE PLUGIN'S CLAIM     the kind's own word          ← where the vault said nothing
```

So an **enabled plugin declares its own key for you**. A lane carrying
`kolu-terminal 303dc985` gets the door with nothing declared anywhere, and
**olai never writes your vault** to make that true. Turning the plugin on is the
whole of turning the face on.

And a row of yours always beats it — which is how you move a kind onto a short
key, and how you take a face away again:

```jsonl
_olai/Properties.olai
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
```

Your key, the plugin's kind, your file.

The fold is **one function** (`@olai/format`'s `withClaims`) and precedence
exists nowhere else. It rides the **enabled** table, so a disabled plugin's
claims vanish with its kinds — no new rule needed for `--plugins`. And no
consumer learns there are two sources: the validator, the write gate, the
licence consult and the dressing table all keep taking *the declarations* as one
value.

**Why a kind and not the key's name.** `brief` and a checkout column are both
declared `path`, on the very same rows, and only one of them names a checkout to
dial a socket in. A shape cannot tell them apart. A declaration can.

`@olai/format` imports no plugin. The kind table travels **as data**, handed down
from the composition root, and the format's own union grows exactly one arm:

```ts
type PropType = … | { kind: "contributed"; word: string }
```

which keeps its five kind-enumerating places exhaustive. A contributed kind cannot
quietly stop being handled, because it is an arm the compiler counts.

### dressing

What a live property wears. Three optional faces, and each keeps its honest name:

```
        ┌─ a row of the outline ────────────────────────────────────┐
        │  implement + open PR                                      │
        │  ┌────────────┐ ┌───────────────────────┐                 │
  CHIP  │  │ agent grok │ │ worktree .worktrees/x │ ci · e2e 2:10 ◀─┼── draws in the
        │  └────────────┘ └───────────────────────┘                 │   run, beside
        │                                                           │   the value
  BLOCK │  ▸ ● claude · thinking · the terminal door  ◀──────────────┼── owns a row
        │                                                           │
  PANE  │  ┌───────────────────────────────────────┐                │
        │  │ (what the chip's press opened)        │  ◀─────────────┼── below the run
        │  └───────────────────────────────────────┘                │
        └───────────────────────────────────────────────────────────┘
```

A **block** owns a row always (a terminal somebody wrote down is worth a row even
when nothing is happening). A **chip** appears only while there is something to
say (a worktree with no CI running looks exactly as it did). A **pane** is what a
chip's press opens.

Crucially, a dressing draws **beside** the property's value and never instead of
it. The stored value is still a fact somebody greps and edits.

### chrome and mount

`chrome` is a slot in the header bar — kolu's padi pill. `mount` is the plugin's
own half of the tab: **one** subscription however many rows draw. Both are
components the plugin owns; the app hands them its own *furniture* (the clock, the
pill's geometry, a popover, a link to a served file) so a plugin never imports
`@olai/web`, which would be a cycle.

### mark

`mark` is the third browser hook and the smallest: the shapes drawn over a sentence
this plugin delivered into somebody's conversation. The chat panel names the
speaker of every run of messages — the person, the agent, or a plugin — and looks a
plugin's face up by the `rang` name core already stamped on the row.

It takes **no argument at all**, where `chrome` takes the furniture: a mark is a
glyph at the size of the line it sits on, so there is nothing for the app to hand
over. It answers with the SHAPES — a `<g>` of paths in a `0 0 16 16` box, drawn in
`currentColor` — and the app owns the `<svg>` around them, because the marks are
read as a column and a plugin that owned the size could make its row look unlike
every row around it.

It is a manifest field rather than a table in the panel for the fence's reason: no
general package spells a plugin's name in code (`fence.test.ts`, claim 8), so the
day a third tenant delivers a sentence it arrives wearing its own face and core is
not edited. A plugin that hangs none is drawn with a plain generic and named in
full — never another plugin's shape.

### doorbell and wake

The other direction. `probe` and `chrome` are the app asking a plugin something;
this is a plugin **saying something**, unprompted, into a conversation somebody is
having with an agent:

```ts
interface Deliveries {
  scopes: () => ReadonlyArray<{ agent: string; session: string; file: string }>
  deliver: (
    to: { agent: string; session: string },
    body: string,
    options?: { coalesce?: string },
  ) => void
}
```

Two members, and **`deliver` cannot read**. A plugin learns which conversations
opted in to *it* and nothing else — not who is in them, not what is in them, not
whether its own last sentence landed. The body goes down the same lane a person's
message goes down, so the row it lands in is a `user` row; core marks that row
with the plugin's name, stamped **from the registry binding and never from the
caller**, which is the difference between a mark and a signature one plugin could
put on another's words.

Core decides only *when*. An idle agent takes the sentence as a turn; a busy one
**holds** it until the turn ends, so that a machine can never spend the
interruption a person has not typed; a conversation nobody is in holds it until
somebody opens it. Which arm a body took is never reported back, because there is
no arm a plugin would answer differently.

**Who may be rung is a person's answer, and the strip is where they give it.**

> Scope is MANUAL per conversation. No serve-level default, no agent-settable op.
> A fresh or cleared conversation starts with the doorbell OFF until a person
> picks a file. *(ruled human, 2026-08-31)*

That control is `chrome`'s arrangement one floor along — a slot the app owns whose
CONTENT is the plugin's:

```ts
readonly wake?: {
  subject: string                          // "wake on terminal activity"
  from: string                             // "terminals from"
  waiting: { one: string; many: string }   // "fleet event waiting" / "…events waiting"
}
```

```
   ┌─ the wake strip ──────────────────────────────────────────────┐
   │  wake on terminal activity · terminals from [ lanes.olai ▾ ]  │
   │  └──────── subject ───────┘ ↑└─ from ─┘ └── core's picker ─┘  │
   │                             core's punctuation                │
   └───────────────────────────────────────────────────────────────┘
```

Three pieces and not one string with a hole in it, for `missing.why`'s reason
sharpened: a hole would make core the author of everything around it. Core owns
the arrangement, the punctuation, the numeral in `3 fleet events waiting`, and the
picker — nothing that is a claim about the plugin's subject.

Why not a member on the plugin's own surface instead? Because the browser is not
the only reader. `chat.scope` **refuses a plugin whose composed half declares no
wake**, and that check runs server-side against the enabled halves — so the
declaration belongs on the server door beside `probe` and `kinds`, where a serve
can read it without dialling anything.

---

## 4. Three doors, because three graphs

`@olai/plugin-api` has three code entry points, and a plugin has three to match.
This is the one place the design costs something: a third plugin is **three
lines**, not one.

```
                        ┌──────────────────────────────────────────┐
   @olai/plugin-api/wire   │  name · surface · faces                  │
   ─────────────────▶   │  no SolidJS, no appliance client         │
   read by: the server's│  no node: builtins                       │
   composition root AND └──────────────────────────────────────────┘
   the browser's wire

                        ┌──────────────────────────────────────────┐
   @olai/plugin-api/server │  + serve() · probe() · kinds · wake      │
   ─────────────────▶   │  MAY pull the appliance's client,        │
   read by: a server    │  @olai/format, node: builtins            │
   process              │  may NOT pull a browser face             │
                        └──────────────────────────────────────────┘

                        ┌──────────────────────────────────────────┐
   @olai/plugin-api        │  + dressings · chrome · mount · mark     │
   ─────────────────▶   │  SolidJS, and behind one face            │
   read by: the browser │  a terminal emulator                     │
                        └──────────────────────────────────────────┘
```

One door for all three would put a component on the graph of a process that
renders nothing, and a daemon's whole contract in the browser bundle. It is not
theoretical: importing the manifest door from the server **kills the boot** with
`Cannot find module 'react/jsx-dev-runtime'`.

Two more entries are routing rather than graphs: `./all.css` chains each plugin's
stylesheet, and `./testids` merges each plugin's names-only testid table.

The three rosters (`WIRES`, `SERVERS`, `PLUGINS`) must hold the same plugins in
the same order —
[`rosters.test.ts`](../../packages/plugin-api/src/rosters.test.ts) is the lid, because
a plugin added to two of them is a compile error nowhere.

---

## 5. The wire: one root, N siblings

Core does **not** become a sibling. Its tags are byte-unchanged, because an MCP
client already writes `surface://collections/documents` and the suite asserts
those addresses.

```
  surface/outlines/get          ← core.  3 segments.  unchanged, forever
  surface/kolu/fleet/get        ← kolu.  4 segments.  declared `fleet`
  surface/odu/ci/get            ← odu.   4 segments.  declared `ci`
            ▲     ▲
            │     └── the member's own name, in the plugin's package
            └──────── the plugin's name, and nothing computed it
```

The two sets **cannot** intersect: a core tag has three segments, a sibling's has
four, and the framework forbids a `/` inside any name. That is a proof, and it is
counted anyway — the merge underneath is last-writer-wins, and a silently dropped
tag is a member that answers nothing with nobody told.

This whole shape is the framework's, end to end (juspay/kolu#2222):

| Where | What does it |
| --- | --- |
| server composes | `mergeDisjointGroups({ core, plugins })` |
| server gates | `exposeRootedFaces(core, coreMap, siblings, siblingMaps)` |
| browser dials | `connectSurfaces({ core, surfaces })` — **one call**, watchdog included |

olai spelled all three by hand for one PR window and now spells none of them.
[`mechanics.test.ts`](../../packages/plugin-api/src/mechanics.test.ts) is the standing
lint that it stays that way.

---

## 6. Built vs enabled

Two lists, and the distance between them is the whole of what `--plugins` means.

```
  BUILT      what the binary carries      = the registry, compiled in
  ENABLED    what THIS serve runs         = --plugins, or all of BUILT
```

```
olai web ~/outlines                    # every plugin this build has
olai web ~/outlines --plugins=odu      # odu only
olai web ~/outlines --plugins=         # none — said out loud
```

...and the same three answers in nix, because a policy set by hand is a policy set
once and forgotten:

```nix
  services.olai.plugins = [ "odu" ];   # odu only
  services.olai.plugins = [ ];         # none
  # omit it                            — every plugin this build has
```

**Omitting is not the same as listing everything.** Preferences draws a row per
built plugin and says either *the flag you gave* or *the built-in default* — a
value that had already expanded "nobody said" into the full list could not tell a
reader which of the two they were looking at. It is the git policy's shape, one
setting over.

An unknown name is refused **once**, at startup, with the legal words beside it. A
typo is never a silently disabled integration.

### Which vocabulary answers which question

This split matters and is easy to get backwards:

| Question | Judged against | Why |
| --- | --- | --- |
| Is `{"type":"kolu-terminal"}` a legal declaration? | **BUILT** | a file's verdict may not depend on a flag it cannot see |
| Does this value fit the kind? | **ENABLED** | `admits` is a promise only a plugin that is *here* can make |
| May this value's face draw? | **ENABLED** | see §7 |

So `{"type":"kolu-terminal"}` is a clean row on a machine running `--plugins=odu`, and
`{"type":"banana"}` is a broken file either way.

---

## 7. How a live property gets its face

This is the subtlest path in the system, and it is worth following end to end.

The difficulty: **a vault's declarations deliberately never travel to a browser**
(juspay/olai#395 — the tab receives *answers*, not rules). So the browser cannot
look at `_olai/Properties.olai` and decide anything.

```
  ┌─ THE DECLARATIONS, FOLDED ─────────────────────────────────────────┐
  │ the plugin's claim   kolu-terminal → kolu-terminal   (a default)   │
  │ the vault's row      pty           → kolu-terminal   (and it wins) │
  │ ── the record ─────────────────────────────────────────────────────│
  │ lanes.olai   {"title":"implement","custom":{"pty":"c56b6183"}}     │
  └────────────────────────────┬───────────────────────────────────────┘
                               │
  ┌─ THE SERVER ───────────────▼───────────────────────────────────────┐
  │  ONE consult, per drawn value  (@olai/format's meaning.ts)          │
  │                                                                     │
  │    (from, prop, value)  ──▶  { opens, word }                        │
  │                               │       │                             │
  │        what it NAMES ◀────────┘       └──▶ which running plugin's   │
  │        (a door)                            KIND claims it           │
  └────────────┬────────────────────────────────────┬──────────────────┘
               │                                    │
      ┌────────▼────────┐                  ┌────────▼────────┐
      │  doors  table   │                  │ licences table  │   ← both ride the
      │ from·prop·value │                  │ from·prop·value │     page stream
      │      → opens    │                  │      → word     │
      └────────┬────────┘                  └────────┬────────┘
               │                                    │
  ┌─ THE BROWSER ───────┴────────────────────────────┴──────────────────┐
  │  a chip becomes a link            dressingFor() looks the WORD up    │
  │                                   in the table plugins registered    │
  └─────────────────────────────────────────────────────────────────────┘
```

Read the flow as three sentences:

1. The vault declares a **key** to be a **kind**. The key may be called anything.
2. The server answers, per value it is about to send: *what does this name*, and
   *what word claims it*. One consult, because the same declaration decides both.
3. The browser looks the **word** up in the dressing table each plugin registered
   from its manifest.

**What travels is an answer about one drawn value** — never the declaration. A page
says which word claims each value it draws, and nothing about which keys the vault
declares or what a value on another page would answer. #395 is intact.

### Why this is worth a diagram

Because it was wrong for one PR window, in a way nothing could see. The dressing
table used to be keyed on the property **key**, because the key was all a tab had,
while the server's walk and value gate followed the declared **kind**. The two
agreed only while a vault happened to name its key after the kind. A vault
declaring `terminal` on a column called `pty` was walked, probed, gated — and drew
nothing at all.

> **The rule, stated once:** the declaration licenses the face — and a
> declaration is *the vault's row, or the enabled plugin's claim where the vault
> said nothing*, in that order. Never the key's spelling, and there is
> deliberately **no fallback** to it: a fallback would be the same defect kept
> alive under a second name. The claim is not one, because it is a declaration
> like any other and because a plugin can only ever claim a key carrying its own
> name.

One more thing the consult refuses: a value that does not **fit** the kind gets
no word. That is what makes a built-in claim safe to switch on — enabling a
plugin declares keys in vaults nobody migrated, and some of them hold prose
written before the plugin existed. Those stay exactly what they were: plain, no
door, no face, with the validator's own finding beside them. And no shape guess
either, which is this arm agreeing with every other declared one rather than a
second rule.

### The other licence

There are two, and they ask about two different plugins:

| Licence | Asks | Answered by |
| --- | --- | --- |
| the page's | is **this value** claimed by a kind word? | the consult above |
| the roster's | is this serve running the plugin that owns the **face**? | the `plugins` cell |

They are the same plugin for both of today's dressings, so the second looks
redundant. It is not, by one step: nothing says a dressing is registered by the
plugin that *taught* the vault the word. A plugin may dress another's kind, and
then the word is claimed while the face's owner is off.

### Drawing vs subscribing

The roster arrives on a frame, so there is a moment where the browser does not yet
know. The two answers point **opposite ways**, and the reason is what a wrong
guess costs:

| | Before the roster lands | Why |
| --- | --- | --- |
| **draw** a face | assume ON | a face drawn early and removed is a flicker |
| **mount** a plugin | assume OFF | a subscription to a sibling this serve did not compose fails **terminally** — the readout latches at `degraded` naming a plugin the operator turned off, for the life of the page |

---

## 8. What a disabled plugin is

**Absent.** Not parked, not half-wired, not degraded.

```
  --plugins=odu   ⇒   kolu is not in the record the framework composes from

                      no sibling surface        no probe run
                      no wire tag               no chrome pill
                      no handler                no tab half mounted
                      no expose row             no dressing licensed
                      no surface/kolu/ at all   its kinds validate as plain text
                      no claimed key            (so no built-in declaration)
```

The outline it would have owned is an ordinary outline. The properties it would
have dressed draw as the text they always were — still stored, still greppable,
still editable. **The connection indicator stays green.**

This costs no mechanism, and that is the design's best property: every composition
door in the framework takes a plain keyed object of surfaces, so `--plugins` is a
filter over that object and nothing else. *Disabled is a state the framework's own
composition already expresses;* olai only has to not add the entry.

And the degenerate case is the same code as every other: a runtime with **no**
plugins hands `implementSurfaces` an empty record, which composes to a group with
no requests and leaves core's own surface byte for byte what it was. That is what
every `olai surface`, every headless MCP face and every server test already runs
as.

---

## 9. Adding a plugin

The whole checklist. Two of its artifacts live outside `packages/` (a symlink and
a docs line, step 4) and no GENERAL package changes at all, which is the claim
that matters.

0. **`packages/plugins/olai-plugin-<name>/package.json`** — the package is called
   `olai-plugin-<name>`, unscoped, and the directory is called the same thing.
   `@olai/*` is the scope for the packages that ARE olai; a tenant is olai's
   judgement about somebody else's appliance, which is the closest thing in this
   tree to a plugin written outside it, so it is named the way one would be. It
   goes in `packages/plugins/` and nowhere else — that directory is the tenant
   container, held to the registry's roster in both directions by
   `fence.test.ts`'s ninth claim. Copy either tenant's manifest for the shape:
   `main`, `types`, a `typecheck` script, and an `exports` map of five entries
   (`.`, `./wire`, `./server`, `./testids`, `./all.css`). Declare your
   appliance's client, `@olai/format` if you walk the vault, `solid-js` if you
   draw, and **everything else your own sources import** — the isolated linker
   gives a member exactly what its manifest names, and `effect` resolving by
   walking up to the root is a hole rather than a shortcut. Never declare
   `@olai/plugin-api`, which imports you.
1. **`packages/plugins/olai-plugin-<name>/src/wire.ts`** — `name`, a
   `defineSurface`, and the `faces` map. This file may not import SolidJS, an
   appliance client, or a `node:` builtin.
2. **`packages/plugins/olai-plugin-<name>/src/server.ts`** — `serve()`, and
   optionally `probe()`, `kinds` and `wake`. This is where the appliance's
   client is called, and where `services.deliveries` is rung if the plugin has
   anything to say into a conversation. Declare `wake` or the strip draws no
   picker for you and `chat.scope` refuses your name — which is the gate
   working, not a bug.
3. **`packages/plugins/olai-plugin-<name>/src/plugin.ts`** — the manifest: the
   wire half plus `dressings`, `chrome`, `mount`, `mark`. Browser graph.
4. **`packages/plugins/olai-plugin-<name>/docs.md`** — the user page, plus a
   symlink at `docs/plugins/<name>.md` and a line in `docs/index.md`.
   `packages/tests/plugin_docs.test.ts` fails if you skip either.
5. **Six edits in `packages/plugin-api/`**, not three — each roster is an
   `import` line AND an array entry, and three files beside them:
   `surfaces.ts`'s `WIRES`, `server.ts`'s `SERVERS`, `registry.ts`'s `PLUGINS`,
   `testids.ts`'s spread into `PLUGIN_TESTID`, one `@import` in `src/all.css`
   (a face outside the scan path renders with **no layout while nothing
   errors**), and `package.json`'s `dependencies` — without which the three
   roster imports do not resolve at all.


Then run `bun test packages/plugin-api` and let the fence tell you what you got
wrong. It will be specific.

Everything in steps 1–3 but the name and the surface is **optional**. A plugin
that contributes one cell is a whole plugin — odu is. The absent arm of every hook
is the state a machine without the tool already shows, and that state already had
to work.

---

## 10. Where the rules are actually enforced

Every claim on this page is a test, not a paragraph. If you break one, the failure
names the file.

| File | Holds |
| --- | --- |
| `packages/plugin-api/src/fence.test.ts` | no general package **imports** a plugin (four grammars: imports, `scanImports`, CSS `@import`, manifests) — no general package **spells** one in production code — and `packages/plugins/` holds the tenants and nothing else, both directions |
| `scripts/prove-fence.sh` | the fence and the mechanics lint go RED when they should. Not a `just check` leg: it mutates tracked files and puts them back, and `check` runs its legs in parallel. Run it when the fence CHANGES — a sweep's one failure mode is going quiet, and a fence that stopped running looks exactly like a fence that is holding |
| `packages/plugin-api/src/mechanics.test.ts` | olai names no wire mechanic the framework performs |
| `packages/plugin-api/src/tree.testlib.ts` | not a claim — the READING both of the above stand on (workspace members, manifests, sources, the module graph). Split out so the two files above are their claims and nothing else, and so the source walk is written once |
| `packages/plugin-api/src/rosters.test.ts` | the three doors list the same plugins, in the same order |
| `packages/plugin-api/src/composition.test.ts` | an empty roster composes, and core's tags do not move |
| `packages/plugin-api/src/testids.test.ts` | the plugins’ testid tables are disjoint — and one layer further out, `packages/web/src/client/testids.test.ts` holds the app’s own table disjoint from theirs, which is the seam `selector()` actually spends |
| `packages/plugins/olai-plugin-kolu/src/testids.ts` | a tenant’s two testid halves share no key and no value — a TYPE-level assertion, so a collision is a `tsc` error naming the offender rather than a test somebody keeps green |
| `packages/plugins/olai-plugin-kolu/src/faces.test.ts` | the tenant’s own two face directories stay apart — `src/browser/` names no part of the appliance’s tier, and `src/appliance/` names none of the vault’s vocabulary, which is the wall `@olai/kolu-ui`’s manifest kept before the fold. In the TENANT, not in the fence: a per-directory rule up there would be the fence inventing a layout convention and enforcing its own invention |
| `packages/tests/plugin_docs.test.ts` | every plugin's docs page exists, is served, and is linked |
| `packages/server/src/faces.test.ts` | `chat.scope` is named on the **browser** face and nowhere else — the agent face is pinned as an exact set, so an agent-settable doorbell is a red suite rather than a rule somebody has to remember |
| `packages/server/src/runtime.test.ts` | a `wake` sentence reaches the roster only for a plugin this serve is RUNNING, so no picker is offered for a doorbell nothing would ring |
| `packages/chat/src/deliveries.test.ts` | a body delivered mid-turn is HELD and the conversation keeps its interruption — the one claim a machine speaking into a person's lane could quietly cost them |
| `scripts/check-hydrated-deps.sh` | the appliance dependency walls, per pin |

---

## See also

- [`packages/plugin-api/README.md`](../../packages/plugin-api/README.md) — the same
  subject at implementation depth.
- [architecture.md](../architecture.md) — how every package fits, plugins included.
- [live-properties.md](../live-properties.md) — the user-facing half of §7.
- [running.md](../running.md) — `--plugins` as an operator sees it.
