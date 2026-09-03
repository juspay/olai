# olai-plugin-xyne-spaces — the Spaces tenant

olai's own judgement **about Xyne Spaces**, in the one place that is neither Spaces nor core. Phase 1 is Mirror: doorbell digests and trimmed orchestrator replies go outbound to a bound channel; `agentProgress` fires during turns; nothing comes back.

There is no appliance-client package one floor down. Spaces is reached over HTTP with an installed-app JWT, and that dial lives here.

The user page is [`docs.md`](docs.md), served at `docs/plugins/xyne-spaces.md`.

## The name is spelled once

`name = "xyne-spaces"` sits in [`src/wire.ts`](src/wire.ts) beside the members. One cell, `link`, composes to `surface/xyne-spaces/link/get` — whether this serve can post, in three states (`connected` / `absent` / `fault`).

No `wake`. Binding is `xyne-channel` on a node agent, not a sidecar file and not the doorbell picker. Faults still go into the bound conversation through `deliveries.deliver`.

## The direction, and where the fit is proved

This package names `@olai/plugin-api` — the INTERFACE, which names no plugin — and names `@olai/bundle` nowhere, which is the REGISTRY and imports every plugin. What crosses is the service TAGS each half names in its `needs` — `Watching`, `Deliveries`, `Held`, `Surfaces` on the server; `Slots`, `Bar`, `Wired` in the tab — plus the `definePlugin` that turns each half's Effect into a plugin, and the data shapes both spell (`ConversationSeen`). Neither half names the plugin runtime: `Cordis is an engine nobody outside one package sees`, and that package is `@olai/effect-cordis`.

It was a manifest in `src/plugin.ts` — a plain `as const` object whose agreement with the interface was proved at the registry's `satisfies`. Both halves are EFFECTS now: [`src/server.ts`](src/server.ts) and [`src/browser.tsx`](src/browser.tsx), each a `definePlugin` over `name`, `needs` and an `apply` that is one Effect. The browser half names `Slots`, `Bar` and `Wired` — no `clocks`, because nothing Spaces draws ticks, and no `links`, because nothing it draws is a door onto a served file — and hangs the pill in `app.header`, the mark in `chat.speaker.mark` and the tab's one subscription in `app.mount`. **This row is opt-in** (`disabled: true` in `olai.yml`), which used to mean the tab loaded the module and drew nothing out of it; it means the chunk is never fetched now, because the roster is what asks for one.

Three code doors, disjoint by graph: `./wire`, `./server`, `./browser` — and the root is the wire identity, now that there is no manifest for it to be. Tests run against a fake Spaces (`src/testlib/fake-spaces.ts`) and never against a live instance.
