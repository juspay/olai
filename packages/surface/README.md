# @olai/surface

WHAT CORE SERVES WITH NO ROW AT ALL, and the protocol vocabulary the rows share. Nothing else. It declares no collection, no search stream, no editor command and no vault-source approval API, and it re-exports no row's read vocabulary either.

`src/core.ts` declares the four members core answers whether or not a single row stands: which plugins this build has, the switch that turns one on or off, who is looking on this connection, and what this deployment is called. They remain available without a vault, an outline renderer or an inspector. Kolu supplies its reserved identity, liveness and clock members. `./host` exports the same descriptor object under the name an adapter reaches for, so nothing reconstructs an equivalent schema on a separate identity.

## Where a row's vocabulary lives

A capability owns its descriptors beside its handlers, and — since the residue after phase 18 — the SHAPES those descriptors are declared with as well. Vault declares file heads, load state and errors, and the `Head`/`Manifest` schemas behind them (`olai-plugin-vault/wire`). Outlines declares tree and page readings, node operations and the `OutlineEntry` schema (`olai-plugin-outlines/wire`). Markdown declares documents, document metadata and `DocumentEntry` (`olai-plugin-markdown/wire`). Search declares its query stream and procedure; pins and capture declare their readings; files and trash declare their write contributions; vault-plugins declares source approval and inspection. Loading one of those static contracts acquires no plugin state. Activating the provider registers its handlers, and withdrawing it removes their authority.

What a row does NOT reach up into this package for is the shape of its own member. That was the last of the monolith: `outlines`, `documents`, `heads`, `pins` and `search` were declared here, and every content plugin's `surface.ts` was a slice cut out of them. The members moved to their rows in phase 18 and the vocabulary followed. The shapes that were never this package's — the page, narrowing, search, shelf, inbox, tag and lookup schemas — are `@olai/format`'s, and consumers import them from there rather than through a second door here. `@olai/bundle`'s `fence.test.ts` holds this package's export list to what is described below.

## The doors

`./dispatch` contains only the shared write envelopes: `Edit`/`Applied` and `WriteRequest`/`WriteResult`. Several capabilities own disjoint variants on preserved root tags. They share the same schema objects so composition can prove descriptor compatibility — `@olai/server`'s `composition.ts` refuses dispatch co-owners whose payload, success and error ASTs differ — and each registration separately declares its accepted discriminators. Sharing an envelope grants no authority to execute another provider's variant. It is here rather than in one of the six rows because a row that held it would be a row the other five could not run without.

`./projection` is the slicing rule three rows call and none owns: what a revision moved (`frame`), and one collection's entries and deltas cut out of it (`changeOf`). It names no collection. Each row supplies its own predicate and its own entry, and keeps its own `Projection` between revisions.

The remaining root exports are immutable schemas and pure protocol helpers used on both sides: the edit union, the media URL, the saved-page seal, the attachment policy, what a click meant, and where the hashed browser bundle lives.

`./client` builds a typed face from a supplied surface and dispatch. It has no fixed application spec, and there is no longer a package that gives it one. `@olai/bundle/surface` and `@olai/bundle/client` were a flat aggregate of every row's members under bare names plus a typed client over it; #546 deleted both, because a member has one tag now and it carries its owner, so the aggregate described a wire nothing serves. The one flat contract still standing is `olai-plugin-mcp/face`'s `mcpContract`, which exists because `serveSurfaceAsMcp` builds every `surface://` URI out of a single spec's member keys (juspay/kolu#2233 is the ask) — its flatness is confined to the types, and the dispatch under it is scoped through the standing rows themselves. Browser capabilities consume their own scoped sibling clients, supplied by `Wired`, rather than a permanent full-application client.

## What is pinned, and where

Tests here pin the permanent management member set. The bundle's `application-surface.test.ts` checks each row's tags at the scoped name the composition serves them under, read-only declarations, collection semantics and schema array keys across the capability-owned descriptors, and its `published.test.ts` and `published.equivalence.test.ts` hold the three rows' projections up together — a claim about three rows at once is a claim only the registry can make.
