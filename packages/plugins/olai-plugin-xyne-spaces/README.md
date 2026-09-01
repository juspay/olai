# olai-plugin-xyne-spaces — the Spaces tenant

olai's own judgement **about Xyne Spaces**, in the one place that is neither Spaces nor core. Phase 1 is Mirror: doorbell digests and trimmed orchestrator replies go outbound to a bound channel; `agentProgress` fires during turns; nothing comes back.

There is no appliance-client package one floor down. Spaces is reached over HTTP with an installed-app JWT, and that dial lives here.

The user page is [`docs.md`](docs.md), served at `docs/plugins/xyne-spaces.md`.

## The name is spelled once

`name = "xyne-spaces"` sits in [`src/wire.ts`](src/wire.ts) beside the members. One cell, `link`, composes to `surface/xyne-spaces/link/get` — whether this serve can post, in three states (`connected` / `absent` / `fault`).

No `wake`. Binding is `_olai/Spaces.olai`, not the doorbell picker. Faults still go into the bound conversation through `deliveries.deliver`.

## The direction, and where the fit is proved

This package imports `@olai/plugin-api` nowhere. The manifest in [`src/plugin.ts`](src/plugin.ts) is a plain `as const` object, and the agreement is proved at the registry's `satisfies`. Three code doors, disjoint by graph: `./wire`, `./server`, the root. Tests run against a fake Spaces (`src/testlib/fake-spaces.ts`) and never against a live instance.
