# @olai/acp — the protocol's words, owned by the wall that speaks them

The [Agent Client Protocol](https://agentclientprotocol.com)'s vocabulary as
olai spells it, and the pure projections between ACP's own payloads and that
vocabulary. The shapes used to be declared in `@olai/surface`, which put the
protocol's words inside olai's wire spec; the arrow points the other way now,
on the precedent `RepoState` set — **the package that speaks the foreign thing
owns its words** (`@olai/git` declares the repository vocabulary,
`@olai/format` re-exports it; this package declares the ask vocabulary,
`@olai/surface` re-exports it, and no consumer moved an import).

## The modules

| file | what it owns |
|---|---|
| `wire.ts` | the vocabulary that travels olai's wire: `AskChoice` / `AskField` / `AskAnswer` / `AskOutcome`, the `YES_NO` spelling both ends must agree on, `FileDiff` and `Usage`. On its own `./wire` subpath — the half `@olai/surface` re-exports, with no protocol payload in sight — the way `@olai/git`'s wire half sits on `./state` |
| `asks.ts` | the protocol's two ways of asking a PERSON something (`elicitation/create` form mode, `session/request_permission`), projected into one drawable form — and the answers projected back, typed the way the schema asked |
| `diffs.ts` | the protocol's `diff` content blocks, read as data: which file a call rewrote, what was there, what is there now |
| `usage.ts` | the protocol's `usage_update`, read as data: how full the conversation's context is, and how big the window is. Here rather than in `@olai/chat`'s `interpret.ts` because it is ACP's own update kind — any agent may send one — and the cost it also carries is deliberately not read |

Everything is a pure function over a payload. Nothing here waits, spawns, or
knows a subprocess exists — the subprocess that speaks these words is
`@olai/chat`'s, and stays there.

## The seam, and the manifest

This is a LEAF that speaks ACP and nothing of olai: no `@olai/*` import. So
the domain's refusal word (`UsageFailure`) does not appear here — a payload
this vocabulary cannot say comes back as this package's own one word,
`Refused`, and `@olai/chat` translates it at the seam it consumes this from
(`questions.ts`), once.

What may cross the boundary is machine-checked rather than agreed by comment:
`src/manifest.test.ts` enumerates the package's imports (only `effect` and the
SDK's types), its closed export list, where the SDK may be imported at all
(here and `@olai/chat`), and who may import this package (`@olai/surface` for
the wire half, `@olai/chat` for the projections).
