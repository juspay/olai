# olai-plugin-mail — the Gmail tenant

olai's own judgement **about a Gmail mailbox**, in the one place that is neither Gmail nor core. Connect: a serve holds one account, an OAuth refresh token lives in core's memory door, and the header pill says which mailbox it is reading.

There is no appliance-client package one floor down, and that is the shape of this tenant rather than a phase not yet reached: [Himalaya](https://github.com/pimalaya/himalaya) publishes no client library this repository could consume and no MCP face a conversation could dial, so [`src/himalaya/`](src/himalaya/) is a frozen verb table, a generated config and a spawn — and NOTHING of Himalaya is imported here. The binary is the plugin's own Nix half (`default.nix`, baked on the wrapper as `OLAI_HIMALAYA`); the plugin names it through `env.vars` and never resolves it.

The user page is [`docs.md`](docs.md), served at `docs/plugins/mail.md`.

## The name is spelled once

`name = "mail"` sits in [`src/wire.ts`](src/wire.ts) beside the members. One cell, `account`, composes to `surface/mail/account/get` — whether this serve holds a Gmail authorization, in three states (`absent` / `connected` / `fault`) — and two browser-only procedures, `connect.begin` and `connect.disconnect`. A connect is a person at a panel; an agent acting as the mailbox is what the read tools are for. The eleven tools are registered through the shared mailbox. Reply defaults belong to that mailbox; the pure composer parses and validates addresses separately from rendering MIME headers, and renders `multipart/mixed` when a call names attachments. Draft files still belong to one runner call inside the activation’s directory. Attachments (`src/enclosures.ts`) are validated as arguments inside `validateDraft` and read in `mailbox.draft` before the thread lookup — one gated call's work over paths the caller already holds, so nothing is owned and nothing outlives the call.

The state machine that moves between the three arms is [`src/account.ts`](src/account.ts): a boot, a callback the passive route lands, a disconnect, and one fiber that refreshes the access token five minutes before it expires.

## The direction, and where the fit is proved

This package names `@olai/plugin-api` — the INTERFACE, which names no plugin — and names `@olai/bundle` nowhere, which is the REGISTRY and imports every plugin. What crosses is the service TAGS each half names in its `needs` — `Clock`, `Env`, `LocalState`, `Surfaces`, `TransportSurface`, `Deliveries`, `Wakes` and `Offers` on the server; `Slots`, `Bar`, `Wired` in the tab — plus the `definePlugin` that turns each half's Effect into a plugin.

Two things leave this package that no other tenant does, and both are named here because they are the interesting part:

- **it claims a listener path.** `/_olai/mail/oauth` is registered through `TransportSurface` as a PASSIVE route — the serve already has a listener, and this row adds one path to it for as long as it stands. Switching the row off takes the route with it, which is what a person expects a switch to mean and what a second listener could not promise.
- **it hangs a face in `plugins.row`,** a slot `olai-plugin-plugin-inspector` owns: the panel draws the row, and this plugin supplies the sentence and the two verbs, because core cannot write a sentence about a mailbox and must not learn one. The slot's face answers `needs()` too, which is how a row that is running, faultless and waiting on a person is filed under **Needs you** rather than among the healthy.

Code doors: `./wire`, `./server`, `./browser`, `./appliance/testlib` — and the root is the wire identity. Tests run against two fakes (`src/appliance/testlib/`): a Himalaya that IS a spawned program, and a Google that is one loopback origin serving the consent screen, the token endpoint and the revocation. Neither is reachable from the plugin.

## Inbox wakes and scope

The eleven tools and the conversation strip's **wake on new mail** switch complete the inbox-zero loop. Chat stores the browser's opaque `true` pick and issues revocable recipients through `Deliveries.scopes()`. `watch.ts` owns history paging and pending digests; the memory door persists the cursor alongside OAuth state. The optional cadence component reads the declared configuration service and updates the activation's poll control. Sending, draft list/delete, permanent delete and live filed-thread properties are excluded.

The plugin’s `default.nix` applies the local MIME payload, history-message and draft-output patches. The history patch preserves thread ids and labels in history JSON for inbox wakes; the draft patch returns draft, message and thread identities. `src/himalaya/surface.check.ts` checks all three against the built binary’s schemas.
