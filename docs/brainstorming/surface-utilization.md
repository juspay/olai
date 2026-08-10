# Surface framework utilization

Status: audit of what olai does NOT use (or misuses) of `@kolu/surface` / `@kolu/surface-app`, module by module at the current kolu pin. Audited 2026-08-09, prompted by the `no-lifecycle` bug — which existed precisely because a framework capability was obtained and discarded. File:line evidence verified at audit time.

## Misused — obtained or shadowed, then defeated

- **Wire `status` accessor** (`connectSurface`, whose own doc says *"render it so the watchdog's recovery is VISIBLE rather than silent"*): `wire.ts` keeps only `.client`. The `no-lifecycle` bug.
- **Process-id echo** (`echo: ProcessIdEcho`, same return value): also discarded. Consequence: reconnects never carry `?pid`, and the server's `rejectStaleProcess(claimedPid, liveId)` never rejects when `claimedPid` is null — **the stale-tab gate in `listener.ts` is dead code today**, contradicting its own comment that a tab on a replaced server "is told so". The `retired` wire state can never fire.
- **Frame cap**: `listener.ts` set ws `maxPayload` to 8 MiB while the framework's `frameLimit` classifies oversize at 16 MiB, so an 8–16 MiB frame was refused a layer below the one that owns the decision. FIXED 2026-08-10 — the cap is `RPC_MAX_FRAME_BYTES` (+ the ndjson delimiter, which rides the wire but is outside what the decoder measures). One correction to the audit's account while fixing it: under bun — which is what runs this server — the option was never enforced at all. Bun's built-in `ws` ignores `maxPayload` and applies a 16 MiB ceiling of its own (measured: 16777216 delivered, one byte more closed **1006 "Received too big message"**), so the 8 MiB cap was inert here and the raw-1009 death was a node host's failure mode, not one seen in production. Two live consequences of that ceiling: no `maxPayload` we pass can move it, and while it stands the framework's handled **inbound** oversize path is unreachable under bun at all — a frame the decoder would refuse (>16 MiB of content) is already past bun's ceiling, and even one at exactly the cap arrives as 16 MiB + 1 and dies at 1006 rather than the framework's 1009. Regression fence is `packages/server/src/listener.test.ts`, which pins the number rather than the behaviour for exactly that reason.

## Unused, with a consequence attached

- **`createServerLifecycle`** — restart-vs-transient-drop classification, `serverProcessId()`. Without it there is no forced-refresh path for a redeploy. (Being adopted by the `no-lifecycle` fix.)
- **`client.health()` + `gateStatus` / `SurfaceGate` / `HostStatusPip`** — the aggregate live/degraded verdict with per-subscription detail. `App.tsx` hand-rolls a `<Switch fallback="Reading…">` that conflates "no frame yet" with every wire-degraded state.
- **Per-subscription liveness registry** (`subscribedAt`/`lastFrameAt`/`framesReceived`/`retries`) — the "socket healthy but one subscription parked" bug class (documented in kolu #2101) is currently undiagnosable in olai. Directly relevant to `live-dead`.
- **`gracedDown`** — debounce so a reconnect blip doesn't flash "Disconnected". Needed the moment `status` is rendered.
- **`SurfaceAppProvider` / `useSurfaceApp`** — `presentingDown`, `stale`, `updateReady`, `setAttention`, `isInstalled`/`canInstallPwa`. Each will be hand-rolled ad-hoc if adopted piecemeal (PWA install pairs with the `mobile-pwa` roadmap item).
- **`reloadForUpdate`** — the vetted forced-reload; no update path is wired to any UI.
- **Per-member client error policy** (`ClientCellPolicy`, `onError`) and **`liveWhen`** readiness — no subscription declares error handling; becomes load-bearing when procedures can fail mid-write.
- **`notify.ts`** — SW-routed OS notifications with dedup and cold-start click ACK; built for exactly the chat pushes on the roadmap. Adopting it requires switching `main.tsx`'s unconditional `retireServiceWorker()` to `registerOrRetireServiceWorker` (the lifecycle module's documented pairing invariant).
- **`buildInfo` cell + `identity.info`** — the server-side counterpart restart detection reads from; pairs with `createServerLifecycle`.
- Not needed yet, noted for completeness: federation (`mirrorRemoteSurface`/`peer-server`), reverse-proxy viewer identity (`viewerAddressOf`), clock-offset probe.

## Primitives: 2 of 5

Today's spec is one read-only cell (`errors`, `get` only) and one stream (`outlines`). **Collection, event, procedure: unused.** The spec's own comment anticipates it: ops arrive as procedures and chat as events with the chat item. Chat needs the *pair* — events for pushes (no snapshot obligation; late joiners miss history) plus a collection for the persisted keyed message list — and `notify.ts` + `ClientCellPolicy` are the framework pieces already waiting for that work. Collections are the one primitive with no framework-side scaffolding pre-built for olai's shape.

## Used correctly

Origin gate (`gateWsOrigin`/`parseAllowedOrigins`), the accept/heartbeat/serve delegation (`acceptSurfaceSocket`/`serveSurfaceSocket`/`surfaceAppLayer`), and `buildSurfaceClient`'s freshness contract. `listener.ts`'s remaining hand-rolled sequencing is already documented as owed upstream in architecture.md; the port-fallback logic is genuinely olai-specific.
