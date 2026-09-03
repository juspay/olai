# `acp/` — the npm shim the shipped ACP adapters are pinned through

Two files, and they are the whole of this directory: a `package.json` naming
the adapters olai ships, and the lockfile npm resolved them to. Nothing here is
imported by any olai source. `nix/acp-agent.nix` builds it — one fixed-output
derivation for the tarballs, nothing fetched at build time, no `npx` at run
time — so a nix-built olai needs nothing ambient.

## Why one lockfile carries two adapters

Because a lockfile is a fixed-output derivation and a hash, and there is
nothing about *which engine* in either of them. Splitting this into
`packages/plugins/claude/acp/` and `packages/plugins/pi/acp/` would buy no
separation the phase asked for — the pin VERSIONS are already one line each,
and each engine's patches and patch sources already live in that engine's
directory — while costing two large FODs and two `npmDepsHash` values to keep
in step by hand. One shim, two dependencies, one hash.

What that costs, said plainly: bumping either adapter regenerates the lockfile
and moves the hash for both. `nix/acp-agent.nix`'s `version` names both pins for
exactly that reason, so the store path cannot go on claiming one version after
the other moved.

## Where an engine's own half lives

An engine is a plugin, and its adapter's patches move on its own release clock:

- **Claude Code** — `packages/plugins/claude/acp/`: two patches
  (`background-tasks-visible`, `session-list-info`), the `session-list-info/`
  rig that generates the second, and a `patches/README.md` that is also where
  every pin move is recorded.
- **pi** — `packages/plugins/pi/acp/`: one patch (`pi-mcp-servers`), the
  `mcp-bridge/` extension that is its other half, and their own README.
- **opencode** — nothing. Olai ships no adapter for it and pins nothing: it is
  found on the server's PATH, which is the whole of that row's door.

## Regenerating

After ANY edit to `package.json` — the shim's own name is in the lockfile, so
renaming it moves the hash as surely as a version bump does:

```
cd acp && npm install --package-lock-only --ignore-scripts
```

then set `npmDepsHash` in `nix/acp-agent.nix` to `lib.fakeHash`, build, and
paste the hash it prints. Re-anchor each engine's patches against the new
bundle with that engine's own `regenerate.sh`, and record what the move found
in that engine's `patches/README.md`.

`just install` also runs `npm ci` here, because the pi bridge's tests
(`packages/plugins/pi/acp/mcp-bridge/`) resolve the MCP SDK from THIS
lockfile rather than from the root's bun one.
