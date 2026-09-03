# olai-plugin-xyne-spaces — the Spaces tenant

olai's own judgement **about Xyne Spaces**, in the one place that is neither Spaces nor core. Phase 1 is Mirror: doorbell digests and trimmed orchestrator replies go outbound to a bound channel; `agentProgress` fires during turns; nothing comes back.

There is no appliance-client package one floor down. Spaces is reached over HTTP with an installed-app JWT, and that dial lives here.

The user page is [`docs.md`](docs.md), served at `docs/plugins/xyne-spaces.md`.

## The name is spelled once

`name = "xyne-spaces"` sits in [`src/wire.ts`](src/wire.ts) beside the members. One cell, `link`, composes to `surface/xyne-spaces/link/get` — whether this serve can post, in three states (`connected` / `absent` / `fault`).

No `wake`. Binding is `xyne-channel` on a node agent, not a sidecar file and not the doorbell picker. Faults still go into the bound conversation through `deliveries.deliver`.

## The direction, and where the fit is proved

This package names `@olai/plugin-api` — the INTERFACE, which names no plugin — and names `@olai/bundle` nowhere, which is the REGISTRY and imports every plugin. Every one of those names is in TYPE position: a `ConversationSeen` on the server half, and an `import type {}` at the top of each half, which is the declaration merging that puts `ctx.slots` on one context and `ctx.vault` on the other while putting no runtime on either graph.

It was a manifest in `src/plugin.ts` — a plain `as const` object whose agreement with the interface was proved at the registry's `satisfies`. Both halves are Cordis plugins now: [`src/server.ts`](src/server.ts) and [`src/browser.tsx`](src/browser.tsx), each `name`, `inject`, `apply(ctx)`. The browser half injects `slots`, `bar` and `wired` — no `clocks`, because nothing Spaces draws ticks, and no `links`, because nothing it draws is a door onto a served file — and hangs the pill in `app.header`, the mark in `chat.speaker.mark` and the tab's one subscription in `app.mount`. **This row is opt-in** (`disabled: true` in `olai.yml`), which used to mean the tab loaded the module and drew nothing out of it; it means the chunk is never fetched now, because the roster is what asks for one.

Three code doors, disjoint by graph: `./wire`, `./server`, `./browser` — and the root is the wire identity, now that there is no manifest for it to be. Tests run against a fake Spaces (`src/testlib/fake-spaces.ts`) and never against a live instance.
