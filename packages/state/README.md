# @olai/state — where this machine keeps olai's own files

Machine-local state never belongs in the vault. A vault is somebody's repository: the store probes it, a commit sweeps it, and `git pull` carries it to another clone. A panel's last conversation, an outbound queue, and a process lock are facts about this machine. A read-only vault must still serve.

There are two homes. `runtimeHome()` is `$XDG_RUNTIME_DIR/olai` (or `/tmp/olai-$UID`) for claims that must not outlive their process, currently the one-brain lock. `stateHome()` is `$XDG_STATE_HOME/olai` (normally `~/.local/state/olai`) for facts that survive a restart.

Every plugin has one document per served directory:

```text
~/.local/state/olai/<plugin>/<sha256(realpath)[0:16]>.json
```

`fileForLocal(plugin, cwd)` spells that path. The document carries its canonical `cwd` as a guard; `readLocal` answers `null` for a missing document or one about another directory. `writeLocal` stages beside the destination and renames atomically, with a unique staging name per call. Directories are `0700`, files are `0600`. Plugins never import this package: core owns the filesystem and supplies the keyed `LocalState` service; each plugin parses its own opaque fields.

Chat's one document contains three independently read sections: `memory`, `wake`, and `heard`. Their state machines keep their own caps and lenient readings, while chat's adapter carries all three through one write lane. Xyne Spaces stores the same mirror snapshot it did before under its plugin document.

The first read recognizes the previous layouts. On the first save, `hold/<digest>.<plugin>.json` is written to the new plugin path; chat additionally folds `chat/<digest>.json`, `wake/<digest>.json`, and `heard/<digest>.json` into its three sections. Old files are left inert and the migration is logged. The older `mirror/<digest>.json` path names no owning plugin, so it cannot be migrated honestly; core leaves it inert and logs that fact.

`pruneGone()` sweeps plugin directories at boot and removes only records whose guarded `cwd` answers `ENOENT`. Unreadable records, relative guards, staged files, and unavailable mounts are left alone. This is hygiene, not validity.

The package remains a leaf: Effect and Node built-ins only, with no `@olai/*` dependency.
