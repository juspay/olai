/**
 * WHERE THIS MACHINE KEEPS OLAI'S OWN FILES — the two per-user homes, and the
 * one name a served directory has under either.
 *
 * Nothing olai keeps for itself goes in the vault. A vault is somebody's git
 * repository or notes app: the store probes every file in it, the sidebar lists
 * them, and a commit sweeps them — so a lockfile, a remembered policy or a
 * panel's last conversation would each be a file olai left behind, offered up
 * for committing, and carried to every clone by `git pull`. That last one is
 * the ruling this package keeps being handed (#335, and again for
 * `git-policy-server-side`): a personal clone of a team's outlines must not
 * inherit the team's auto-push.
 *
 * TWO HOMES, because they answer two different questions:
 *
 *   - the RUNTIME home is for a claim that must not outlive the process that
 *     made it — the one-brain lock ({@link ./lock.ts}). The machine clears it.
 *   - the STATE home is for something that SHOULD survive a restart and means
 *     nothing to anybody else — what somebody chose about this directory's git
 *     policy ({@link ./gitPolicy.ts}).
 *
 * ONE FILE PER SERVED DIRECTORY under either, named by a DIGEST of the path
 * rather than by the path itself: an encoded path is a filename that can
 * outgrow the 255 bytes a component gets, and a single index shared by every
 * directory is a read-modify-write two olai servers can lose an update through.
 * The path is written INSIDE the file, which is what makes these directories
 * readable by the person whose state it is.
 *
 * The digest is over the REALPATH, which is the load-bearing half and
 * {@link ./lock.ts}'s own argument: a person types `olai web ~/notes` in one
 * terminal and `olai web .` from inside a symlink to it in another, `resolve`
 * answers those two differently and `realpath` answers them the same. Two
 * brains over one vault is what the difference would buy the lock; two
 * remembered policies over one vault is what it would buy the other.
 *
 * Both homes are read AT CALL TIME rather than at import, so a test can point a
 * server somewhere of its own — which is exactly what the e2e harness does
 * (`XDG_STATE_HOME` per worker).
 *
 * `@olai/chat`'s `memory.ts` keeps the panel's last conversation the same way
 * and predicted this module by name ("not a receptacle for where this machine
 * keeps olai's state, though that is what it would be at population two"). It
 * is not a caller: that package sits beside this one rather than under it, so
 * the receptacle it would share is a move rather than an import, and the two
 * files agree by writing the same three lines rather than by depending on each
 * other. Population here is two, which is what this file is.
 */

import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

/**
 * `$XDG_RUNTIME_DIR/olai`, or the fixed per-user `/tmp/olai-$UID` where there
 * is no runtime directory — the convention kolu's rendezvous sockets use, which
 * olai kept a user of until #184 and is one again for the lock.
 *
 * NOT `os.tmpdir()`, and that is the whole reason this is not one line: it
 * honours `$TMPDIR`, which differs by LAUNCH CONTEXT — a launchd- or
 * systemd-started olai and one a person types into a terminal get different
 * ones — so the same vault would be locked at two paths and neither process
 * would see the other. `/tmp` is present and identical in every process on both
 * platforms, and `-$UID` keeps it per-user.
 */
export const runtimeHome = (): string => {
  const xdg = process.env["XDG_RUNTIME_DIR"]
  return xdg !== undefined && xdg !== ""
    ? join(xdg, "olai")
    : `/tmp/olai-${process.getuid?.() ?? "shared"}`
}

/** `$XDG_STATE_HOME/olai`, or the default the spec names — where a fact that
 *  should outlive this process goes. */
export const stateHome = (): string => {
  const set = process.env["XDG_STATE_HOME"]
  return join(
    set !== undefined && set !== "" ? set : join(homedir(), ".local", "state"),
    "olai",
  )
}

/**
 * What one served directory is CALLED under either home.
 *
 * Sixteen hex characters of a SHA-256 over the realpath — enough that two
 * vaults on one machine colliding is not a thing anybody will meet, and short
 * enough to read in a directory listing.
 */
export const digestOf = (root: string): string =>
  createHash("sha256").update(canonical(root)).digest("hex").slice(0, 16)

/**
 * The served root, spelled the one way everything here keys on.
 *
 * A path that does not exist has no realpath and falls back to the resolved
 * spelling: a caller is about to fail on the missing directory anyway, and this
 * must not be what tells them so.
 */
export const canonical = (root: string): string => {
  try {
    return fs.realpathSync(resolve(root))
  } catch {
    return resolve(root)
  }
}
