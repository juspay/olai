/**
 * WHERE THIS MACHINE KEEPS OLAI'S OWN FILES — the two per-user homes, one name
 * per served directory under either, and the two verbs that read and write a
 * small record there.
 *
 * **Nothing olai keeps for itself goes in the vault.** A vault is somebody's git
 * repository or notes app: the store probes every file in it, the sidebar lists
 * them, and a commit sweeps them — so a lockfile, a remembered git policy or a
 * panel's last conversation would each be a file olai left behind, offered up
 * for committing, and carried to every clone by `git pull`. That last one is
 * the ruling this repository keeps being handed (#335, and again for
 * `git-policy-server-side`): a personal clone of a team's outlines must not
 * inherit the team's auto-push. A vault on a read-only mount still serves.
 *
 * TWO HOMES, because they answer two different questions:
 *
 *   - the RUNTIME home is for a claim that must not outlive the process that
 *     made it — the one-brain lock (`@olai/server`'s `lock.ts`). The machine
 *     clears it.
 *   - the STATE home is for something that SHOULD survive a restart and means
 *     nothing to anybody else — which conversation the chat panel was in
 *     (`@olai/chat`'s `memory.ts`), and what somebody chose about a directory's
 *     git policy (`@olai/server`'s `gitPolicy.ts`).
 *
 * ONE FILE PER SERVED DIRECTORY under either, named by a DIGEST of the path
 * rather than by the path itself: an encoded path is a filename that can
 * outgrow the 255 bytes a component gets, and a single index shared by every
 * directory is a read-modify-write two olai servers can lose an update through.
 * The path is written INSIDE the file ({@link Held.cwd}), which is what makes
 * these directories readable by the person whose state it is and is read back
 * as a guard: a file that is about some other directory is not this one's.
 *
 * The digest is over the REALPATH, and that half is load-bearing: a person
 * types `olai web ~/notes` in one terminal and `olai web .` from inside a
 * symlink to it in another; `resolve` answers those two differently and
 * `realpath` answers them the same. Two brains over one vault is what the
 * difference would buy the lock; two remembered policies over one vault is what
 * it would buy the other.
 *
 * Both homes are read AT CALL TIME rather than at import, so a test can point a
 * process somewhere of its own — which is exactly what the e2e harness does
 * (`XDG_STATE_HOME` per worker).
 *
 * ## Why this is a package
 *
 * It was written three times before it was one, which is the bar: the lock's
 * runtime home and digest, the chat panel's state home and digest, and the git
 * policy's. `@olai/chat`'s `memory.ts` named this module before it existed
 * ("not a receptacle for where this machine keeps olai's state, though that is
 * what it would be at population two") and it is a LEAF for the same reason
 * `@olai/git` is: it knows about a filesystem and nothing about outlines, git,
 * a wire or a writer. `@olai/chat` sits beside `@olai/server` rather than under
 * it, so a home they could both reach had to be below both.
 *
 * ## What it does with a failure
 *
 * Nothing kept here is load-bearing enough to stop a boot, and none of it is
 * quiet either (HACKING.md: never silently ignore an error). Both verbs FAIL
 * with a reason and the caller decides — a memory that cannot be read means the
 * panel opens the newest conversation and says why; a policy that cannot be
 * read means the server runs on its flags and logs it.
 *
 * A MISSING FILE IS NOT A FAILURE. It is the answer on the first serve of a
 * directory, and the answer after the state directory has been cleaned out.
 */

import { Data, Effect } from "effect"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

/**
 * `$XDG_RUNTIME_DIR/olai`, or the fixed per-user `/tmp/olai-$UID` where there
 * is no runtime directory — the convention kolu's rendezvous sockets use.
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
 * Sixteen hex characters of a SHA-256, enough that two vaults on one machine
 * colliding is not a thing anybody will meet and short enough to read in a
 * directory listing.
 *
 * IT TAKES THE CANONICAL PATH and does not compute one, so a caller that also
 * wants the spelling — every caller here does, since it goes inside the file as
 * the guard — pays for one `realpath` rather than two.
 */
export const digestOf = (cwd: string): string =>
  createHash("sha256").update(cwd).digest("hex").slice(0, 16)

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

/** Reading, or writing, a kept record went wrong. Reported to a person and
 *  never fatal — see this file's header. */
export class StateFailure extends Data.TaggedError("StateFailure")<{
  readonly why: string
}> {
  override get message(): string {
    return this.why
  }
}

/**
 * WHAT THIS MACHINE KEEPS, as a closed list.
 *
 * A union rather than a free string, and that is the containment the header
 * claims: `join(stateHome(), "../../somewhere")` escapes a home a caller was
 * told it could not reach, and nothing but a type can say so. It also makes
 * "what does olai keep about a directory" answerable by reading one line.
 */
export type Kind = "chat" | "git"

/** Where one kind of remembered thing lives for one served directory — a
 *  subdirectory of the state home, and the digest under it. Takes the
 *  CANONICAL path, which is the one every caller has already resolved because
 *  it goes inside the file too. */
export const fileFor = (kind: Kind, cwd: string): string =>
  join(stateHome(), kind, `${digestOf(cwd)}.json`)

/** What every record here carries beside its own fields — see the header for
 *  why the path is written inside the file it is named after. */
export interface Held {
  readonly cwd: string
}

/**
 * Read one back, or `null` for a directory nothing has been written down for —
 * and `null` again for a file that is about some OTHER directory.
 *
 * That second `null` is not damage and is not refused: it is a digest collision
 * or a state directory somebody copied, and the honest answer is that nothing
 * here says. Every other way a read fails (a state directory whose permissions
 * moved, a disk that will not answer, bytes that are not JSON) is news and
 * comes out the error channel.
 *
 * The FIELDS are the caller's to read leniently. This answers with the object
 * verbatim once it has checked the one thing it owns, because what a missing or
 * strange field means differs per record — the caller knows which of its own
 * halves it can do without.
 */
export const readHeld = (
  at: string,
  cwd: string,
): Effect.Effect<Record<string, unknown> | null, StateFailure> =>
  Effect.flatMap(
    Effect.tryPromise({
      // ENOENT is the ordinary answer rather than a fault, so it is answered
      // INSIDE the promise, where the file's own reason is.
      try: async (): Promise<string | null> => {
        try {
          return await readFile(at, "utf8")
        } catch (cause) {
          if ((cause as { readonly code?: unknown }).code === "ENOENT") return null
          throw cause
        }
      },
      catch: (cause) =>
        new StateFailure({ why: `\`${at}\` could not be read: ${reasonOf(cause)}` }),
    }),
    (text) =>
      text === null ? Effect.succeed(null) : Effect.map(
        Effect.try({
          try: () => JSON.parse(text) as unknown,
          catch: (cause) =>
            new StateFailure({
              why: `\`${at}\` is not readable JSON: ${reasonOf(cause)}`,
            }),
        }),
        (value) => {
          const held = value as (Partial<Held> & Record<string, unknown>) | null
          return held?.cwd === cwd ? held : null
        },
      ),
  )

/**
 * ... and writing one down, staged beside its destination and renamed onto it.
 *
 * The way every other file olai writes lands: a half-written record read by the
 * next boot would be a parse failure reported to somebody who did nothing
 * wrong, and `rename` within one directory is atomic. The home is minted
 * owner-only, and so is the file.
 *
 * `undefined` is how `JSON.stringify` spells a field that is not there, which
 * is what a half nobody has chosen IS on disk — so a caller passes `undefined`
 * rather than inventing a null.
 */
export const writeHeld = (
  at: string,
  held: Held & Record<string, unknown>,
): Effect.Effect<void, StateFailure> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(at), { recursive: true, mode: 0o700 })
      const staged = `${at}.${process.pid}.tmp`
      try {
        await writeFile(staged, `${JSON.stringify(held)}\n`, { mode: 0o600 })
        await rename(staged, at)
      } catch (cause) {
        await rm(staged, { force: true })
        throw cause
      }
    },
    catch: (cause) =>
      new StateFailure({ why: `\`${at}\` could not be written: ${reasonOf(cause)}` }),
  })

/** What went wrong, in the words the thing that failed used. Spelled here
 *  rather than taken from `@olai/log`, because that would be a workspace
 *  sibling on a leaf whose whole claim is that it has none. */
const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
