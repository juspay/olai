/**
 * WHERE THIS MACHINE KEEPS OLAI'S OWN FILES — the two per-user homes, one name
 * per served directory under either, and the two verbs that read and write a
 * small record there.
 *
 * **Nothing olai keeps for itself goes in the vault.** A vault is somebody's git
 * repository or notes app: the store probes every file in it, the sidebar lists
 * them, and a commit sweeps them — so a lockfile or a panel's last conversation
 * would each be a file olai left behind, offered up for committing, and
 * carried to every clone by `git pull`. A personal clone of a team's outlines
 * must not inherit the team's last chat, and a vault on a read-only mount
 * still serves.
 *
 * TWO HOMES, because they answer two different questions:
 *
 *   - the RUNTIME home is for a claim that must not outlive the process that
 *     made it — the one-brain lock (`@olai/server`'s `lock.ts`). The machine
 *     clears it.
 *   - the STATE home is for something that SHOULD survive a restart and means
 *     nothing to anybody else — which conversation the chat panel was in
 *     (`olai-plugin-chat`'s `memory.ts`), which doorbell each conversation picked
 *     (`olai-plugin-chat`'s `scopes.ts`), what olai overheard a conversation do
 *     (`olai-plugin-chat`'s `heard.ts`), and a plugin's hold (threads, a queue)
 *     handed through core as `PluginServices.held`. After git left this
 *     package the state home has three {@link Kind}s plus a per-plugin hold —
 *     {@link Kind} says why the split is by what each record survives.
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
 * difference would buy the lock; two remembered conversations over one vault
 * is what it would buy the other.
 *
 * Both homes are read AT CALL TIME rather than at import, so a test can point a
 * process somewhere of its own — which is exactly what the e2e harness does
 * (`XDG_STATE_HOME` per worker).
 *
 * ## Why this is a package
 *
 * It was written more than once before it was one, which is the bar: the lock's
 * runtime home and digest, and the chat panel's state home and digest. A git
 * policy used to live here too and no longer does — chat, what a conversation
 * overheard, and a plugin's hold are the remaining tenants, the hold reached
 * through core so this leaf stays out of every plugin. `olai-plugin-chat`'s `memory.ts` named this module before it existed
 * ("not a receptacle for where this machine keeps olai's state, though that is
 * what it would be at population two") and it is a LEAF for the same reason
 * `@olai/git` is: it knows about a filesystem and nothing about outlines, git,
 * a wire or a writer. `olai-plugin-chat` sits beside `@olai/server` rather than under
 * it, so a home they could both reach had to be below both.
 *
 * ## What it does with a failure
 *
 * Nothing kept here is load-bearing enough to stop a boot, and none of it is
 * quiet either — never silently ignore an error. Both verbs FAIL
 * with a reason and the caller decides — a memory that cannot be read means the
 * panel opens the newest conversation and says why.
 *
 * A MISSING FILE IS NOT A FAILURE. It is the answer on the first serve of a
 * directory, and the answer after the state directory has been cleaned out.
 *
 * ## The record whose directory is gone
 *
 * A record outlives the directory it is about all the time: every temp copy a
 * test or a script ever served leaves one, and nothing was ever asking. So the
 * home grew a file per /tmp directory the machine had ever seen. {@link
 * pruneGone} is the answer, run once per server boot next to the runtime
 * home's own sweep (`@olai/server`'s `lock.ts`): a record whose `cwd` answers
 * ENOENT is dropped.
 *
 * WHY AT BOOT and not on the read path: the read path can never meet the
 * record that needs dropping — it is only ever asked about the directory
 * being served right now, which by construction exists. The records for
 * directories that died are exactly the ones nobody ever reads. The sweep
 * runs once on the boot that holds the vault (packages/server/src/lock.ts),
 * forked so its unbounded walk never stands between the person and the bind.
 *
 * CONSERVATIVE by one rule: ONLY ENOENT counts. A directory whose answer is
 * anything else — a network mount that will not answer, a permission that
 * moved — is not a dead directory, and its record stays. Even ENOENT is not
 * always "gone": a vault on a bind mount the host does not see, an unplugged
 * removable volume, an autofs path whose server is down — all answer the
 * same, and the runtime lock's ledger keeps its file on exactly this
 * evidence. Here the same evidence takes the opposite verdict on purpose,
 * and the asymmetry is the stakes: the lock guards two brains over one
 * vault, and a record guards a convenience note the next serve rewrites. The
 * same conservatism governs the record: bytes that are not JSON, a record
 * that names no `cwd`, a RELATIVE one (whose stat would resolve against
 * wherever this process happens to sit, "dead" from one boot and "alive"
 * from the next), a staged `.tmp` nobody renamed away — all left alone. This
 * is hygiene, not validity, the same posture the runtime sweep takes: a file
 * the sweep cannot read or cannot unlink is left, and the boot continues.
 * One asymmetry between the two sweeps wants naming: the runtime one refuses
 * to read a home that is not a private owned directory; this one has no
 * equivalent, and that is defensible twice over — the state home sits under
 * the user's own tree rather than in world-writable `/tmp`, and unlinking a
 * symlink somebody planted removes the link, never its target.
 *
 * EVERY tenant directory is swept, not only the kinds THIS build knows: the
 * home is one per machine across olai versions, the `mirror` records of an
 * older build among them, and a record's contract — `cwd` inside the file —
 * is older than any tenant list.
 */

import { Data, Effect } from "effect"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"

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
 *
 * Three kinds named here, and a fourth named by {@link fileForHold}. The split
 * between them is what each SURVIVES rather than what each is about. `chat`
 * is the panel's last conversation — one record, rewritten whenever the panel
 * opens one. `wake` is which conversations a person pointed a plugin's
 * doorbell at, and on which file; it holds the picks and never the messages,
 * because a held message is a derivation of state that is still true and is
 * rung again by whatever derives it. `heard` is what olai OVERHEARD one
 * conversation do: that this session has been told its node agent's contract,
 * and the last line its agent said while olai was watching. A plugin's hold
 * is a small record that plugin keeps about this serve — one file per plugin
 * per vault — and it is reached through core, not by the plugin naming this
 * package. A plugin that imported this leaf would become the sole reacher and
 * this package would silently join that tenant's exemption set.
 *
 * `heard` is BOOKKEEPING and that is why it is here rather than in the vault,
 * where the human's 2026-09-02 ruling put all config: nothing configures these
 * two, nothing else can reconstruct them, and a board written to on every turn
 * would be a board committed on every turn. Which node agent a session belongs
 * to is the config half, and it is a property on the node
 * (`@olai/format`'s `agents.ts`).
 */
export type Kind = "chat" | "wake" | "heard"

/** Where one kind of remembered thing lives for one served directory — a
 *  subdirectory of the state home, and the digest under it. Takes the
 *  CANONICAL path, which is the one every caller has already resolved because
 *  it goes inside the file too. */
export const fileFor = (kind: Kind, cwd: string): string =>
  join(stateHome(), kind, `${digestOf(cwd)}.json`)

/**
 * Where one plugin's hold lives for one served directory.
 *
 * THE PLUGIN'S NAME IS A FILENAME, not a path: a slash or a `..` would
 * escape the hold directory. Refused here rather than sanitised, because a
 * name that is not a filename is a registry bug, not a spelling to tidy.
 * This leaf does not name any plugin.
 */
export const fileForHold = (plugin: string, cwd: string): string => {
  if (plugin.length === 0 || /[^\w.-]/.test(plugin)) {
    throw new Error(`hold: plugin name ${JSON.stringify(plugin)} is not a filename`)
  }
  return join(stateHome(), "hold", `${digestOf(cwd)}.${plugin}.json`)
}

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

/** How many records this process has staged — the tail of a staged file's
 *  name, so two overlapping writes to one destination stage through two files
 *  and only one of them is ever renamed away. See {@link writeHeld}: it has to
 *  differ from the other names in the air right now, and nothing more. */
let staging = 0

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
 *
 * ## The staged name is unique per CALL, and that is the whole of a defect
 *
 * ONE PROCESS CAN HAVE TWO OF THESE IN THE AIR AT ONCE — two tabs on one
 * panel, a double-click on a picker, a boot fiber and a protocol callback
 * writing the same record — and two calls sharing one staged name do not lose a
 * byte, they LIE. A writes the stage; B overwrites it; A renames it onto the
 * destination; B's rename then fails ENOENT, so B reports a failure to the
 * person who just made the gesture for bytes that are on the disk. A refusal
 * over a write that landed is the worst answer available here, because it is
 * the one a caller acts on: {@link StateFailure} is the channel that tells
 * somebody their pick did not stick, and the record it names says it did.
 * {@link staging} makes the name a call's own; the pid stays in front of it, so
 * a leftover still names the process that left it, and two olai servers over
 * one home never meet in the same file. `@olai/store`'s `disk.ts` stages by pid
 * and counter for exactly this reason.
 *
 * NOT a `mkdtemp` per call and not a random suffix: the only writers that can
 * collide on this name are calls inside THIS process — every other process is
 * already held off by its own pid — so a counter that never repeats within a
 * process is the whole requirement, at no syscall and no entropy. And not a
 * lock file, which is a second thing on disk to leave behind and to clean up
 * after a kill, to buy an ordering nobody here wants: these two writes are
 * genuinely concurrent and either may win.
 *
 * The `rm` on the failure path is unchanged and is still exactly right — with a
 * name per call it removes the file this call wrote and cannot reach into
 * another call's.
 *
 * IT USED TO BE `<file>.<pid>.tmp`, one name per destination per process, and
 * the hazard was patched TWICE ABOVE before it was closed here: `olai-plugin-chat`'s
 * `agent.ts` put a semaphore around the one writer of its memory note, and
 * `scopes.ts` took a second one on the strength of the same reading. A leaf
 * that is only correct while every tenant remembers to queue is a leaf that is
 * wrong on the next tenant — nothing in this file's types says a caller owes it
 * a permit, and the second tenant learnt the rule by reading the first. So the
 * fix belongs at the name. The permits above stay, because each has a job of
 * its own that no staging name provides: `scopes.ts` reads, modifies and writes
 * an in-memory mirror and would lose a pick without one, and `agent.ts` orders
 * two writes that must land in the order they were made.
 */
export const writeHeld = (
  at: string,
  held: Held & Record<string, unknown>,
): Effect.Effect<void, StateFailure> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(at), { recursive: true, mode: 0o700 })
      const staged = `${at}.${process.pid}.${++staging}.tmp`
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

/**
 * Drop every record whose served directory no longer exists. Returns how many
 * it dropped, so the boot that ran it can say so.
 *
 * See the header for the whole ruling: run at server start, ONLY ENOENT is a
 * dead directory, and anything unreadable, unparseable, `cwd`-less, staged or
 * unanswerable is LEFT — a record is never pruned on a non-answer.
 *
 * Plain and synchronous rather than an {@link Effect}, for `sweepRuntime`'s
 * reason: it sweeps, and a sweep that cannot reach one file moves on to the
 * next. Where THAT one runs is `holdVault`, beside this one's.
 */
export const pruneGone = (): number => {
  const home = stateHome()
  let tenants: ReadonlyArray<fs.Dirent>
  try {
    tenants = fs.readdirSync(home, { withFileTypes: true })
  } catch {
    return 0
  }
  let pruned = 0
  for (const tenant of tenants) {
    if (!tenant.isDirectory()) continue
    const dir = join(home, tenant.name)
    let names: ReadonlyArray<string>
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.endsWith(".json")) continue
      if (goneRecord(join(dir, name))) pruned += 1
    }
  }
  return pruned
}

/**
 * One record's hearing: dead or not.
 *
 * The `cwd` inside the file is the question — a record is ABOUT the directory
 * it names, and the file's own name is only a digest of it. A `stat` that
 * answers is the whole ruling: ENOENT says the directory is gone and the
 * record may go; any other answer, or no answer, keeps it. A relative `cwd`
 * keeps it too, and it is the one ruling this sweep could otherwise get wrong:
 * the stat would resolve against wherever this process happened to be
 * started, so the same record would be "dead" from one boot and "alive" from
 * the next. The unlink's own failure keeps the record too, and is not counted.
 */
const goneRecord = (at: string): boolean => {
  let held: unknown
  try {
    held = JSON.parse(fs.readFileSync(at, "utf8"))
  } catch {
    return false
  }
  const cwd = (held as { readonly cwd?: unknown } | null)?.cwd
  if (typeof cwd !== "string" || cwd === "" || !isAbsolute(cwd)) return false
  try {
    fs.statSync(cwd)
    return false
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code !== "ENOENT") return false
  }
  try {
    fs.unlinkSync(at)
    return true
  } catch {
    return false
  }
}

/** What went wrong, in the words the thing that failed used. Spelled here
 *  rather than taken from `@olai/log`, because that would be a workspace
 *  sibling on a leaf whose whole claim is that it has none. */
const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
