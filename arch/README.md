# arch

Architecture as data. One `arch.rkt` per package says how fast the code under
it moves, what ambient authority it may reach for, and which concepts it owns;
`just arch` holds the tree to it.

The alternative is what this repo had: layering as sentences in CLAUDE.md.
Break one and the build stays green — an agent finds out in review, or never.

```
$ just arch
arch: 120 modules in 10 declared packages — the tree agrees with itself
```

## The grammar

```racket
#lang arch
(clock settling)                                 ; how fast this moves
(owns)                                           ; no ambient authority
(concept file-naming "file-label" "key-label")   ; names only this package spells
(override "store.rkt" (owns filesystem))         ; how one module differs
(override "cli.rkt"   (clock volatile) (owns (clock "today-iso-string")))
```

Four forms, and nothing else is an arch form.

* **`(clock stable | settling | volatile)`** — required, once. Least volatile
  first, and the order is the rank: a dependency may point at the same rank or
  a lower one, never higher.
* **`(owns authority ...)`** — the ambient authority this scope may reach for.
  The set is closed: `clock`, `filesystem`, `filesystem-events`, `network`,
  `subprocess`, `threads`, `randomness`. A new one is a roadmap proposal, not
  an edit to [vocabulary.rkt](vocabulary.rkt).
* **`(concept name "pattern" ...)`** — export names that belong to this scope
  and to nothing else. `*` is the only wildcard.
* **`(override "file.rkt" clause ...)`** — how one module differs. The clock
  **replaces**; `owns` and `concept` **add**. The file has to exist, checked
  when the declaration compiles.

An authority can be handed on under another name — `(owns (clock
"today-iso-string"))` on the module that exports it — so a caller of
`today-iso-string` is reading the clock as surely as one calling `(today)`.
Spellings go on an `override`, because they are a claim about one module's
exports.

## The checks

| # | rule | what it replaced |
|---|---|---|
| 1 | dependencies point volatile → stable, never back | "core must build without web/", "acp has no web/", "store/watch/hub meet only in serve" |
| 2 | an authority is used only where it is owned | "pure logic takes `today` as an argument (testable, no clocks)" |
| 3 | one owner per tagged concept | "keys are minted in the load layer", "nothing else spells either" |
| 4 | the declarations agree with `git log` | nothing — this one is new |

Two smaller checks ride along, each auditing a declaration rather than the
code: a spelling has to be a name its module really exports, and a concept has
to have exactly one claimant. Without them the check they serve would quietly
apply to nobody.

A finding says where, then the rule, then the facts, then what to do:

```
olai/lang/expander.rkt:32:21: requires olai/dates.rkt: dependency points the wrong way
  olai/lang/expander.rkt is declared stable (olai/lang/arch.rkt:10)
  olai/dates.rkt is declared settling (olai/arch.rkt:6)
  stable code must not depend on settling code — invert the edge, or move the code that reaches across
```

Longer than you would write for a human, on purpose. The reader is usually an
agent, verbosity measurably raises its odds of fixing the right thing, and
nobody reads any of it when the check passes.

### No waivers

There is no way for a module to exempt itself. The only two answers to a
finding are **fix the code** or **change the declaration**, and both are lines
in a diff somebody reviews.

The one thing that is not checked is a module with no `arch.rkt` above it —
that hole can only be opened by moving a module out of a declared package or
deleting a declaration, which are also lines in a diff. It is what keeps a
`.plt-user` full of somebody else's Racket from being architecture.

### The churn audit

Check 4 reads `git log -n30 --name-only` and compares it with the clocks:
`stable` allows a file to change in up to a fifth of the window, `settling` up
to a half, `volatile` has no ceiling. Only the tight end is checked — a module
that declares itself volatile and never changes misleads nobody.

With no history to read (no git, a shallow checkout, a build sandbox) the audit
says so in the report and the other three checks run. That is not a waiver; it
is the rule having nothing to apply to.

## Seeing what it thinks

```
$ just arch --explain olai/web/watch.rkt
olai/web/watch.rkt
  governed by  olai/web/arch.rkt
  clock        volatile           olai/web/arch.rkt:10 (package default)
  owns         clock              olai/web/arch.rkt:19 (override "watch.rkt")
               filesystem-events  olai/web/arch.rkt:19 (override "watch.rkt")
               threads            olai/web/arch.rkt:19 (override "watch.rkt")
  concepts     outline-watching "start-watcher" "seconds-until-midnight" olai/web/arch.rkt:20
  churn        0 of the last 30 commits — volatile has no ceiling
  requires     olai/store.rkt (settling)
```

A composition a reader cannot see through is one they argue with from memory,
so this is interface and not a debug aid — the same reason `just expand` prints
what a live form becomes.

## How it works, and what it costs

The checker asks three different things three different questions, and each
answer is one module's business:

* [source.rkt](source.rkt) reads the source — never expands it. Requires,
  definitions, and every identifier the module *calls*, each with a srcloc.
* [facts.rkt](facts.rkt) asks the compiled modules what they export and what
  names reach them. `(dynamic-require path #f)` declares a module without
  instantiating it, so nothing anybody wrote is ever run.
* [churn.rkt](churn.rkt) shells out to git.

One more module has no business in any of the three: [wording.rkt](wording.rkt)
says a list of words and guesses at a misspelling, and it is split from
[vocabulary.rkt](vocabulary.rkt) because the ratified words change when a human
ratifies one and the phrasing changes whenever somebody watches an agent
misread a message.

With `.zo` on disk the whole tree is about two seconds, which is why `just
arch` lives in the edit loop beside `just check` rather than only in CI.

What reading rather than expanding costs, stated so nobody has to discover it:

* A dependency introduced only by a macro is invisible. What a module *says* it
  depends on is what an architecture check is about, and it is what a reader
  sees too.
* An authority is counted when its name is in operator position — `(today)`,
  `(file-exists? p)`, `[current-directory d]` — or right after `apply`. Binding
  positions do not count, so `(for ([today days]) …)` and `(λ (now) …)` are the
  code taking the thing as an argument, which is what the rule is FOR. The
  binding forms are a short closed list in [source.rkt](source.rkt); a form
  nobody listed is walked as ordinary code, which over-reports rather than
  under-reports. Handing a spelling somewhere as a value (`(map file-exists?
  ps)`) is missed — the alternative is a scope analysis, which is an expander,
  which is the cost being avoided.
* `only-in` narrows what a require brings in and this does not model it, so a
  module that mentions a name it did not quite import is asked to declare an
  authority it does not quite use. The error is on the side of declaring, which
  is the side a reader can check.

## Why it is its own package

`live/` imports nothing from olai and never will. Its declaration is a `#lang
arch` module, so the language cannot live inside `olai` without inverting that
— and a package cycle is not a thing raco will build. So `arch` is a collection
of its own, under both, depending on nothing but `base`.

That is also why it is packaged for Nix rather than being a dev-time script:
`live/arch.rkt` and `olai/**/arch.rkt` are modules, and any build that installs
those collections has to be able to compile them. Shipping the checker with
them is the price of the declarations living beside the code they are about,
which is the whole point.
