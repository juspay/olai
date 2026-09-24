# The Codex executable pin

This directory is the executable half of `olai-plugin-codex`: one Nix
derivation producing `bin/codex-acp`. It fetches a fixed upstream release and
uses that release's own manifest and lockfile, which pins both
`@agentclientprotocol/codex-acp` and the `@openai/codex` CLI it resolves. The
wrapper points the adapter at that exact native CLI through `CODEX_PATH`.

It is deliberately not built from the shared `acp/` shim the Claude and pi
adapters come through. Those two declare their adapters in their own
`default.nix` files via `@olai/plugin-kit`'s `npm-adapter.nix` over each plugin's
own shim lockfile. Codex has its
own upstream release clock and native platform layout, so its derivation
belongs here, next to this plugin's `default.nix`, and a Codex bump rebuilds
only this output.

To update it, change the release, set both hashes in `default.nix` to fake
hashes, and build:

```sh
nix build .#codex-agent
```

Replace each fake hash with the value its failed fixed-output build reports.

### What the move to 1.13.1 found (2026-09-24)

The npm registry's latest stable `@agentclientprotocol/codex-acp` is 1.13.1.
Its upstream lockfile resolves Codex CLI **0.156.1** (from 0.153.3 in our
1.10.0 pin). The source and npm dependency hashes were recalculated by Nix;
the dependency hash covers that lockfile's Linux x64/arm64 and Darwin
x64/arm64 native tarball integrity hashes. There is no separate per-platform
hash table in this derivation.

**The steering backport stays.** `git tag --contains
84bfbe8318400b139214e9aa51352585aae19368` on the upstream clone, after fetching
that commit explicitly, lists no tags. The v1.13.1 source has neither
`idleBehavior` nor `promptRequired`. The unchanged `fetchpatch` backport of
[PR #441](https://github.com/agentclientprotocol/codex-acp/pull/441) still
applies (line offsets only). With `steering.idleBehavior: "promptRequired"`,
a steer arriving after completion leaves its input with Olai, which owns the
next prompt; legacy clients keep upstream's default. Nothing was retired.

The release range adds tool names, file-change diff statistics and turn-diff
reporting, terminal-output deltas, compaction updates and optional session
notices, as well as CLI updates. These are upstream changes, not new Olai
capability advertisements. The Nix build ran `steer-events.test.ts` and
Olai's `permission-mode.test.ts.in`: **2 files, 17 tests passed**. Live and
scripted client validation is recorded in PR #627; the Claude leg and chat
plugin are unchanged in this bump.
