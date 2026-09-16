# The Codex executable pin

This directory is the executable half of `olai-plugin-codex`: one Nix
derivation producing `bin/codex-acp`. It fetches a fixed upstream release and
uses that release's own manifest and lockfile, which pins both
`@agentclientprotocol/codex-acp` and the `@openai/codex` CLI it resolves. The
wrapper points the adapter at that exact native CLI through `CODEX_PATH`.

It is deliberately not built from the shared `acp/` shim the Claude and pi
adapters come through. Those two declare their adapters in their own
`default.nix` files via `@olai/plugin-kit`'s `npm-adapter.nix` over the shared
shim's one lockfile — their pins and build rules move together. Codex has its
own upstream release clock and native platform layout, so its derivation
belongs here, next to this plugin's `default.nix`, and a Codex bump rebuilds
only this output.

To update it, change the release, set both hashes in `default.nix` to fake
hashes, and build:

```sh
nix build .#codex-agent
```

Replace each fake hash with the value its failed fixed-output build reports.

`default.nix` uses `fetchpatch` to backport [upstream PR #441](https://github.com/agentclientprotocol/codex-acp/pull/441)
(still open on 2026-09-06), pinned to commit
`84bfbe8318400b139214e9aa51352585aae19368` and a content hash. With `steering.idleBehavior: "promptRequired"`, a steer that
arrives after completion leaves its input with Olai, which starts and tracks
the next prompt. Legacy clients keep upstream's default. The upstream steering
tests included in the patch run in the Nix build. Recheck the backport when
bumping the adapter; remove it once the release includes the fix.
