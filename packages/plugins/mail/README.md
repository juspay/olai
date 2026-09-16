# olai-plugin-mail — the Gmail tenant

olai's own judgement **about a Gmail mailbox**, in the one place that is neither Gmail nor core. Connect: a serve holds one account, an OAuth refresh token lives in core's memory door, and the header pill says which mailbox it is reading.

There is no appliance-client package one floor down, and that is the shape of this tenant rather than a phase not yet reached: [Himalaya](https://github.com/pimalaya/himalaya) publishes no client library this repository could consume and no MCP face a conversation could dial, so [`src/himalaya/`](src/himalaya/) is a frozen verb table, a generated config and a spawn — and NOTHING of Himalaya is imported here. The binary is the plugin's own Nix half (`default.nix`, baked on the wrapper as `OLAI_HIMALAYA`); the plugin names it through `env.vars` and never resolves it.

The user page is [`docs.md`](docs.md), served at `docs/plugins/mail.md`.

## The name is spelled once

`name = "mail"` sits in [`src/wire.ts`](src/wire.ts) beside the members. One cell, `account`, composes to `surface/mail/account/get` — whether this serve holds a Gmail authorization, in three states (`absent` / `connected` / `fault`) — and two browser-only procedures, `connect.begin` and `connect.disconnect`. A connect is a person at a panel; an agent acting as the mailbox is what the read tools are for. The nine tools are registered through the shared mailbox.

The state machine that moves between the three arms is [`src/account.ts`](src/account.ts): a boot, a callback the passive route lands, a disconnect, and one fiber that refreshes the access token five minutes before it expires.

## The direction, and where the fit is proved

This package names `@olai/plugin-api` — the INTERFACE, which names no plugin — and names `@olai/bundle` nowhere, which is the REGISTRY and imports every plugin. What crosses is the service TAGS each half names in its `needs` — `Clock`, `Env`, `LocalState`, `Surfaces`, `TransportSurface`, `Vault`, `Kinds`, `Deliveries` and the minted `chat.seating` tag on the server; `Slots`, `Bar`, `Wired` in the tab — plus the `definePlugin` that turns each half's Effect into a plugin.

Two things leave this package that no other tenant does, and both are named here because they are the interesting part:

- **it claims a listener path.** `/_olai/mail/oauth` is registered through `TransportSurface` as a PASSIVE route — the serve already has a listener, and this row adds one path to it for as long as it stands. Switching the row off takes the route with it, which is what a person expects a switch to mean and what a second listener could not promise.
- **it hangs a face in `plugins.row`,** a slot `olai-plugin-plugin-inspector` owns: the panel draws the row, and this plugin supplies the sentence and the two verbs, because core cannot write a sentence about a mailbox and must not learn one. The slot's face answers `needs()` too, which is how a row that is running, faultless and waiting on a person is filed under **Needs you** rather than among the healthy.

Code doors: `./wire`, `./server`, `./browser`, `./policy`, `./appliance/testlib` — and the root is the wire identity. Tests run against two fakes (`src/appliance/testlib/`): a Himalaya that IS a spawned program, and a Google that is one loopback origin serving the consent screen, the token endpoint and the revocation. Neither is reachable from the plugin.

## Inbox wakes and scope

The nine tools and `mail-inbox` node opt-in complete the inbox-zero loop. `inbox.ts` joins declared properties with the `chat.seating` service; `watch.ts` owns history paging and pending digests, and the memory door persists the cursor alongside OAuth state. `poll` is live configuration. Sending, drafts, permanent delete and live filed-thread properties are excluded.

The plugin’s `default.nix` applies the local MIME payload and history-message patches. The latter preserves thread ids and labels in history JSON for inbox wakes; `src/himalaya/surface.check.ts` checks both against the built binary’s schemas.
