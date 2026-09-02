# Spaces integration

[Xyne Spaces](https://github.com/xynehq/xyne) is the org's team chat. If this olai has been pointed at a Spaces app, the orchestrator's conversation **mirrors into a bound channel** — doorbell digests, trimmed orchestrator replies, and a live "working…" signal while a turn runs. Nothing comes back the other way.

**This is watch-only.** Mentions, DMs, slash commands and buttons are later phases. Humans talking in the channel are not answered, and human messages in olai never mirror. This page describes only what is here.

## The connection

Two facts, and they live in different places because one is a secret:

- **`$OLAI_SPACES_URL`** and **`$OLAI_SPACES_TOKEN`** in the environment — the Spaces origin and the installed app's JWT. The human reuses the existing "kolu" Spaces app, so the bot's name in-channel is kolu. That is accepted. These are secrets; they are never written to the vault.
- **`_olai/Spaces.olai`** — the conversation→channel binding and the digest knobs. An ordinary outline, found by basename the way `_olai/Kolu.olai` is (shallowest `spaces.olai`, `_olai/Spaces.olai` the chosen form).

**Off by default.** Omitting `--plugins` runs kolu and odu; this plugin stays off until the flag names it (`--plugins=xyne-spaces`, or listed with the others). A Spaces app JWT is a secret this machine may not have, and a pill in every bar for an integration nobody pointed at is the wrong default.

No env and no bind → the plugin is honestly **absent**, not broken. A bind in `_olai/Spaces.olai` with no env is a **fault**, not absent: the user named a channel and this process cannot post. The pill is loud and names the missing env; the first bound conversation is told once.

Beside the connection pill in the header is a readout with three states rather than two:

- `● spaces` — both env vars are set and the last post (if any) was accepted;
- `● no spaces`, dim — nothing is configured (no env, no bind), and the tip names **where olai looked** (`OLAI_SPACES_URL` / `OLAI_SPACES_TOKEN`);
- `● spaces fault` in the alarm colour — a post was refused, or a channel is bound and the env is missing, and the tip names **which**.

The third is why the readout is not a boolean. *Nothing was ever configured* and *a channel is bound but the process has no app* have opposite loudness, and a fault reported as absent would hide the bind the user already wrote.

## The binding

One channel per team, one orchestrator. The bind is a node in `_olai/Spaces.olai`, not a picker in the chat panel:

```
{"id":"mirror","ord":"a0","title":"mirror","custom":{"channel":"<spaces-channel-id>","agent":"claude","session":"<session-id>"}}
{"id":"digest","ord":"a1","title":"digest","custom":{"trim":"500"}}
```

`channel` is required; without it nothing posts. `agent` and `session` are optional — omit both to bind every conversation this serve is in, omit only `session` to bind every session of that agent. A bind that names an agent this serve is not talking to is ignored — that is the working case. `trim` is the character cap (Unicode code points) for **both** orchestrator replies and doorbell digests (default 500). A malformed trim defaults **and is said on the server's console at warning level**.

olai never writes this file. Turning the plugin on without a bind is a connected pill that posts nothing.

## What mirrors

**Doorbell digests**, at digest level (~5–8 messages per PR, never the firehose):

- lane dispatched
- review verdict (MUST / SHOULD / NIT counts)
- CI result — posted once, then **edited in place** on first-red → final, never posted twice
- merged, with the timings line
- anything stuck / needing a human

A kolu heartbeat ("the watcher is alive") is not a digest and does not post. Human messages never mirror.

**One thread per bound conversation.** The thread key is the olai `(agent, session)` pair that already rides the watching event — not a title parsed out of the digest. The conversation's first digest opens the Spaces thread; later digests reply into it. Lane threads and the outbound queue are persisted through `PluginServices.held` — core owns the file in the state home (one hold per plugin per vault), the plugin parses the snapshot, and successive writes land in the order they were made. A restart opens the same thread and still has the queued digests. Olai never writes `Spaces.olai`.

**Orchestrator replies and doorbell bodies, trimmed**: each is capped at the first ~500 Unicode code points with an ellipsis, and an open code fence the cut would have left is closed. Working-notes still produce the ephemeral signal below rather than a stored wall of fragments.

**`agentProgress`** while the orchestrator runs a turn — the ephemeral "working…" signal in the lane thread, not a stored message. It ends when the turn does.

## Failure honesty

A refused post, and a bind whose process has no Spaces app, are said **once** into the olai conversation (the doorbell fault pattern), not once per message. Digests queue (capped at 32) and post in order on recovery; the queue retries on its own, not only when the next digest arrives. A missing channel (the typo in `_olai/Spaces.olai`) keeps retrying with the fault said. A dead Spaces thread is forgotten and the digest re-opens one. A 4xx that will never accept (a validation error) is dropped so it cannot wedge the rest. Overflow of the cap drops the oldest and **says so**, with the count. The pill stays on `spaces fault` until a post is accepted again. The recovery sentence is a separate delivery from the fault, so it cannot replace a fault line that has not been handed over yet.

## What it is not

- **At-least-once on a crash.** The hold is ordered, not atomic with the send: a kill between a post landing and its persist leaves the hold naming a digest already sent, and the next serve posts it again.
- **No inbound.** A message in the Spaces channel, an @mention, a DM, a slash command or a button click does not reach this olai. That is phase 2.
- **No live test in CI.** The suite pins request shapes against a fake Spaces. Deploying against the real instance is the human's, before merge.
- **No picker.** The prototypes showed a channel picker on the chat strip; this slice ships the config-file bind above.
