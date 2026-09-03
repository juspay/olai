# The Codex executable pin

This directory is the executable half of `olai-plugin-codex`: one Nix
derivation producing `bin/codex-acp`. It fetches a fixed upstream release and
uses that release's own manifest and lockfile, which pins both
`@agentclientprotocol/codex-acp` and the `@openai/codex` CLI it resolves. The
wrapper points the adapter at that exact native CLI through `CODEX_PATH`.

It is deliberately not a third row in the repository-level `acp/` shim. That
derivation carries patched Claude and pi adapters whose pins and build rules
move together. Codex has its own upstream release clock and native platform
layout, so a Codex bump belongs here and rebuilds only this output.

To update it, change the release, set both hashes in `default.nix` to fake
hashes, and build:

```sh
nix build .#codex-agent
```

Replace each fake hash with the value its failed fixed-output build reports.
