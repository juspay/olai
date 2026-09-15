/**
 * THE HIMALAYA SUBCOMMANDS THIS PLUGIN SPEAKS — frozen, once, against the pin.
 *
 * ## Why a table rather than strings at the call sites
 *
 * A verb spelled at its call site is a fact this repo cannot check against the
 * binary it ships, and the pin moves on its own clock: `just update-pins` walks
 * `npins/sources.json` forward, a build picks the new revision up, and the first
 * thing that notices a renamed subcommand is a conversation drawing a refusal
 * nobody can read (the `odu` #105 lesson — `nix/odu.nix`'s header tells it in
 * full). So every spelling lives HERE, and three readers spend this one table:
 *
 *   - `./run.ts` composes the argv from it;
 *   - `../appliance/testlib/fake-himalaya.ts` offers exactly these verbs and
 *     refuses anything else with a sentence, so a scenario cannot pass against
 *     a fake that answers a verb the pin does not have;
 *   - `scripts/check-himalaya-surface.ts` (`just mail-surface`) runs the BUILT
 *     binary and demands `himalaya gmail profile get --help` answer, so a pin
 *     bump that renames a verb fails `just check` rather than a conversation.
 *
 * ## Two facts about the pinned binary that the plan for this plugin gets wrong
 *
 * Written down here because this file is what a reader checks them against:
 *
 *   1. **The JSON switch is `--json`, not `--output json`.** It is a global
 *      flag (`pimalaya-cli`'s `JsonFlag`), so it sits beside `-c` before the
 *      subcommand; there is no `--output` flag at all in 2.1.0.
 *   2. **`--json` puts ERRORS on stdout too**, as
 *      `{"error": "…", "sources": [], "backtrace": null}` with a non-zero exit.
 *      A reader that only looked at stderr would report *exited 1* for every
 *      refusal Google gives, which is the one thing a person needs the sentence
 *      for. `./run.ts` reads both streams and prefers the JSON error.
 *
 * ## What this table holds NOW, and what it grows into
 *
 * The rows are the verbs this PR speaks — one. PR 2 (the read tools) adds
 * `gmail threads list`, `gmail threads get`, `gmail messages get` and
 * `gmail attachments get`; PR 4 adds the three write verbs and `labels list`;
 * PR 5 adds `history list`. Each lands with its fake beside it, and the surface
 * check covers the table as it stands at every commit — which is the point of
 * one table rather than four.
 */

/** What `himalaya --version` prints first: the version, then the build's
 *  features, target and revision (`v2.1.0 +msgraph +rustls-ring +imap …`). The
 *  floor is the release that introduced the `gmail` backend, so a pin that slid
 *  back to 2.0.0 is a check failure rather than a conversation whose every verb
 *  answers *unrecognized subcommand*. */
export const HIMALAYA_VERSION_FLOOR: readonly [number, number, number] = [2, 1, 0]

/**
 * One verb: the words clap expects, in order, and the sentence a reader of this
 * table (or of the surface check's failure) gets about what it is for.
 *
 * `path` starts BELOW the binary and `gmail` is part of it, so the check and the
 * runner compose `<binary> -c <config> --json <path…> <args…>` the same way and
 * neither has to know that one of the words is a subcommand group.
 */
export interface GmailVerb {
  /** The key this verb is called by in code — `"profile.get"`, the wire word
   *  its reader is named after. */
  readonly id: string
  readonly path: ReadonlyArray<string>
  readonly says: string
}

export const GMAIL = {
  /** `users.getProfile` — the address, the mailbox's size and the history id.
   *  Read on every connect and on every refresh, because it is both the
   *  connection's proof and the panel's number. */
  profileGet: {
    id: "profile.get",
    path: ["gmail", "profile", "get"],
    says: "the signed-in address and the mailbox's totals",
  },
} as const satisfies Record<string, GmailVerb>

/** Every verb this plugin speaks, in one list — what the fake offers, and what
 *  the surface check walks. */
export const GMAIL_VERBS: ReadonlyArray<GmailVerb> = Object.values(GMAIL)

/** The argv the binary is invoked with, given a config path and a verb's own
 *  arguments. Spelled here rather than in `./run.ts` so the flag order — which
 *  is `-c` and `--json` BEFORE the subcommand words, clap's global-flag rule —
 *  is one fact shared by the runner and the surface check. */
export const himalayaArgv = (config: string, path: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  ["-c", config, "--json", ...path, ...args]
